import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "./db";
import { events, orders, type EventType } from "./db/schema";
import { env } from "./env";
import { sha256 } from "./ids";

/** Cookie-free visitor id: a daily-rotating hash of IP + browser. No personal data is stored. */
export function visitorId(ip: string, ua: string, day = new Date().toISOString().slice(0, 10)): string {
  return sha256(`${env.analyticsSalt}|${day}|${ip}|${ua}`).slice(0, 16);
}

export function classifySource(referrer: string | null, utmSource: string | null): string {
  if (utmSource) return utmSource.toLowerCase().replace(/[^a-z0-9_.-]/g, "").slice(0, 40) || "direct";
  if (!referrer) return "direct";
  try {
    const host = new URL(referrer).hostname.replace(/^(www|m|l|lm)\./, "");
    const known: Record<string, string> = {
      "instagram.com": "instagram",
      "tiktok.com": "tiktok",
      "youtube.com": "youtube",
      "youtu.be": "youtube",
      "t.co": "x",
      "x.com": "x",
      "twitter.com": "x",
      "facebook.com": "facebook",
      "linkedin.com": "linkedin",
      "threads.net": "threads",
      "google.com": "google",
      "pinterest.com": "pinterest",
      "reddit.com": "reddit",
    };
    return known[host] ?? host.slice(0, 40);
  } catch {
    return "direct";
  }
}

export async function track(e: {
  storeId: string;
  productId?: string | null;
  type: EventType;
  visitor: string;
  source?: string;
  amountCents?: number;
}) {
  await db.insert(events).values({
    storeId: e.storeId,
    productId: e.productId ?? null,
    type: e.type,
    visitor: e.visitor,
    source: e.source ?? "direct",
    amountCents: e.amountCents ?? 0,
  });
}

export type Summary = {
  visitors: number;
  views: number;
  clicks: number;
  checkouts: number;
  purchases: number;
  revenueCents: number;
  conversionRate: number;
  daily: { day: string; visitors: number; revenueCents: number }[];
  sources: { source: string; visitors: number; purchases: number }[];
  products: { productId: string; views: number; clicks: number; purchases: number; revenueCents: number }[];
};

/** Revenue from paid (not refunded) orders, by day. This is the source of truth for money. */
export async function revenueByDay(storeId: string, days: number) {
  const since = new Date(Date.now() - days * 86_400_000);
  const dayExpr = sql<string>`strftime('%Y-%m-%d', ${orders.paidAt} / 1000, 'unixepoch')`;
  const rows = await db
    .select({ day: dayExpr, revenue: sql<number>`sum(${orders.totalCents})`, sales: sql<number>`count(*)` })
    .from(orders)
    .where(and(eq(orders.storeId, storeId), eq(orders.status, "paid"), gte(orders.paidAt, since)))
    .groupBy(dayExpr)
    .all();
  return new Map(rows.map((r) => [r.day, { revenueCents: Number(r.revenue ?? 0), sales: Number(r.sales ?? 0) }]));
}

export async function summarize(storeId: string, days = 30): Promise<Summary> {
  const since = new Date(Date.now() - days * 86_400_000);
  const money = await revenueByDay(storeId, days);
  const where = and(eq(events.storeId, storeId), gte(events.createdAt, since));
  const totals = await db
    .select({
      visitors: sql<number>`count(distinct ${events.visitor})`,
      views: sql<number>`sum(case when ${events.type} = 'view' then 1 else 0 end)`,
      clicks: sql<number>`sum(case when ${events.type} = 'click' then 1 else 0 end)`,
      checkouts: sql<number>`sum(case when ${events.type} = 'checkout' then 1 else 0 end)`,
      purchases: sql<number>`sum(case when ${events.type} = 'purchase' then 1 else 0 end)`,
      revenue: sql<number>`sum(case when ${events.type} = 'purchase' then ${events.amountCents} else 0 end)`,
    })
    .from(events)
    .where(where)
    .get();

  const dayExpr = sql<string>`strftime('%Y-%m-%d', ${events.createdAt} / 1000, 'unixepoch')`;
  const dailyRows = await db
    .select({
      day: dayExpr,
      visitors: sql<number>`count(distinct ${events.visitor})`,
      revenue: sql<number>`sum(case when ${events.type} = 'purchase' then ${events.amountCents} else 0 end)`,
    })
    .from(events)
    .where(where)
    .groupBy(dayExpr)
    .all();
  const byDay = new Map(dailyRows.map((r) => [r.day, r]));
  const daily = Array.from({ length: days }, (_, i) => {
    const day = new Date(Date.now() - (days - 1 - i) * 86_400_000).toISOString().slice(0, 10);
    const r = byDay.get(day);
    return { day, visitors: Number(r?.visitors ?? 0), revenueCents: money.get(day)?.revenueCents ?? 0 };
  });

  const sources = (
    await db
      .select({
        source: events.source,
        visitors: sql<number>`count(distinct ${events.visitor})`,
        purchases: sql<number>`sum(case when ${events.type} = 'purchase' then 1 else 0 end)`,
      })
      .from(events)
      .where(where)
      .groupBy(events.source)
      .orderBy(sql`2 desc`)
      .limit(10)
      .all()
  ).map((r) => ({ source: r.source, visitors: Number(r.visitors), purchases: Number(r.purchases ?? 0) }));

  const products = (
    await db
      .select({
        productId: events.productId,
        views: sql<number>`sum(case when ${events.type} = 'view' then 1 else 0 end)`,
        clicks: sql<number>`sum(case when ${events.type} = 'click' then 1 else 0 end)`,
        purchases: sql<number>`sum(case when ${events.type} = 'purchase' then 1 else 0 end)`,
        revenue: sql<number>`sum(case when ${events.type} = 'purchase' then ${events.amountCents} else 0 end)`,
      })
      .from(events)
      .where(and(where, sql`${events.productId} is not null`))
      .groupBy(events.productId)
      .all()
  ).map((r) => ({
    productId: r.productId!,
    views: Number(r.views ?? 0),
    clicks: Number(r.clicks ?? 0),
    purchases: Number(r.purchases ?? 0),
    revenueCents: Number(r.revenue ?? 0),
  }));

  const visitors = Number(totals?.visitors ?? 0);
  const purchases = [...money.values()].reduce((n, d) => n + d.sales, 0);
  return {
    visitors,
    views: Number(totals?.views ?? 0),
    clicks: Number(totals?.clicks ?? 0),
    checkouts: Number(totals?.checkouts ?? 0),
    purchases,
    revenueCents: [...money.values()].reduce((n, d) => n + d.revenueCents, 0),
    conversionRate: visitors ? Math.round((purchases / visitors) * 1000) / 10 : 0,
    daily,
    sources,
    products,
  };
}
