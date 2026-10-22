"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import type { FormState } from "@/components/forms";
import { requireCreator } from "@/lib/auth";
import { startSequences } from "@/lib/automation";
import { upsertContact } from "@/lib/contacts";
import { db } from "@/lib/db";
import { contacts } from "@/lib/db/schema";
import { isEmail } from "@/lib/safe";

export async function addContacts(_: FormState, form: FormData): Promise<FormState> {
  const { store } = await requireCreator();
  const tag = String(form.get("tag") ?? "").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 30);
  const lines = String(form.get("emails") ?? "").split(/[\n,;]+/).map((l) => l.trim()).filter(Boolean).slice(0, 2000);
  let added = 0;
  let invalid = 0;
  for (const line of lines) {
    const m = /^(?:(.*?)\s*<)?([^<>\s]+@[^<>\s]+)>?$/.exec(line);
    const email = m?.[2]?.toLowerCase() ?? "";
    if (!isEmail(email)) {
      invalid++;
      continue;
    }
    const { contact, created, limitReached } = await upsertContact({ storeId: store.id, email, name: m?.[1]?.replace(/"/g, "") ?? "", source: "import", tags: tag ? [tag] : [] });
    if (limitReached) return { error: `Added ${added}. You've hit your plan's contact limit — upgrade to add more.` };
    if (created && contact) {
      added++;
      if (form.get("welcome") === "on") await startSequences({ storeId: store.id, contact, trigger: "new_contact" });
    }
  }
  revalidatePath("/dashboard/customers");
  return { ok: `Added ${added} new contact${added === 1 ? "" : "s"}${invalid ? ` (${invalid} invalid skipped)` : ""}.` };
}

export async function toggleSubscribed(form: FormData) {
  const { store } = await requireCreator();
  const id = String(form.get("id") ?? "");
  const c = await db.select().from(contacts).where(and(eq(contacts.id, id), eq(contacts.storeId, store.id))).get();
  if (!c) return;
  await db.update(contacts).set({ subscribed: !c.subscribed }).where(eq(contacts.id, c.id)).run();
  revalidatePath("/dashboard/customers");
}

export async function deleteContact(form: FormData) {
  const { store } = await requireCreator();
  await db.delete(contacts).where(and(eq(contacts.id, String(form.get("id") ?? "")), eq(contacts.storeId, store.id))).run();
  revalidatePath("/dashboard/customers");
}
