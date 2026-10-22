"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import type { FormState } from "@/components/forms";
import { requireCreator } from "@/lib/auth";
import { db } from "@/lib/db";
import { affiliates } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { newId, newToken } from "@/lib/ids";
import { sendEmail } from "@/lib/mailer";
import { parseMoneyToCents } from "@/lib/money";
import { getPlan } from "@/lib/plans";
import { isEmail } from "@/lib/safe";

export async function createAffiliate(_: FormState, form: FormData): Promise<FormState> {
  const { user, store } = await requireCreator();
  if (!getPlan(user.plan).affiliates) return { error: "Affiliates are on the Pro plan and up." };
  const name = String(form.get("name") ?? "").trim().slice(0, 80);
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const code = String(form.get("code") ?? "").trim().toUpperCase();
  const pct = Number.parseInt(String(form.get("commission") ?? "20"), 10);
  if (!name) return { error: "Add their name." };
  if (!isEmail(email)) return { error: "Add a valid email." };
  if (!/^[A-Z0-9_-]{2,32}$/.test(code)) return { error: "Codes are 2–32 letters, numbers, - or _." };
  if (!(pct >= 1 && pct <= 90)) return { error: "Commission must be 1–90%." };
  const portalToken = newToken();
  const res = await db.insert(affiliates).values({ id: newId(), storeId: store.id, name, email, code, commissionPercent: pct, portalToken }).onConflictDoNothing().run();
  if (res.changes === 0) return { error: "That code is already used." };
  if (form.get("notify") === "on") {
    await sendEmail({
      to: email,
      subject: `You're an affiliate for ${store.displayName}!`,
      body: `Hi ${name},\n\nYou'll earn **${pct}%** on every sale you refer.\n\nYour link: ${env.appUrl}/${store.slug}?ref=${code}\n\n[See your stats](${env.appUrl}/aff/${portalToken})`,
      fromName: store.displayName,
    }).catch(() => {});
  }
  revalidatePath("/dashboard/affiliates");
  return { ok: `${name} added.` };
}

export async function recordPayout(_: FormState, form: FormData): Promise<FormState> {
  const { store } = await requireCreator();
  const a = await db.select().from(affiliates).where(and(eq(affiliates.id, String(form.get("id") ?? "")), eq(affiliates.storeId, store.id))).get();
  if (!a) return { error: "Not found." };
  const cents = parseMoneyToCents(String(form.get("amount") ?? ""));
  if (!cents) return { error: "Enter the amount you paid." };
  await db.update(affiliates).set({ paidOutCents: a.paidOutCents + cents }).where(eq(affiliates.id, a.id)).run();
  revalidatePath("/dashboard/affiliates");
  return { ok: "Payout recorded." };
}

export async function toggleAffiliate(form: FormData) {
  const { store } = await requireCreator();
  const a = await db.select().from(affiliates).where(and(eq(affiliates.id, String(form.get("id") ?? "")), eq(affiliates.storeId, store.id))).get();
  if (!a) return;
  await db.update(affiliates).set({ active: !a.active }).where(eq(affiliates.id, a.id)).run();
  revalidatePath("/dashboard/affiliates");
}
