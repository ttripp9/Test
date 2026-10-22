import { and, count, desc, eq, sql } from "drizzle-orm";
import Link from "next/link";
import { BarChart } from "@/components/charts";
import { CopyButton } from "@/components/forms";
import { Badge, Card, Empty, LinkButton, PageHeader, Stat } from "@/components/ui";
import { summarize } from "@/lib/analytics";
import { requireCreator } from "@/lib/auth";
import { db } from "@/lib/db";
import { contacts, orders, products, sequences } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { formatMoney } from "@/lib/money";

export default async function DashboardHome({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const { user, store } = await requireCreator();
  const { welcome } = await searchParams;
  const [stats, productCount, contactCount, seqCount, recent, lifetime] = await Promise.all([
    summarize(store.id, 30),
    db.select({ n: count() }).from(products).where(and(eq(products.storeId, store.id), eq(products.archived, false))).get(),
    db.select({ n: count() }).from(contacts).where(eq(contacts.storeId, store.id)).get(),
    db.select({ n: count() }).from(sequences).where(eq(sequences.storeId, store.id)).get(),
    db
      .select({ order: orders, title: products.title })
      .from(orders)
      .innerJoin(products, eq(products.id, orders.productId))
      .where(and(eq(orders.storeId, store.id), eq(orders.status, "paid")))
      .orderBy(desc(orders.createdAt))
      .limit(6)
      .all(),
    db
      .select({ total: sql<number>`coalesce(sum(${orders.totalCents}), 0)` })
      .from(orders)
      .where(and(eq(orders.storeId, store.id), eq(orders.status, "paid")))
      .get(),
  ]);
  const url = `${env.appUrl}/${store.slug}`;
  const checklist = [
    { done: Boolean(store.avatarMediaId && store.bio), label: "Add a photo and bio", href: "/dashboard/store" },
    { done: (productCount?.n ?? 0) > 0, label: "Add your first product", href: "/dashboard/products/new" },
    { done: user.stripeChargesEnabled, label: "Connect payouts", href: "/dashboard/billing" },
    { done: (seqCount?.n ?? 0) > 0, label: "Set up a welcome email", href: "/dashboard/email" },
    { done: stats.views > 0, label: "Put your link in your bio", href: url },
  ];
  const done = checklist.filter((c) => c.done).length;

  return (
    <>
      <PageHeader
        title={welcome ? `Welcome, ${user.name.split(" ")[0]}! 🎉` : `Hi, ${user.name.split(" ")[0]}`}
        description="Here's how your store did in the last 30 days."
        actions={
          <>
            <CopyButton text={url} label="Copy store link" />
            <LinkButton href="/dashboard/products/new" variant="brand">New product</LinkButton>
          </>
        }
      />

      {done < checklist.length && (
        <Card title={`Get set up (${done}/${checklist.length})`} className="mb-6">
          <ul className="grid gap-2 sm:grid-cols-2">
            {checklist.map((c) => (
              <li key={c.label}>
                <Link href={c.href} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50">
                  <span className={c.done ? "text-emerald-600" : "text-slate-300"}>{c.done ? "●" : "○"}</span>
                  <span className={c.done ? "text-slate-400 line-through" : "text-slate-700"}>{c.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Revenue (30d)" value={formatMoney(stats.revenueCents, store.currency)} sub={`${formatMoney(lifetime?.total ?? 0, store.currency)} all time`} />
        <Stat label="Sales (30d)" value={stats.purchases} />
        <Stat label="Visitors (30d)" value={stats.visitors} sub={`${stats.conversionRate}% converted`} />
        <Stat label="Contacts" value={contactCount?.n ?? 0} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <Card title="Revenue, last 30 days" className="lg:col-span-3">
          <BarChart money currency={store.currency} data={stats.daily.map((d) => ({ label: d.day.slice(5), value: d.revenueCents }))} />
        </Card>
        <Card title="Latest sales" className="lg:col-span-2" actions={<Link href="/dashboard/orders" className="text-sm text-brand-700">All orders</Link>}>
          {recent.length === 0 ? (
            <Empty title="No sales yet">Share your store link to get your first one.</Empty>
          ) : (
            <ul className="divide-y divide-slate-100">
              {recent.map(({ order, title }) => (
                <li key={order.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{title}</div>
                    <div className="truncate text-xs text-slate-500">{order.buyerEmail}</div>
                  </div>
                  {order.totalCents ? <span className="font-semibold tabular-nums">{formatMoney(order.totalCents, order.currency)}</span> : <Badge>Lead</Badge>}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
