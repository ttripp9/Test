import { and, eq, lt } from "drizzle-orm";
import { accessibleProduct } from "@/lib/access";
import { db } from "@/lib/db";
import { media, orders } from "@/lib/db/schema";
import { rateLimit } from "@/lib/rate-limit";
import { readUpload } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ token: string; productId: string }> }) {
  const { token, productId } = await params;
  if (!rateLimit(`dl:${token}`, 30, 60 * 60_000).ok) return new Response("Too many downloads. Try again later.", { status: 429 });
  const access = await accessibleProduct(token, productId);
  if (!access || !access.product.fileMediaId) return new Response("Not found", { status: 404 });
  const max = access.product.settings.maxDownloads ?? 20;
  // Atomically count the download and enforce the limit.
  const res = await db
    .update(orders)
    .set({ downloads: access.order.downloads + 1 })
    .where(and(eq(orders.id, access.order.id), eq(orders.downloads, access.order.downloads), lt(orders.downloads, max)))
    .run();
  if (res.changes === 0) return new Response("Download limit reached. Contact the creator for help.", { status: 403 });
  const file = await db.select().from(media).where(and(eq(media.id, access.product.fileMediaId), eq(media.storeId, access.store.id))).get();
  if (!file) return new Response("Not found", { status: 404 });
  const body = await readUpload(file.id);
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Length": String(body.length),
      "Content-Disposition": `attachment; filename="${file.filename.replace(/"/g, "")}"; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
