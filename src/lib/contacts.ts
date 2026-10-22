import { and, count, eq, sql } from "drizzle-orm";
import { db } from "./db";
import { contacts, stores, users, type Contact } from "./db/schema";
import { newId, newToken } from "./ids";
import { getPlan } from "./plans";

/**
 * Add someone to a creator's list, or update them if they're already there.
 * Returns `created: true` only for brand-new contacts. If the plan's contact
 * limit is reached, new contacts are not added (sales still go through).
 */
export async function upsertContact(opts: {
  storeId: string;
  email: string;
  name?: string;
  source: string;
  tags?: string[];
  spentCents?: number;
}): Promise<{ contact: Contact | null; created: boolean; limitReached: boolean }> {
  const email = opts.email.trim().toLowerCase();
  const existing = await db
    .select()
    .from(contacts)
    .where(and(eq(contacts.storeId, opts.storeId), eq(contacts.email, email)))
    .get();
  if (existing) {
    const tags = Array.from(new Set([...existing.tags, ...(opts.tags ?? [])])).slice(0, 50);
    const updated = await db
      .update(contacts)
      .set({
        name: existing.name || opts.name || "",
        tags,
        totalSpentCents: sql`${contacts.totalSpentCents} + ${opts.spentCents ?? 0}`,
      })
      .where(eq(contacts.id, existing.id))
      .returning()
      .get();
    return { contact: updated, created: false, limitReached: false };
  }

  const owner = await db
    .select({ plan: users.plan })
    .from(stores)
    .innerJoin(users, eq(users.id, stores.userId))
    .where(eq(stores.id, opts.storeId))
    .get();
  const plan = getPlan(owner?.plan);
  const total = (await db.select({ n: count() }).from(contacts).where(eq(contacts.storeId, opts.storeId)).get())?.n ?? 0;
  if (total >= plan.maxContacts) return { contact: null, created: false, limitReached: true };

  const contact = await db
    .insert(contacts)
    .values({
      id: newId(),
      storeId: opts.storeId,
      email,
      name: (opts.name ?? "").slice(0, 100),
      source: opts.source.slice(0, 60),
      tags: (opts.tags ?? []).slice(0, 50),
      unsubscribeToken: newToken(),
      totalSpentCents: opts.spentCents ?? 0,
    })
    .onConflictDoNothing()
    .returning()
    .get();
  if (!contact) {
    // Lost a race with a parallel insert; read the winner.
    const again = await db
      .select()
      .from(contacts)
      .where(and(eq(contacts.storeId, opts.storeId), eq(contacts.email, email)))
      .get();
    return { contact: again ?? null, created: false, limitReached: false };
  }
  return { contact, created: true, limitReached: false };
}

export function toCsv(rows: Contact[]): string {
  const cell = (v: string | number | boolean) => {
    let s = String(v);
    // Neutralise spreadsheet formula injection.
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return `"${s.replace(/"/g, '""')}"`;
  };
  const header = ["email", "name", "source", "tags", "subscribed", "total_spent", "joined"];
  const lines = rows.map((c) =>
    [c.email, c.name, c.source, c.tags.join(";"), c.subscribed, (c.totalSpentCents / 100).toFixed(2), c.createdAt.toISOString()]
      .map(cell)
      .join(","),
  );
  return [header.join(","), ...lines].join("\n");
}
