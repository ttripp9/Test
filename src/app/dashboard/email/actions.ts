"use server";

import { and, count, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "@/components/forms";
import { requireCreator } from "@/lib/auth";
import { queueBroadcast } from "@/lib/automation";
import { db } from "@/lib/db";
import { products, sequenceSteps, sequences, type SequenceTrigger } from "@/lib/db/schema";
import { newId } from "@/lib/ids";
import { getPlan } from "@/lib/plans";
import { rateLimit } from "@/lib/rate-limit";

const str = (f: FormData, k: string, max = 500) => String(f.get(k) ?? "").trim().slice(0, max);

async function ownedSequence(storeId: string, id: string) {
  const s = await db.select().from(sequences).where(and(eq(sequences.id, id), eq(sequences.storeId, storeId))).get();
  if (!s) throw new Error("Sequence not found");
  return s;
}

const TEMPLATES: Record<string, { name: string; trigger: SequenceTrigger; steps: { delayHours: number; subject: string; body: string }[] }> = {
  welcome: {
    name: "Welcome series",
    trigger: "new_contact",
    steps: [
      { delayHours: 0, subject: "Welcome, {{first_name}}! 👋", body: "Hi {{first_name}},\n\nThanks for joining me at **{{store_name}}**. Over the next few days I'll share my best tips.\n\nTalk soon!" },
      { delayHours: 48, subject: "My #1 tip for you", body: "Hi {{first_name}},\n\nHere's the single thing that made the biggest difference for me…\n\n(Write your tip here.)" },
      { delayHours: 120, subject: "Ready for the next step?", body: "Hi {{first_name}},\n\nIf you liked these tips, you'll love what's in my store.\n\n[Take a look]({{store_url}})" },
    ],
  },
  buyer: {
    name: "After purchase",
    trigger: "purchase",
    steps: [
      { delayHours: 24, subject: "How's it going?", body: "Hi {{first_name}},\n\nJust checking in — have you had a chance to dive in? Reply to this email if you have any questions." },
      { delayHours: 168, subject: "Quick favor?", body: "Hi {{first_name}},\n\nIf you've enjoyed it, would you share what you thought? Just hit reply — I read every message." },
    ],
  },
};

export async function createSequence(_: FormState, form: FormData): Promise<FormState> {
  const { user, store } = await requireCreator();
  const plan = getPlan(user.plan);
  const n = (await db.select({ n: count() }).from(sequences).where(eq(sequences.storeId, store.id)).get())?.n ?? 0;
  if (n >= plan.maxSequences) return { error: `Your plan includes ${plan.maxSequences} sequence${plan.maxSequences === 1 ? "" : "s"}. Upgrade for more.` };
  const template = TEMPLATES[str(form, "template", 20)];
  const trigger = (str(form, "trigger", 20) || template?.trigger || "new_contact") as SequenceTrigger;
  if (!["new_contact", "lead_magnet", "purchase"].includes(trigger)) return { error: "Pick a trigger." };
  let productId: string | null = str(form, "productId", 32) || null;
  if (productId) {
    const p = await db.select({ id: products.id }).from(products).where(and(eq(products.id, productId), eq(products.storeId, store.id))).get();
    productId = p?.id ?? null;
  }
  const id = newId();
  const name = str(form, "name", 80) || template?.name || "New sequence";
  db.transaction((tx) => {
    tx.insert(sequences).values({ id, storeId: store.id, name, trigger, productId, active: false }).run();
    (template?.steps ?? [{ delayHours: 0, subject: "Hi {{first_name}}", body: "Write your email here." }]).forEach((s, i) =>
      tx.insert(sequenceSteps).values({ id: newId(), sequenceId: id, position: i, ...s }).run(),
    );
  });
  redirect(`/dashboard/email/${id}`);
}

export async function saveSequence(_: FormState, form: FormData): Promise<FormState> {
  const { store } = await requireCreator();
  const seq = await ownedSequence(store.id, str(form, "id", 32));
  await db
    .update(sequences)
    .set({ name: str(form, "name", 80) || seq.name, active: form.get("active") === "on" })
    .where(eq(sequences.id, seq.id))
    .run();
  revalidatePath(`/dashboard/email/${seq.id}`);
  return { ok: form.get("active") === "on" ? "Saved — sequence is on." : "Saved — sequence is off." };
}

export async function saveStep(_: FormState, form: FormData): Promise<FormState> {
  const { store } = await requireCreator();
  const seq = await ownedSequence(store.id, str(form, "sequenceId", 32));
  const subject = str(form, "subject", 200);
  const body = str(form, "body", 20000);
  if (!subject || !body) return { error: "Add a subject and a message." };
  const delayHours = Math.max(0, Math.min(24 * 365, Math.round(Number(form.get("delayDays") ?? 0) * 24)));
  await db
    .update(sequenceSteps)
    .set({ subject, body, delayHours })
    .where(and(eq(sequenceSteps.id, str(form, "stepId", 32)), eq(sequenceSteps.sequenceId, seq.id)))
    .run();
  revalidatePath(`/dashboard/email/${seq.id}`);
  return { ok: "Email saved." };
}

export async function addStep(form: FormData) {
  const { store } = await requireCreator();
  const seq = await ownedSequence(store.id, str(form, "sequenceId", 32));
  const steps = await db.select().from(sequenceSteps).where(eq(sequenceSteps.sequenceId, seq.id)).all();
  if (steps.length >= 30) return;
  const last = Math.max(0, ...steps.map((s) => s.delayHours));
  await db.insert(sequenceSteps).values({ id: newId(), sequenceId: seq.id, position: steps.length, delayHours: last + 48, subject: "New email", body: "Hi {{first_name}},\n\n" }).run();
  revalidatePath(`/dashboard/email/${seq.id}`);
}

export async function deleteStep(form: FormData) {
  const { store } = await requireCreator();
  const seq = await ownedSequence(store.id, str(form, "sequenceId", 32));
  await db.delete(sequenceSteps).where(and(eq(sequenceSteps.id, str(form, "stepId", 32)), eq(sequenceSteps.sequenceId, seq.id))).run();
  revalidatePath(`/dashboard/email/${seq.id}`);
}

export async function deleteSequence(form: FormData) {
  const { store } = await requireCreator();
  const seq = await ownedSequence(store.id, str(form, "id", 32));
  await db.delete(sequences).where(eq(sequences.id, seq.id)).run();
  redirect("/dashboard/email");
}

export async function sendBroadcast(_: FormState, form: FormData): Promise<FormState> {
  const { store } = await requireCreator();
  if (!rateLimit(`broadcast:${store.id}`, 5, 24 * 3600_000).ok) return { error: "You can send up to 5 broadcasts a day." };
  const subject = str(form, "subject", 200);
  const body = str(form, "body", 20000);
  if (!subject || !body) return { error: "Add a subject and a message." };
  const tag = str(form, "tag", 30) || null;
  const { recipients } = await queueBroadcast({ storeId: store.id, subject, body, tag });
  revalidatePath("/dashboard/email");
  if (recipients === 0) return { error: "No subscribed contacts match — nothing was sent." };
  return { ok: `Sending to ${recipients} subscriber${recipients === 1 ? "" : "s"}.` };
}
