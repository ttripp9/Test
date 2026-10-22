import { and, eq, gt, inArray, lt, or, sql } from "drizzle-orm";
import type Stripe from "stripe";
import { track } from "./analytics";
import { startSequences } from "./automation";
import { availableSlots, formatSlot } from "./booking";
import { upsertContact } from "./contacts";
import { db } from "./db";
import {
  affiliates,
  bookings,
  coupons,
  orders,
  products,
  stores,
  users,
  type Order,
  type Product,
  type Store,
} from "./db/schema";
import { demoPaymentsEnabled, env } from "./env";
import { newId, newToken } from "./ids";
import { sendEmail } from "./mailer";
import { formatMoney } from "./money";
import { getPlan, platformFeeCents } from "./plans";
import { quote, STRIPE_MIN_CHARGE_CENTS } from "./pricing";
import { isEmail } from "./safe";
import { stripe, stripeEnabled } from "./stripe";

export class CheckoutError extends Error {}

const HOLD_MINUTES = 31; // Stripe Checkout sessions must live at least 30 minutes.

export type CheckoutInput = {
  storeSlug: string;
  productId: string;
  email: string;
  name?: string;
  couponCode?: string | null;
  customAmountCents?: number | null;
  includeBump?: boolean;
  slotStart?: number | null;
  affiliateCode?: string | null;
  /** Access token of a paid order whose after-purchase offer is this product. */
  upsellToken?: string | null;
  visitor?: string;
  source?: string;
};

export type CheckoutResult = { orderId: string; accessToken: string; redirectUrl: string };

export async function loadPublicProduct(storeSlug: string, productId: string) {
  const row = await db
    .select({ product: products, store: stores, owner: users })
    .from(products)
    .innerJoin(stores, eq(stores.id, products.storeId))
    .innerJoin(users, eq(users.id, stores.userId))
    .where(and(eq(stores.slug, storeSlug), eq(products.id, productId)))
    .get();
  if (!row || !row.store.published || !row.product.active || row.product.archived) return null;
  return row;
}

/** Bookings that currently block time: confirmed ones, plus unexpired holds. */
export async function busySlots(productId: string, now = new Date()) {
  return db
    .select({ start: bookings.startAt, end: bookings.endAt })
    .from(bookings)
    .where(
      and(
        eq(bookings.productId, productId),
        or(eq(bookings.status, "confirmed"), and(eq(bookings.status, "held"), gt(bookings.holdExpiresAt, now))),
      ),
    )
    .all();
}

export async function createCheckout(input: CheckoutInput): Promise<CheckoutResult> {
  const row = await loadPublicProduct(input.storeSlug, input.productId);
  if (!row) throw new CheckoutError("This product isn't available.");
  const { product, store, owner } = row;
  const now0 = new Date();
  if (product.type === "link") throw new CheckoutError("This item is a link, not a product.");
  const plan = getPlan(owner.plan);

  const email = input.email.trim().toLowerCase();
  if (!isEmail(email)) throw new CheckoutError("Enter a valid email address.");
  const name = (input.name ?? "").trim().slice(0, 100);

  let coupon = input.couponCode?.trim()
    ? ((await db
        .select()
        .from(coupons)
        .where(and(eq(coupons.storeId, store.id), eq(coupons.code, input.couponCode.trim().toUpperCase())))
        .get()) ?? null)
    : null;
  if (input.couponCode?.trim() && !coupon) throw new CheckoutError("That discount code isn't valid.");

  // After-purchase offers: a buyer who just paid gets the creator's offer discount.
  if (input.upsellToken) {
    const prior = await db.select().from(orders).where(eq(orders.accessToken, input.upsellToken)).get();
    const priorProduct = prior ? await db.select().from(products).where(eq(products.id, prior.productId)).get() : null;
    const pct = priorProduct?.settings.upsellDiscountPercent ?? 0;
    if (prior && prior.status === "paid" && prior.storeId === store.id && priorProduct?.settings.upsellProductId === product.id && pct > 0) {
      coupon = {
        id: "",
        storeId: store.id,
        code: "OFFER",
        percentOff: pct,
        amountOffCents: null,
        productId: product.id,
        maxRedemptions: null,
        redemptions: 0,
        expiresAt: null,
        active: true,
        createdAt: now0,
      };
    }
  }

  let bump: Product | null = null;
  if (input.includeBump && product.settings.bumpProductId && product.type !== "membership") {
    bump =
      (await db
        .select()
        .from(products)
        .where(
          and(
            eq(products.id, product.settings.bumpProductId),
            eq(products.storeId, store.id),
            eq(products.active, true),
            eq(products.archived, false),
          ),
        )
        .get()) ?? null;
  }
  const bumpPrice = bump ? (product.settings.bumpPriceCents ?? bump.priceCents) : 0;

  const q = quote({ product, coupon, customAmountCents: input.customAmountCents, bump: bump ? { priceCents: bumpPrice } : null });
  if (q.couponError) throw new CheckoutError(q.couponError);
  let total = q.totalCents;
  if (total > 0 && total < STRIPE_MIN_CHARGE_CENTS) total = STRIPE_MIN_CHARGE_CENTS;

  let slot: { start: Date; end: Date } | null = null;
  if (product.type === "booking") {
    if (!input.slotStart) throw new CheckoutError("Pick a time for your call.");
    const open = availableSlots({ settings: product.settings, timeZone: store.timezone, busy: await busySlots(product.id) });
    slot = open.find((s) => s.start.getTime() === input.slotStart) ?? null;
    if (!slot) throw new CheckoutError("That time was just taken. Please pick another.");
  }

  let affiliateId: string | null = null;
  let commission = 0;
  if (input.affiliateCode && plan.affiliates) {
    const aff = await db
      .select()
      .from(affiliates)
      .where(
        and(
          eq(affiliates.storeId, store.id),
          eq(affiliates.code, input.affiliateCode.toUpperCase()),
          eq(affiliates.active, true),
        ),
      )
      .get();
    if (aff && aff.email !== email) {
      affiliateId = aff.id;
      commission = Math.round((total * aff.commissionPercent) / 100);
    }
  }

  const orderId = newId();
  const accessToken = newToken();
  const fee = platformFeeCents(total, plan);
  const now = new Date();

  db.transaction((tx) => {
    if (slot) {
      // Re-check inside the transaction so two buyers can't grab the same slot.
      const clash = tx
        .select({ id: bookings.id })
        .from(bookings)
        .where(
          and(
            eq(bookings.productId, product.id),
            lt(bookings.startAt, slot.end),
            gt(bookings.endAt, slot.start),
            or(eq(bookings.status, "confirmed"), and(eq(bookings.status, "held"), gt(bookings.holdExpiresAt, now))),
          ),
        )
        .get();
      if (clash) throw new CheckoutError("That time was just taken. Please pick another.");
    }
    tx.insert(orders)
      .values({
        id: orderId,
        storeId: store.id,
        productId: product.id,
        buyerEmail: email,
        buyerName: name,
        subtotalCents: q.subtotalCents,
        discountCents: q.discountCents,
        totalCents: total,
        platformFeeCents: fee,
        currency: store.currency,
        couponId: coupon?.id || null,
        affiliateId,
        affiliateCommissionCents: commission,
        bumpProductId: bump?.id ?? null,
        accessToken,
      })
      .run();
    if (slot) {
      tx.insert(bookings)
        .values({
          id: newId(),
          storeId: store.id,
          productId: product.id,
          orderId,
          startAt: slot.start,
          endAt: slot.end,
          status: "held",
          holdExpiresAt: new Date(now.getTime() + HOLD_MINUTES * 60_000),
        })
        .run();
    }
  });

  if (input.visitor) {
    await track({ storeId: store.id, productId: product.id, type: "checkout", visitor: input.visitor, source: input.source });
  }

  const successUrl = `${env.appUrl}/checkout/success?t=${accessToken}`;

  if (total === 0) {
    await markOrderPaid(orderId);
    return { orderId, accessToken, redirectUrl: successUrl };
  }

  if (stripeEnabled()) {
    if (!owner.stripeAccountId || !owner.stripeChargesEnabled) {
      throw new CheckoutError("This creator hasn't finished setting up payments yet.");
    }
    const lineName = bump ? `${product.title} + ${bump.title}` : product.title;
    const isSub = product.type === "membership";
    const params: Stripe.Checkout.SessionCreateParams = {
      mode: isSub ? "subscription" : "payment",
      customer_email: email,
      client_reference_id: orderId,
      metadata: { orderId, kind: "order" },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: store.currency,
            unit_amount: total,
            product_data: { name: lineName.slice(0, 250) },
            ...(isSub ? { recurring: { interval: product.settings.interval ?? "month" } } : {}),
          },
        },
      ],
      success_url: successUrl,
      cancel_url: `${env.appUrl}/${store.slug}/p/${product.id}`,
      expires_at: Math.floor(Date.now() / 1000) + HOLD_MINUTES * 60,
    };
    if (isSub) {
      params.subscription_data = {
        metadata: { orderId },
        ...(plan.transactionFeePercent > 0 ? { application_fee_percent: plan.transactionFeePercent } : {}),
      };
    } else {
      params.payment_intent_data = { metadata: { orderId }, ...(fee > 0 ? { application_fee_amount: fee } : {}) };
    }
    const session = await stripe().checkout.sessions.create(params, { stripeAccount: owner.stripeAccountId });
    await db.update(orders).set({ stripeSessionId: session.id }).where(eq(orders.id, orderId)).run();
    return { orderId, accessToken, redirectUrl: session.url! };
  }

  if (demoPaymentsEnabled()) {
    return { orderId, accessToken, redirectUrl: `${env.appUrl}/checkout/demo?t=${accessToken}` };
  }
  throw new CheckoutError("Payments are not configured on this server.");
}

/** Products an order unlocks: the main product, any order bump, and bundle contents. */
export async function unlockedProducts(order: Order): Promise<Product[]> {
  const main = await db.select().from(products).where(eq(products.id, order.productId)).get();
  if (!main) return [];
  const ids = new Set<string>();
  if (order.bumpProductId) ids.add(order.bumpProductId);
  if (main.type === "bundle") for (const id of main.settings.bundleProductIds ?? []) ids.add(id);
  ids.delete(main.id);
  const extras = ids.size
    ? await db
        .select()
        .from(products)
        .where(and(eq(products.storeId, order.storeId), inArray(products.id, [...ids])))
        .all()
    : [];
  return [main, ...extras.filter((p) => p.type !== "bundle")];
}

/**
 * Mark an order paid and deliver it. Safe to call more than once (webhook
 * retries, success-page checks); only the first call has any effect.
 */
export async function markOrderPaid(
  orderId: string,
  extra: { paymentIntentId?: string | null; subscriptionId?: string | null } = {},
): Promise<boolean> {
  const now = new Date();
  const changed = db.transaction((tx) => {
    const res = tx
      .update(orders)
      .set({
        status: "paid",
        paidAt: now,
        stripePaymentIntentId: extra.paymentIntentId ?? undefined,
        stripeSubscriptionId: extra.subscriptionId ?? undefined,
      })
      .where(and(eq(orders.id, orderId), inArray(orders.status, ["pending", "expired"])))
      .run();
    if (res.changes === 0) return false;
    const order = tx.select().from(orders).where(eq(orders.id, orderId)).get()!;
    if (order.couponId) {
      tx.update(coupons)
        .set({ redemptions: sql`${coupons.redemptions} + 1` })
        .where(eq(coupons.id, order.couponId))
        .run();
    }
    tx.update(bookings)
      .set({ status: "confirmed", holdExpiresAt: null })
      .where(and(eq(bookings.orderId, orderId), eq(bookings.status, "held")))
      .run();
    return true;
  });
  if (!changed) return false;
  await afterPaid(orderId);
  return true;
}

async function afterPaid(orderId: string) {
  const order = (await db.select().from(orders).where(eq(orders.id, orderId)).get())!;
  const store = (await db.select().from(stores).where(eq(stores.id, order.storeId)).get())!;
  const owner = (await db.select().from(users).where(eq(users.id, store.userId)).get())!;
  const product = (await db.select().from(products).where(eq(products.id, order.productId)).get())!;
  const booking = await db.select().from(bookings).where(eq(bookings.orderId, orderId)).get();

  const isLead = order.totalCents === 0;
  const { contact, created } = await upsertContact({
    storeId: store.id,
    email: order.buyerEmail,
    name: order.buyerName,
    source: product.title,
    tags: [isLead ? "lead" : "customer", product.type],
    spentCents: order.totalCents,
  });
  if (contact) {
    if (created) await startSequences({ storeId: store.id, contact, trigger: "new_contact" });
    await startSequences({
      storeId: store.id,
      contact,
      trigger: product.type === "lead_magnet" ? "lead_magnet" : "purchase",
      productId: product.id,
    });
  }

  await track({
    storeId: store.id,
    productId: product.id,
    type: "purchase",
    visitor: `order:${order.id}`,
    amountCents: order.totalCents,
  });

  const accessUrl = `${env.appUrl}/access/${order.accessToken}`;
  const lines = [
    `Hi ${order.buyerName || "there"},`,
    "",
    isLead ? `Here's your **${product.title}** from **${store.displayName}**.` : `Thanks for your order from **${store.displayName}**!`,
    "",
    `**${product.title}**${order.totalCents ? ` — ${formatMoney(order.totalCents, order.currency)}` : ""}`,
  ];
  if (booking) {
    lines.push("", `Your call is booked for **${formatSlot(booking.startAt, store.timezone)}**.`);
    if (product.settings.meetingUrl) lines.push(`Join here: [${product.settings.meetingUrl}](${product.settings.meetingUrl})`);
  }
  lines.push("", `[Open your purchase](${accessUrl})`, "", "Keep this email — the link above is your personal access link.");
  if (product.settings.thankYouMessage) lines.push("", product.settings.thankYouMessage);

  await safeSend(() =>
    sendEmail({
      to: order.buyerEmail,
      subject: isLead ? `Your ${product.title}` : `Your order: ${product.title}`,
      body: lines.join("\n"),
      fromName: store.displayName,
      replyTo: owner.email,
    }),
  );
  await safeSend(() =>
    sendEmail({
      to: owner.email,
      subject: isLead
        ? `New lead: ${order.buyerEmail}`
        : `New sale: ${product.title} (${formatMoney(order.totalCents, order.currency)})`,
      body: [
        `**${order.buyerName || order.buyerEmail}** just ${isLead ? "signed up for" : "bought"} **${product.title}**.`,
        booking ? `\nCall time: ${formatSlot(booking.startAt, store.timezone)}` : "",
        `\n[View in dashboard](${env.appUrl}/dashboard/orders)`,
      ].join("\n"),
    }),
  );
}

async function safeSend(fn: () => Promise<void>) {
  try {
    await fn();
  } catch (err) {
    console.error("[email] send failed", err);
  }
}

export async function markOrderRefunded(orderId: string) {
  await db
    .update(orders)
    .set({ status: "refunded" })
    .where(and(eq(orders.id, orderId), eq(orders.status, "paid")))
    .run();
  await db.update(bookings).set({ status: "canceled" }).where(eq(bookings.orderId, orderId)).run();
}

export async function expireOrder(orderId: string) {
  await db
    .update(orders)
    .set({ status: "expired" })
    .where(and(eq(orders.id, orderId), eq(orders.status, "pending")))
    .run();
  await db
    .update(bookings)
    .set({ status: "canceled" })
    .where(and(eq(bookings.orderId, orderId), eq(bookings.status, "held")))
    .run();
}

export async function cancelMembership(subscriptionId: string) {
  await db
    .update(orders)
    .set({ status: "canceled" })
    .where(and(eq(orders.stripeSubscriptionId, subscriptionId), eq(orders.status, "paid")))
    .run();
}

export async function orderByToken(token: string) {
  if (!token || token.length > 64) return null;
  const row = await db
    .select({ order: orders, store: stores, product: products })
    .from(orders)
    .innerJoin(stores, eq(stores.id, orders.storeId))
    .innerJoin(products, eq(products.id, orders.productId))
    .where(eq(orders.accessToken, token))
    .get();
  return row ?? null;
}

/** If the webhook hasn't arrived yet, ask Stripe directly whether the order was paid. */
export async function reconcileWithStripe(order: Order, store: Store): Promise<boolean> {
  if (order.status !== "pending" || !order.stripeSessionId || !stripeEnabled()) return false;
  const owner = await db.select().from(users).where(eq(users.id, store.userId)).get();
  if (!owner?.stripeAccountId) return false;
  const session = await stripe().checkout.sessions.retrieve(order.stripeSessionId, {}, { stripeAccount: owner.stripeAccountId });
  if (session.payment_status === "paid" || session.payment_status === "no_payment_required") {
    return markOrderPaid(order.id, {
      paymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : (session.payment_intent?.id ?? null),
      subscriptionId: typeof session.subscription === "string" ? session.subscription : (session.subscription?.id ?? null),
    });
  }
  return false;
}
