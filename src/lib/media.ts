import { and, eq } from "drizzle-orm";
import { db } from "./db";
import { media } from "./db/schema";
import { newId } from "./ids";
import { deleteUpload, saveUpload } from "./storage";

/** Save an uploaded file for a store. Returns null when no file was chosen. */
export async function uploadMedia(storeId: string, value: FormDataEntryValue | null, kind: "image" | "file"): Promise<string | null> {
  if (!value || typeof value === "string" || value.size === 0) return null;
  const id = newId();
  const stored = await saveUpload(id, value, kind);
  await db.insert(media).values({ id, storeId, kind, ...stored });
  return id;
}

export async function removeMedia(storeId: string, id: string | null | undefined) {
  if (!id) return;
  const row = await db.select().from(media).where(and(eq(media.id, id), eq(media.storeId, storeId))).get();
  if (!row) return;
  await db.delete(media).where(eq(media.id, id)).run();
  await deleteUpload(id).catch(() => {});
}

export function mediaUrl(id: string | null | undefined): string | null {
  return id ? `/media/${id}` : null;
}
