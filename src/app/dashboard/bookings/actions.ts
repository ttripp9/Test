"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireCreator } from "@/lib/auth";
import { formatSlot } from "@/lib/booking";
import { db } from "@/lib/db";
import { bookings, orders, products } from "@/lib/db/schema";
import { sendEmail } from "@/lib/mailer";

export async function cancelBooking(form: FormData) {
  const { store } = await requireCreator();
  const b = await db.select().from(bookings).where(and(eq(bookings.id, String(form.get("id") ?? "")), eq(bookings.storeId, store.id))).get();
  if (!b || b.status === "canceled") return;
  await db.update(bookings).set({ status: "canceled" }).where(eq(bookings.id, b.id)).run();
  const order = await db.select().from(orders).where(eq(orders.id, b.orderId)).get();
  const product = await db.select().from(products).where(eq(products.id, b.productId)).get();
  if (order) {
    await sendEmail({
      to: order.buyerEmail,
      subject: `Your call on ${formatSlot(b.startAt, store.timezone)} was canceled`,
      body: `Hi ${order.buyerName || "there"},\n\n${store.displayName} had to cancel your **${product?.title ?? "call"}** on ${formatSlot(b.startAt, store.timezone)}. They'll be in touch about a refund or a new time.`,
      fromName: store.displayName,
    }).catch(() => {});
  }
  revalidatePath("/dashboard/bookings");
}
