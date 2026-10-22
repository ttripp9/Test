import { ActionForm, SubmitButton } from "@/components/forms";
import { Badge, Button, Card, PageHeader, cx } from "@/components/ui";
import { requireCreator } from "@/lib/auth";
import { demoPaymentsEnabled } from "@/lib/env";
import { PLANS } from "@/lib/plans";
import { stripeEnabled } from "@/lib/stripe";
import { changePlan, connectPayouts, openPayoutDashboard, syncPayoutStatus } from "./actions";

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ connected?: string; upgraded?: string; need?: string }> }) {
  const { user } = await requireCreator();
  const sp = await searchParams;
  let chargesEnabled = user.stripeChargesEnabled;
  if (sp.connected === "1" && stripeEnabled() && user.stripeAccountId) {
    chargesEnabled = await syncPayoutStatus(user.id, user.stripeAccountId).catch(() => chargesEnabled);
  }
  const demo = !stripeEnabled() && demoPaymentsEnabled();
  return (
    <>
      <PageHeader title="Plan & payouts" />
      {sp.need && (
        <p className="mb-4 rounded-lg bg-brand-50 px-4 py-3 text-sm text-brand-700">
          {sp.need === "products" ? "You've reached your plan's product limit." : "That product type needs a paid plan."} Upgrade below to unlock it.
        </p>
      )}
      {sp.upgraded && <p className="mb-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">Thanks for upgrading! Your plan updates as soon as Stripe confirms payment.</p>}
      {demo && <p className="mb-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">Demo mode: Stripe isn't configured, so plan changes and payouts are simulated.</p>}

      <Card title="Payouts" className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm text-slate-600">Buyers pay you directly through Stripe. Money goes to your bank on Stripe's normal schedule.</p>
            <p className="mt-2">{chargesEnabled ? <Badge tone="green">Payouts connected</Badge> : user.stripeAccountId ? <Badge tone="amber">Setup incomplete</Badge> : <Badge>Not connected</Badge>}</p>
          </div>
          <div className="flex gap-2">
            <form action={connectPayouts}>
              <Button variant={chargesEnabled ? "secondary" : "brand"}>{chargesEnabled ? "Update details" : user.stripeAccountId ? "Finish setup" : "Connect Stripe"}</Button>
            </form>
            {chargesEnabled && stripeEnabled() && (
              <form action={openPayoutDashboard}>
                <Button variant="secondary">Stripe dashboard ↗</Button>
              </form>
            )}
          </div>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        {Object.values(PLANS).map((p) => {
          const current = p.id === user.plan;
          return (
            <Card key={p.id} className={cx(current && "ring-2 ring-brand-500")}>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold">{p.name}</h2>
                {current && <Badge tone="purple">Current</Badge>}
              </div>
              <p className="mt-1 text-sm text-slate-500">{p.tagline}</p>
              <p className="mt-4 text-3xl font-black">
                ${p.priceMonthly}
                <span className="text-sm font-normal text-slate-500">/mo</span>
              </p>
              <ul className="mt-4 space-y-1.5 text-sm">
                {p.highlights.map((h) => (
                  <li key={h} className="flex gap-2"><span className="text-brand-600">✓</span>{h}</li>
                ))}
              </ul>
              {!current && (
                <ActionForm action={changePlan} className="mt-5">
                  <input type="hidden" name="plan" value={p.id} />
                  <SubmitButton variant={p.id === "free" ? "secondary" : "brand"} className="w-full" pendingText="One moment…">
                    {p.priceMonthly > PLANS[user.plan].priceMonthly ? `Upgrade to ${p.name}` : `Switch to ${p.name}`}
                  </SubmitButton>
                </ActionForm>
              )}
            </Card>
          );
        })}
      </div>
    </>
  );
}
