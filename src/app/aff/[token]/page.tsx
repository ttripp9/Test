import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { CopyButton } from "@/components/forms";
import { Card, Stat } from "@/components/ui";
import { affiliateStats } from "@/lib/affiliate-stats";
import { db } from "@/lib/db";
import { affiliates, stores } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { formatMoney } from "@/lib/money";

export const dynamic = "force-dynamic";
export const metadata = { title: "Affiliate stats", robots: { index: false } };

export default async function AffiliatePortal({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (token.length > 64) notFound();
  const row = await db.select({ a: affiliates, store: stores }).from(affiliates).innerJoin(stores, eq(stores.id, affiliates.storeId)).where(eq(affiliates.portalToken, token)).get();
  if (!row) notFound();
  const { a, store } = row;
  const s = (await affiliateStats(store.id)).get(a.id) ?? { sales: 0, revenue: 0, commission: 0 };
  const link = `${env.appUrl}/${store.slug}?ref=${a.code}`;
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-bold">Hi {a.name.split(" ")[0]} 👋</h1>
      <p className="mt-1 text-sm text-slate-500">
        You earn {a.commissionPercent}% on sales you refer to {store.displayName}.{!a.active && " Your link is currently paused."}
      </p>
      <Card className="mt-6" title="Your link">
        <div className="flex flex-wrap items-center gap-3">
          <code className="flex-1 break-all rounded-lg bg-slate-100 px-3 py-2 text-sm">{link}</code>
          <CopyButton text={link} />
        </div>
      </Card>
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Clicks" value={a.clicks} />
        <Stat label="Sales" value={s.sales} />
        <Stat label="Earned" value={formatMoney(s.commission, store.currency)} />
        <Stat label="Paid to you" value={formatMoney(a.paidOutCents, store.currency)} />
      </div>
      <p className="mt-4 text-sm text-slate-500">Balance due: <b>{formatMoney(Math.max(0, s.commission - a.paidOutCents), store.currency)}</b>. Payouts are made by {store.displayName} directly.</p>
    </div>
  );
}
