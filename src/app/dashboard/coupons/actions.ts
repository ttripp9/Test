"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import type { FormState } from "@/components/forms";
import { requireCreator } from "@/lib/auth";
import { db } from "@/lib/db";
import { coupons, products } from "@/lib/db/schema";
import { newId } from "@/lib/ids";
import { parseMoneyToCents } from "@/lib/money";

export async function createCoupon(_: FormState, form: FormData): Promise<FormState> {
  const { store } = await requireCreator();
  const code = String(form.get("code") ?? "").trim().toUpperCase();
  if (!/^[A-Z0-9_-]{3,30}$/.test(code)) return { error: "Codes are 3–30 letters, numbers, - or _." };
  const kind = String(form.get("kind") ?? "percent");
  const value = String(form.get("value") ?? "");
  let percentOff: number | null = null;
  let amountOffCents: number | null = null;
  if (kind === "percent") {
    percentOff = Number.parseInt(value, 10);
    if (!(percentOff >= 1 && percentOff <= 100)) return { error: "Percent must be 1–100." };
  } else {
    amountOffCents = parseMoneyToCents(value);
    if (!amountOffCents) return { error: "Enter an amount like 10 or 9.99." };
  }
  let productId: string | null = String(form.get("productId") ?? "") || null;
  if (productId) {
    const p = await db.select({ id: products.id }).from(products).where(and(eq(products.id, productId), eq(products.storeId, store.id))).get();
    productId = p?.id ?? null;
  }
  const max = Number.parseInt(String(form.get("maxRedemptions") ?? ""), 10);
  const expires = String(form.get("expiresAt") ?? "");
  const expiresAt = expires ? new Date(`${expires}T23:59:59`) : null;
  if (expiresAt && Number.isNaN(expiresAt.getTime())) return { error: "Pick a valid end date." };
  const res = await db
    .insert(coupons)
    .values({ id: newId(), storeId: store.id, code, percentOff, amountOffCents, productId, maxRedemptions: max > 0 ? max : null, expiresAt })
    .onConflictDoNothing()
    .run();
  if (res.changes === 0) return { error: "You already have a code with that name." };
  revalidatePath("/dashboard/coupons");
  return { ok: `Code ${code} created.` };
}

export async function toggleCoupon(form: FormData) {
  const { store } = await requireCreator();
  const c = await db.select().from(coupons).where(and(eq(coupons.id, String(form.get("id") ?? "")), eq(coupons.storeId, store.id))).get();
  if (!c) return;
  await db.update(coupons).set({ active: !c.active }).where(eq(coupons.id, c.id)).run();
  revalidatePath("/dashboard/coupons");
}
