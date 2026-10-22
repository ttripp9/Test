import { and, eq, sql } from "drizzle-orm";
import { db } from "./db";
import { orders } from "./db/schema";

export async function affiliateStats(storeId: string) {
  const rows = await db
    .select({
      affiliateId: orders.affiliateId,
      sales: sql<number>`count(*)`,
      revenue: sql<number>`sum(${orders.totalCents})`,
      commission: sql<number>`sum(${orders.affiliateCommissionCents})`,
    })
    .from(orders)
    .where(and(eq(orders.storeId, storeId), eq(orders.status, "paid"), sql`${orders.affiliateId} is not null`))
    .groupBy(orders.affiliateId)
    .all();
  return new Map(rows.map((r) => [r.affiliateId!, { sales: Number(r.sales), revenue: Number(r.revenue ?? 0), commission: Number(r.commission ?? 0) }]));
}
