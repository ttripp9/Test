import { and, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { StoreShell, storeButtonClass, storeButtonStyle, storeCardClass, storeCardStyle } from "@/components/store-shell";
import { PurchasePixel } from "@/components/tracking";
import { orderByToken, reconcileWithStripe } from "@/lib/commerce";
import { db } from "@/lib/db";
import { products } from "@/lib/db/schema";
import { formatMoney } from "@/lib/money";
import { getPlan } from "@/lib/plans";
import { renderMarkdown } from "@/lib/safe";
import { users } from "@/lib/db/schema";

export const dynamic = "force-dynamic";
export const metadata = { title: "Thank you", robots: { index: false } };

export default async function Success({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t } = await searchParams;
  if (!t) notFound();
  let row = await orderByToken(t);
  if (!row) notFound();
  if (row.order.status === "pending") {
    try {
      if (await reconcileWithStripe(row.order, row.store)) row = (await orderByToken(t))!;
    } catch (e) {
      console.error("[success] reconcile failed", e);
    }
  }
  const { order, store, product } = row;
  const owner = await db.select({ plan: users.plan }).from(users).where(eq(users.id, store.userId)).get();
  const plan = getPlan(owner?.plan);
  const paid = order.status === "paid";
  const upsell = paid && product.settings.upsellProductId
    ? await db.select().from(products).where(and(eq(products.id, product.settings.upsellProductId), eq(products.storeId, store.id), eq(products.active, true), eq(products.archived, false))).get()
    : null;

  return (
    <StoreShell store={store} showBranding={!plan.removeBranding} compactHeader>
      <div className={`${storeCardClass} p-6 text-center`} style={storeCardStyle}>
        {paid ? (
          <>
            <PurchasePixel value={order.totalCents / 100} currency={order.currency} name={product.title} lead={order.totalCents === 0} />
            <div className="text-4xl" aria-hidden>🎉</div>
            <h1 className="mt-2 text-2xl font-bold">{order.totalCents ? "Thank you for your order!" : "You're in!"}</h1>
            <p className="mt-2 text-sm opacity-80">We've emailed <b>{order.buyerEmail}</b> a receipt and your access link.</p>
            {product.settings.thankYouMessage && <div className="rich mt-4 text-left text-sm" dangerouslySetInnerHTML={{ __html: renderMarkdown(product.settings.thankYouMessage) }} />}
            <Link href={`/access/${order.accessToken}`} className={`${storeButtonClass} mt-6`} style={storeButtonStyle}>
              Open {product.title}
            </Link>
          </>
        ) : order.status === "pending" ? (
          <>
            <h1 className="text-xl font-bold">Finishing up your payment…</h1>
            <p className="mt-2 text-sm opacity-80">This usually takes a few seconds. Refresh this page, or check your email for your access link.</p>
          </>
        ) : (
          <h1 className="text-xl font-bold">This order is {order.status}.</h1>
        )}
      </div>
      {upsell && (
        <div className={`${storeCardClass} mt-4 p-5`} style={storeCardStyle}>
          <p className="text-xs font-semibold uppercase tracking-wide opacity-60">A thank-you offer, just for you</p>
          <h2 className="mt-1 text-lg font-bold">{upsell.title}</h2>
          {upsell.subtitle && <p className="text-sm opacity-80">{upsell.subtitle}</p>}
          <p className="mt-2 text-sm">
            <span className="font-bold">{product.settings.upsellDiscountPercent}% off</span>{" "}
            <span className="line-through opacity-60">{formatMoney(upsell.priceCents, store.currency)}</span>
          </p>
          <Link href={`/${store.slug}/p/${upsell.id}?offer=${order.accessToken}`} className={`${storeButtonClass} mt-4`} style={storeButtonStyle}>
            Claim offer
          </Link>
        </div>
      )}
    </StoreShell>
  );
}
