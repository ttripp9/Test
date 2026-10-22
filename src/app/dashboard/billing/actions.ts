"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "@/components/forms";
import { requireCreator } from "@/lib/auth";
import { db } from "@/lib/db";
import { users, type PlanId } from "@/lib/db/schema";
import { demoPaymentsEnabled, env } from "@/lib/env";
import { stripe, stripeEnabled } from "@/lib/stripe";

export async function changePlan(_: FormState, form: FormData): Promise<FormState> {
  const { user } = await requireCreator();
  const plan = String(form.get("plan") ?? "") as PlanId;
  if (!["free", "pro", "business"].includes(plan)) return { error: "Unknown plan." };
  if (plan === user.plan) return { ok: "You're already on this plan." };

  if (stripeEnabled()) {
    if (user.stripeSubscriptionId) {
      // Existing subscribers change or cancel their plan in the Stripe billing portal.
      const portal = await stripe().billingPortal.sessions.create({ customer: user.stripeCustomerId!, return_url: `${env.appUrl}/dashboard/billing` });
      redirect(portal.url);
    }
    if (plan === "free") return { ok: "You're on the free plan." };
    const price = plan === "pro" ? env.stripePricePro : env.stripePriceBusiness;
    if (!price) return { error: "This plan isn't set up yet (missing Stripe price ID)." };
    const session = await stripe().checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price, quantity: 1 }],
      customer: user.stripeCustomerId ?? undefined,
      customer_email: user.stripeCustomerId ? undefined : user.email,
      client_reference_id: user.id,
      metadata: { kind: "plan", userId: user.id, plan },
      subscription_data: { metadata: { userId: user.id, plan } },
      allow_promotion_codes: true,
      success_url: `${env.appUrl}/dashboard/billing?upgraded=1`,
      cancel_url: `${env.appUrl}/dashboard/billing`,
    });
    redirect(session.url!);
  }
  if (demoPaymentsEnabled()) {
    await db.update(users).set({ plan }).where(eq(users.id, user.id)).run();
    revalidatePath("/dashboard", "layout");
    return { ok: `Switched to ${plan} (demo mode — no charge).` };
  }
  return { error: "Billing isn't configured on this server." };
}

export async function connectPayouts() {
  const { user } = await requireCreator();
  if (!stripeEnabled()) {
    if (demoPaymentsEnabled()) {
      await db.update(users).set({ stripeChargesEnabled: true }).where(eq(users.id, user.id)).run();
      revalidatePath("/dashboard", "layout");
      redirect("/dashboard/billing?connected=demo");
    }
    redirect("/dashboard/billing");
  }
  let accountId = user.stripeAccountId;
  if (!accountId) {
    const account = await stripe().accounts.create({
      type: "express",
      email: user.email,
      capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
      metadata: { userId: user.id },
    });
    accountId = account.id;
    await db.update(users).set({ stripeAccountId: accountId }).where(eq(users.id, user.id)).run();
  }
  const link = await stripe().accountLinks.create({
    account: accountId,
    type: "account_onboarding",
    refresh_url: `${env.appUrl}/dashboard/billing`,
    return_url: `${env.appUrl}/dashboard/billing?connected=1`,
  });
  redirect(link.url);
}

export async function openPayoutDashboard() {
  const { user } = await requireCreator();
  if (!stripeEnabled() || !user.stripeAccountId) redirect("/dashboard/billing");
  const link = await stripe().accounts.createLoginLink(user.stripeAccountId);
  redirect(link.url);
}

/** Refresh payout status straight from Stripe (used when returning from onboarding). */
export async function syncPayoutStatus(userId: string, accountId: string) {
  const account = await stripe().accounts.retrieve(accountId);
  await db.update(users).set({ stripeChargesEnabled: Boolean(account.charges_enabled) }).where(eq(users.id, userId)).run();
  return Boolean(account.charges_enabled);
}
