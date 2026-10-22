import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { classifySource, track, visitorId } from "@/lib/analytics";
import { db } from "@/lib/db";
import { affiliates, products } from "@/lib/db/schema";
import { rateLimit } from "@/lib/rate-limit";
import { loadStore } from "@/lib/storefront";

const Body = z.object({
  type: z.enum(["view", "click"]),
  slug: z.string().max(40),
  productId: z.string().max(32).optional().nullable(),
  referrer: z.string().max(2000).optional().nullable(),
  utm: z.string().max(100).optional().nullable(),
  ref: z.string().max(40).optional().nullable(),
});

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? req.headers.get("x-real-ip") ?? "unknown";
  if (!rateLimit(`track:${ip}`, 120, 60_000).ok) return new Response(null, { status: 429 });
  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(JSON.parse(await req.text()));
  } catch {
    return new Response(null, { status: 400 });
  }
  const data = await loadStore(body.slug);
  if (!data) return new Response(null, { status: 404 });
  let productId: string | null = null;
  if (body.productId) {
    const p = await db.select({ id: products.id }).from(products).where(and(eq(products.id, body.productId), eq(products.storeId, data.store.id))).get();
    productId = p?.id ?? null;
  }
  // Don't count a creator previewing their own store's referrer as a source.
  const referrer = body.referrer && !body.referrer.includes(new URL(req.url).host) ? body.referrer : null;
  const visitor = visitorId(ip, req.headers.get("user-agent") ?? "");
  await track({ storeId: data.store.id, productId, type: body.type, visitor, source: classifySource(referrer, body.utm ?? null) });

  if (body.type === "view" && body.ref && /^[A-Za-z0-9_-]{2,32}$/.test(body.ref) && rateLimit(`refclick:${visitor}:${body.ref}`, 1, 86_400_000).ok) {
    await db
      .update(affiliates)
      .set({ clicks: sql`${affiliates.clicks} + 1` })
      .where(and(eq(affiliates.storeId, data.store.id), eq(affiliates.code, body.ref.toUpperCase())))
      .run();
  }
  return new Response(null, { status: 204 });
}
