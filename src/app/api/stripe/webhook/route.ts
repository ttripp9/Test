import { eq } from "drizzle-orm";
import type Stripe from "stripe";
import { cancelMembership, expireOrder, markOrderPaid, markOrderRefunded } from "@/lib/commerce";
import { db } from "@/lib/db";
import { orders, stores, users, webhookEvents, type PlanId } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { stripe, stripeEnabled } from "@/lib/stripe";

export const dynamic = "force-dynamic";

function planForPrice(priceId: string | undefined): PlanId | null {
  if (!priceId) return null;
  if (priceId === env.stripePriceBusiness) return "business";
  if (priceId === env.stripePricePro) return "pro";
  return null;
}

const idOf = (v: string | { id: string } | null | undefined) => (typeof v === "string" ? v : (v?.id ?? null));

export async function POST(req: Request) {
  if (!stripeEnabled()) return new Response("Stripe not configured", { status: 400 });
  const signature = req.headers.get("stripe-signature");
  if (!signature) return new Response("Missing signature", { status: 400 });
  const raw = await req.text();

  // Platform events and Connect (creator account) events use different signing secrets.
  let event: Stripe.Event | null = null;
  for (const secret of [env.stripeWebhookSecret, env.stripeConnectWebhookSecret].filter(Boolean)) {
    try {
      event = stripe().webhooks.constructEvent(raw, signature, secret);
      break;
    } catch {
      // try the next secret
    }
  }
  if (!event) return new Response("Bad signature", { status: 400 });

  // Ignore duplicates: Stripe may deliver the same event more than once.
  const fresh = await db.insert(webhookEvents).values({ id: event.id }).onConflictDoNothing().run();
  if (fresh.changes === 0) return Response.json({ received: true, duplicate: true });

  try {
    await handle(event);
  } catch (err) {
    // Let Stripe retry later.
    await db.delete(webhookEvents).where(eq(webhookEvents.id, event.id)).run();
    console.error("[stripe webhook]", event.type, err);
    return new Response("Handler error", { status: 500 });
  }
  return Response.json({ received: true });
}

async function fromOrderOwner(storeId: string, account: string | undefined) {
  if (!account) return false;
  const owner = await db
    .select({ acct: users.stripeAccountId })
    .from(stores)
    .innerJoin(users, eq(users.id, stores.userId))
    .where(eq(stores.id, storeId))
    .get();
  return owner?.acct === account;
}

async function handle(event: Stripe.Event) {
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const session = event.data.object;
      if (session.metadata?.kind === "plan") {
        const userId = session.metadata.userId;
        const plan = session.metadata.plan as PlanId;
        if (userId && (plan === "pro" || plan === "business")) {
          await db
            .update(users)
            .set({ plan, stripeCustomerId: idOf(session.customer), stripeSubscriptionId: idOf(session.subscription) })
            .where(eq(users.id, userId))
            .run();
        }
        return;
      }
      const orderId = session.metadata?.orderId;
      if (!orderId) return;
      // Make sure the event really came from the connected account that owns this order.
      const order = await db.select().from(orders).where(eq(orders.id, orderId)).get();
      if (!order || order.stripeSessionId !== session.id) return;
      if (!(await fromOrderOwner(order.storeId, event.account))) return;
      if (session.payment_status === "paid" || session.payment_status === "no_payment_required") {
        await markOrderPaid(orderId, { paymentIntentId: idOf(session.payment_intent), subscriptionId: idOf(session.subscription) });
      }
      return;
    }
    case "checkout.session.expired": {
      const session = event.data.object;
      const orderId = session.metadata?.orderId;
      const order = orderId ? await db.select().from(orders).where(eq(orders.id, orderId)).get() : null;
      if (order && order.stripeSessionId === session.id) await expireOrder(order.id);
      return;
    }
    case "charge.refunded": {
      const charge = event.data.object;
      if (!charge.refunded) return; // partial refund: keep access
      const pi = idOf(charge.payment_intent);
      if (!pi) return;
      const order = await db.select().from(orders).where(eq(orders.stripePaymentIntentId, pi)).get();
      if (order && (await fromOrderOwner(order.storeId, event.account))) await markOrderRefunded(order.id);
      return;
    }
    case "customer.subscription.deleted": {
      const sub = event.data.object;
      if (event.account) {
        await cancelMembership(sub.id);
      } else {
        await db.update(users).set({ plan: "free", stripeSubscriptionId: null }).where(eq(users.stripeSubscriptionId, sub.id)).run();
      }
      return;
    }
    case "customer.subscription.updated": {
      const sub = event.data.object;
      if (event.account) {
        if (sub.status === "canceled" || sub.status === "unpaid") await cancelMembership(sub.id);
        return;
      }
      const plan = planForPrice(sub.items.data[0]?.price.id);
      const active = ["active", "trialing", "past_due"].includes(sub.status);
      await db
        .update(users)
        .set({ plan: active && plan ? plan : "free" })
        .where(eq(users.stripeSubscriptionId, sub.id))
        .run();
      return;
    }
    case "account.updated": {
      const account = event.data.object;
      await db.update(users).set({ stripeChargesEnabled: Boolean(account.charges_enabled) }).where(eq(users.stripeAccountId, account.id)).run();
      return;
    }
    default:
      return;
  }
}
