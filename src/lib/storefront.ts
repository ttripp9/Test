import { and, asc, eq } from "drizzle-orm";
import { cache } from "react";
import { db } from "./db";
import { products, stores, users } from "./db/schema";
import { getPlan } from "./plans";

export const loadStore = cache(async (slug: string) => {
  if (!/^[a-z0-9-]{3,32}$/.test(slug)) return null;
  const row = await db
    .select({ store: stores, plan: users.plan, chargesEnabled: users.stripeChargesEnabled })
    .from(stores)
    .innerJoin(users, eq(users.id, stores.userId))
    .where(eq(stores.slug, slug))
    .get();
  if (!row || !row.store.published) return null;
  return { store: row.store, plan: getPlan(row.plan), chargesEnabled: row.chargesEnabled };
});

export async function storeProducts(storeId: string) {
  return db
    .select()
    .from(products)
    .where(and(eq(products.storeId, storeId), eq(products.active, true), eq(products.archived, false)))
    .orderBy(asc(products.position), asc(products.createdAt))
    .all();
}
