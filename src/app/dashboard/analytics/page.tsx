import { eq } from "drizzle-orm";
import Link from "next/link";
import { BarChart } from "@/components/charts";
import { Card, Empty, PageHeader, Stat, Table, Td, cx } from "@/components/ui";
import { summarize } from "@/lib/analytics";
import { requireCreator } from "@/lib/auth";
import { db } from "@/lib/db";
import { products } from "@/lib/db/schema";
import { formatMoney } from "@/lib/money";

const RANGES = [7, 30, 90];

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const { store } = await requireCreator();
  const days = RANGES.includes(Number((await searchParams).days)) ? Number((await searchParams).days) : 30;
  const s = await summarize(store.id, days);
  const titles = new Map((await db.select({ id: products.id, title: products.title }).from(products).where(eq(products.storeId, store.id)).all()).map((p) => [p.id, p.title]));
  const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 1000) / 10}%` : "—");
  return (
    <>
      <PageHeader
        title="Analytics"
        description="Privacy-friendly: no cookies, visitors are counted with a daily-rotating anonymous ID."
        actions={RANGES.map((r) => (
          <Link key={r} href={`/dashboard/analytics?days=${r}`} className={cx("rounded-full px-3 py-1 text-sm ring-1", r === days ? "bg-slate-900 text-white ring-slate-900" : "bg-white ring-slate-200")}>
            {r} days
          </Link>
        ))}
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Visitors" value={s.visitors} />
        <Stat label="Page views" value={s.views} />
        <Stat label="Checkouts started" value={s.checkouts} />
        <Stat label="Sales" value={s.purchases} sub={`${s.conversionRate}% of visitors`} />
        <Stat label="Revenue" value={formatMoney(s.revenueCents, store.currency)} />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="Visitors per day">
          <BarChart data={s.daily.map((d) => ({ label: d.day.slice(5), value: d.visitors }))} />
        </Card>
        <Card title="Revenue per day">
          <BarChart money currency={store.currency} data={s.daily.map((d) => ({ label: d.day.slice(5), value: d.revenueCents }))} />
        </Card>
        <Card title="Where visitors come from">
          {s.sources.length === 0 ? (
            <Empty title="No visits yet" />
          ) : (
            <Table head={["Source", "Visitors", "Sales"]}>
              {s.sources.map((r) => (
                <tr key={r.source}>
                  <Td className="font-medium capitalize">{r.source}</Td>
                  <Td className="tabular-nums">{r.visitors}</Td>
                  <Td className="tabular-nums">{r.purchases}</Td>
                </tr>
              ))}
            </Table>
          )}
          <p className="mt-3 text-xs text-slate-500">Tip: add <code>?utm_source=instagram</code> to links you share to see exactly which ones work.</p>
        </Card>
        <Card title="Product funnel">
          {s.products.length === 0 ? (
            <Empty title="No product activity yet" />
          ) : (
            <Table head={["Product", "Views", "Clicks", "Sales", "Conv.", "Revenue"]}>
              {s.products
                .sort((a, b) => b.revenueCents - a.revenueCents || b.views - a.views)
                .map((r) => (
                  <tr key={r.productId}>
                    <Td className="max-w-[12rem] truncate font-medium">{titles.get(r.productId) ?? "Deleted"}</Td>
                    <Td className="tabular-nums">{r.views}</Td>
                    <Td className="tabular-nums">{r.clicks}</Td>
                    <Td className="tabular-nums">{r.purchases}</Td>
                    <Td className="tabular-nums">{pct(r.purchases, r.views)}</Td>
                    <Td className="tabular-nums">{formatMoney(r.revenueCents, store.currency)}</Td>
                  </tr>
                ))}
            </Table>
          )}
        </Card>
      </div>
    </>
  );
}
