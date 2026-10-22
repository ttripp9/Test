import { and, asc, eq, inArray, isNull, lte, or } from "drizzle-orm";
import { db } from "./db";
import {
  broadcasts,
  contacts,
  emailQueue,
  sequenceSteps,
  sequences,
  stores,
  type Contact,
  type SequenceTrigger,
} from "./db/schema";
import { env } from "./env";
import { newId } from "./ids";
import { sendEmail } from "./mailer";

export function fillTemplate(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (m, key: string) => (key in vars ? vars[key] : m));
}

/** Queue every step of every matching active sequence for this contact. */
export async function startSequences(opts: {
  storeId: string;
  contact: Contact;
  trigger: SequenceTrigger;
  productId?: string | null;
  now?: Date;
}): Promise<number> {
  const now = (opts.now ?? new Date()).getTime();
  const triggers: SequenceTrigger[] = [opts.trigger];
  const matching = await db
    .select()
    .from(sequences)
    .where(
      and(
        eq(sequences.storeId, opts.storeId),
        eq(sequences.active, true),
        inArray(sequences.trigger, triggers),
        opts.productId
          ? or(isNull(sequences.productId), eq(sequences.productId, opts.productId))
          : isNull(sequences.productId),
      ),
    )
    .all();
  let queued = 0;
  for (const seq of matching) {
    const steps = await db.select().from(sequenceSteps).where(eq(sequenceSteps.sequenceId, seq.id)).all();
    for (const step of steps) {
      const res = await db
        .insert(emailQueue)
        .values({
          id: newId(),
          storeId: opts.storeId,
          contactId: opts.contact.id,
          stepId: step.id,
          sendAt: new Date(now + Math.max(0, step.delayHours) * 3_600_000),
        })
        .onConflictDoNothing()
        .run();
      queued += res.changes;
    }
  }
  return queued;
}

export async function queueBroadcast(opts: { storeId: string; subject: string; body: string; tag?: string | null }) {
  const broadcastId = newId();
  const recipients = (
    await db
      .select()
      .from(contacts)
      .where(and(eq(contacts.storeId, opts.storeId), eq(contacts.subscribed, true)))
      .all()
  ).filter((c) => !opts.tag || c.tags.includes(opts.tag));
  const now = new Date();
  db.transaction((tx) => {
    tx.insert(broadcasts)
      .values({
        id: broadcastId,
        storeId: opts.storeId,
        subject: opts.subject,
        body: opts.body,
        tag: opts.tag || null,
        recipientCount: recipients.length,
        sentAt: now,
      })
      .run();
    for (const c of recipients) {
      tx.insert(emailQueue)
        .values({ id: newId(), storeId: opts.storeId, contactId: c.id, broadcastId, sendAt: now })
        .run();
    }
  });
  return { broadcastId, recipients: recipients.length };
}

/** Send emails that are due. Safe to call from a cron job or a timer. */
export async function processEmailQueue(limit = 100, now = new Date()): Promise<{ sent: number; failed: number; skipped: number }> {
  const due = await db
    .select()
    .from(emailQueue)
    .where(and(eq(emailQueue.status, "queued"), lte(emailQueue.sendAt, now)))
    .orderBy(asc(emailQueue.sendAt))
    .limit(limit)
    .all();
  const result = { sent: 0, failed: 0, skipped: 0 };
  for (const item of due) {
    // Claim the row so two workers never send the same email.
    const claimed = await db
      .update(emailQueue)
      .set({ attempts: item.attempts + 1 })
      .where(and(eq(emailQueue.id, item.id), eq(emailQueue.attempts, item.attempts), eq(emailQueue.status, "queued")))
      .run();
    if (claimed.changes === 0) continue;

    const contact = await db.select().from(contacts).where(eq(contacts.id, item.contactId)).get();
    const store = await db.select().from(stores).where(eq(stores.id, item.storeId)).get();
    let subject = "";
    let body = "";
    if (item.stepId) {
      const step = await db
        .select({ step: sequenceSteps, active: sequences.active })
        .from(sequenceSteps)
        .innerJoin(sequences, eq(sequences.id, sequenceSteps.sequenceId))
        .where(eq(sequenceSteps.id, item.stepId))
        .get();
      if (step?.active) ({ subject, body } = step.step);
    } else if (item.broadcastId) {
      const b = await db.select().from(broadcasts).where(eq(broadcasts.id, item.broadcastId)).get();
      if (b) ({ subject, body } = b);
    }
    if (!contact || !store || !contact.subscribed || !subject) {
      await db.update(emailQueue).set({ status: "skipped" }).where(eq(emailQueue.id, item.id)).run();
      result.skipped++;
      continue;
    }
    const vars = {
      name: contact.name || "there",
      first_name: (contact.name || "there").split(" ")[0],
      email: contact.email,
      store_name: store.displayName,
      store_url: `${env.appUrl}/${store.slug}`,
    };
    try {
      await sendEmail({
        to: contact.email,
        subject: fillTemplate(subject, vars),
        body: fillTemplate(body, vars),
        fromName: store.displayName,
        unsubscribeUrl: `${env.appUrl}/u/${contact.unsubscribeToken}`,
      });
      await db.update(emailQueue).set({ status: "sent", sentAt: new Date() }).where(eq(emailQueue.id, item.id)).run();
      result.sent++;
    } catch (err) {
      const attempts = item.attempts + 1;
      await db
        .update(emailQueue)
        .set({
          status: attempts >= 3 ? "failed" : "queued",
          error: String((err as Error).message).slice(0, 500),
          sendAt: new Date(now.getTime() + attempts * 10 * 60_000),
        })
        .where(eq(emailQueue.id, item.id))
        .run();
      result.failed++;
    }
  }
  return result;
}
