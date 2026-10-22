"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import type { FormState } from "@/components/forms";
import { requireCreator } from "@/lib/auth";
import { markOrderRefunded } from "@/lib/commerce";
import { db } from "@/lib/db";
import { orders, products } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { sendEmail } from "@/lib/mailer";
import { stripe, stripeEnabled } from "@/lib/stripe";

async function ownedOrder(storeId: string, id: string) {
  const o = await db.select().from(orders).where(and(eq(orders.id, id), eq(orders.storeId, storeId))).get();
  if (!o) throw new Error("Order not found");
  return o;
}

export async function refundOrder(_: FormState, form: FormData): Promise<FormState> {
  const { user, store } = await requireCreator();
  const order = await ownedOrder(store.id, String(form.get("id") ?? ""));
  if (order.status !== "paid") return { error: "Only paid orders can be refunded." };
  if (order.totalCents > 0 && stripeEnabled() && !order.stripePaymentIntentId?.startsWith("demo_")) {
    if (!user.stripeAccountId) return { error: "Connect Stripe first." };
    try {
      if (order.stripeSubscriptionId) {
        await stripe().subscriptions.cancel(order.stripeSubscriptionId, {}, { stripeAccount: user.stripeAccountId });
      }
      if (order.stripePaymentIntentId) {
        await stripe().refunds.create({ payment_intent: order.stripePaymentIntentId }, { stripeAccount: user.stripeAccountId });
      }
    } catch (e) {
      return { error: `Stripe said: ${(e as Error).message}` };
    }
  }
  await markOrderRefunded(order.id);
  revalidatePath("/dashboard/orders");
  return { ok: "Refunded and access removed." };
}

export async function resendAccess(_: FormState, form: FormData): Promise<FormState> {
  const { store } = await requireCreator();
  const order = await ownedOrder(store.id, String(form.get("id") ?? ""));
  if (order.status !== "paid") return { error: "This order isn't paid." };
  const product = await db.select().from(products).where(eq(products.id, order.productId)).get();
  await sendEmail({
    to: order.buyerEmail,
    subject: `Your access link: ${product?.title ?? "your purchase"}`,
    body: `Hi ${order.buyerName || "there"},\n\nHere's your access link again:\n\n[Open your purchase](${env.appUrl}/access/${order.accessToken})`,
    fromName: store.displayName,
  });
  return { ok: "Access email sent." };
}
