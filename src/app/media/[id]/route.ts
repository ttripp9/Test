import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { media } from "@/lib/db/schema";
import { readUpload } from "@/lib/storage";

export const dynamic = "force-dynamic";

/** Public images only (avatars and covers). Product files are served through access links. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[A-Za-z0-9]{16}$/.test(id)) return new Response("Not found", { status: 404 });
  const row = await db.select().from(media).where(and(eq(media.id, id), eq(media.kind, "image"))).get();
  if (!row) return new Response("Not found", { status: 404 });
  const body = await readUpload(id).catch(() => null);
  if (!body) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": row.mimeType,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
