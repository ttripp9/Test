import { eq } from "drizzle-orm";
import { db } from "./db";
import { contacts, emailQueue } from "./db/schema";
import { and } from "drizzle-orm";

export async function unsubscribe(token: string) {
  if (!token || token.length > 64) return null;
  const c = await db.select().from(contacts).where(eq(contacts.unsubscribeToken, token)).get();
  if (!c) return null;
  await db.update(contacts).set({ subscribed: false }).where(eq(contacts.id, c.id)).run();
  await db.update(emailQueue).set({ status: "skipped" }).where(and(eq(emailQueue.contactId, c.id), eq(emailQueue.status, "queued"))).run();
  return c;
}
