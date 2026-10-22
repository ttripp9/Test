"use server";

import { redirect } from "next/navigation";
import { markOrderPaid, orderByToken } from "@/lib/commerce";
import { demoPaymentsEnabled } from "@/lib/env";

export async function completeDemoPayment(form: FormData) {
  if (!demoPaymentsEnabled()) throw new Error("Demo payments are disabled.");
  const token = String(form.get("t") ?? "");
  const row = await orderByToken(token);
  if (!row) redirect("/");
  await markOrderPaid(row.order.id, { paymentIntentId: `demo_${row.order.id}` });
  redirect(`/checkout/success?t=${encodeURIComponent(token)}`);
}
