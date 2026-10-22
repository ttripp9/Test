import { desc, eq } from "drizzle-orm";
import { ActionForm, CopyButton, SubmitButton } from "@/components/forms";
import { Badge, Card, Checkbox, Empty, Field, Input, LinkButton, PageHeader, Table, Td } from "@/components/ui";
import { affiliateStats } from "@/lib/affiliate-stats";
import { requireCreator } from "@/lib/auth";
import { db } from "@/lib/db";
import { affiliates } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { formatMoney } from "@/lib/money";
import { getPlan } from "@/lib/plans";
import { createAffiliate, recordPayout, toggleAffiliate } from "./actions";

export default async function AffiliatesPage() {
  const { user, store } = await requireCreator();
  const plan = getPlan(user.plan);
  if (!plan.affiliates) {
    return (
      <>
        <PageHeader title="Affiliates" />
        <Card>
          <Empty title="Let fans sell for you">
            <p>Give partners a link and a commission on every sale they bring in. Available on Pro and Business.</p>
            <LinkButton href="/dashboard/billing" variant="brand" className="mt-4">See plans</LinkButton>
          </Empty>
        </Card>
      </>
    );
  }
  const [list, stats] = await Promise.all([
    db.select().from(affiliates).where(eq(affiliates.storeId, store.id)).orderBy(desc(affiliates.createdAt)).all(),
    affiliateStats(store.id),
  ]);
  return (
    <>
      <PageHeader title="Affiliates" description="Partners earn a commission on sales from their link. You pay them yourself; we track what's owed." />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          {list.length === 0 ? (
            <Empty title="No affiliates yet" />
          ) : (
            <Table head={["Affiliate", "Clicks", "Sales", "Owed", ""]}>
              {list.map((a) => {
                const s = stats.get(a.id) ?? { sales: 0, revenue: 0, commission: 0 };
                const owed = Math.max(0, s.commission - a.paidOutCents);
                const link = `${env.appUrl}/${store.slug}?ref=${a.code}`;
                return (
                  <tr key={a.id}>
                    <Td>
                      <div className="font-medium">{a.name} {!a.active && <Badge>Paused</Badge>}</div>
                      <div className="text-xs text-slate-500">{a.code} · {a.commissionPercent}%</div>
                    </Td>
                    <Td className="tabular-nums">{a.clicks}</Td>
                    <Td className="tabular-nums">
                      {s.sales}
                      <div className="text-xs text-slate-500">{formatMoney(s.revenue, store.currency)}</div>
                    </Td>
                    <Td className="tabular-nums font-semibold">{formatMoney(owed, store.currency)}</Td>
                    <Td>
                      <details className="relative">
                        <summary className="cursor-pointer list-none text-sm text-brand-700">Manage</summary>
                        <div className="absolute right-0 z-10 mt-1 w-64 space-y-3 rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
                          <div className="flex gap-2">
                            <CopyButton text={link} label="Copy link" />
                            <CopyButton text={`${env.appUrl}/aff/${a.portalToken}`} label="Copy portal" />
                          </div>
                          <ActionForm action={recordPayout} className="flex gap-2">
                            <input type="hidden" name="id" value={a.id} />
                            <Input name="amount" placeholder={(owed / 100).toFixed(2)} inputMode="decimal" />
                            <SubmitButton size="sm" variant="secondary">Paid</SubmitButton>
                          </ActionForm>
                          <form action={toggleAffiliate}>
                            <input type="hidden" name="id" value={a.id} />
                            <button className="text-sm text-slate-600 hover:underline">{a.active ? "Pause" : "Resume"} affiliate</button>
                          </form>
                        </div>
                      </details>
                    </Td>
                  </tr>
                );
              })}
            </Table>
          )}
        </Card>
        <Card title="Add an affiliate">
          <ActionForm action={createAffiliate} className="space-y-3" resetOnSuccess>
            <Field label="Name"><Input name="name" required /></Field>
            <Field label="Email"><Input name="email" type="email" required /></Field>
            <Field label="Referral code" hint="Used in their link"><Input name="code" required className="uppercase" placeholder="SAM" /></Field>
            <Field label="Commission %"><Input name="commission" type="number" min={1} max={90} defaultValue={30} /></Field>
            <Checkbox name="notify" defaultChecked label="Email them their link" />
            <SubmitButton>Add affiliate</SubmitButton>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
