import { notFound } from "next/navigation";
import { StoreShell, storeButtonClass, storeButtonStyle, storeCardClass, storeCardStyle } from "@/components/store-shell";
import { orderByToken } from "@/lib/commerce";
import { demoPaymentsEnabled } from "@/lib/env";
import { formatMoney } from "@/lib/money";
import { completeDemoPayment } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Demo checkout", robots: { index: false } };

export default async function DemoCheckout({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t } = await searchParams;
  if (!demoPaymentsEnabled() || !t) notFound();
  const row = await orderByToken(t);
  if (!row) notFound();
  const { order, store, product } = row;
  return (
    <StoreShell store={store} showBranding={false} compactHeader>
      <div className={`${storeCardClass} p-6`} style={storeCardStyle}>
        <p className="mb-3 inline-block rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">Demo mode — no real payment</p>
        <h1 className="text-xl font-bold">{product.title}</h1>
        <dl className="mt-4 space-y-1 text-sm">
          <div className="flex justify-between"><dt className="opacity-70">Subtotal</dt><dd>{formatMoney(order.subtotalCents, order.currency)}</dd></div>
          {order.discountCents > 0 && <div className="flex justify-between"><dt className="opacity-70">Discount</dt><dd>−{formatMoney(order.discountCents, order.currency)}</dd></div>}
          <div className="flex justify-between border-t border-black/10 pt-2 font-semibold"><dt>Total</dt><dd>{formatMoney(order.totalCents, order.currency)}</dd></div>
        </dl>
        {order.status === "pending" ? (
          <form action={completeDemoPayment} className="mt-6">
            <input type="hidden" name="t" value={t} />
            <button className={storeButtonClass} style={storeButtonStyle}>Simulate successful payment</button>
          </form>
        ) : (
          <p className="mt-6 text-sm">This order is {order.status}.</p>
        )}
        <p className="mt-4 text-xs opacity-60">Add your Stripe keys to take real payments. Demo payments are switched off automatically in production.</p>
      </div>
    </StoreShell>
  );
}
