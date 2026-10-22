import { and, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CheckoutForm } from "@/components/checkout-form";
import { StoreShell, storeCardClass, storeCardStyle } from "@/components/store-shell";
import { TrackView } from "@/components/tracking";
import { availableSlots } from "@/lib/booking";
import { busySlots, loadPublicProduct } from "@/lib/commerce";
import { db } from "@/lib/db";
import { lessons, orders, products } from "@/lib/db/schema";
import { demoPaymentsEnabled } from "@/lib/env";
import { mediaUrl } from "@/lib/media";
import { formatMoney } from "@/lib/money";
import { PRODUCT_TYPES } from "@/lib/product-types";
import { renderMarkdown } from "@/lib/safe";
import { loadStore } from "@/lib/storefront";
import { stripeEnabled } from "@/lib/stripe";

export const dynamic = "force-dynamic";

type Params = Promise<{ slug: string; productId: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug, productId } = await params;
  const row = await loadPublicProduct(slug, productId);
  if (!row) return { title: "Not found" };
  const image = mediaUrl(row.product.imageMediaId);
  return {
    title: `${row.product.title} · ${row.store.displayName}`,
    description: row.product.subtitle || row.product.description.slice(0, 160),
    openGraph: { title: row.product.title, description: row.product.subtitle, images: image ? [image] : [] },
  };
}

export default async function ProductPage({ params, searchParams }: { params: Params; searchParams: Promise<{ offer?: string }> }) {
  const { slug, productId } = await params;
  const { offer } = await searchParams;
  const data = await loadStore(slug);
  const row = await loadPublicProduct(slug, productId);
  if (!data || !row || row.product.type === "link") notFound();
  const { store, plan, chargesEnabled } = data;
  const product = row.product;
  const s = product.settings;

  const bumpProduct = s.bumpProductId && product.type !== "membership"
    ? await db.select().from(products).where(and(eq(products.id, s.bumpProductId), eq(products.storeId, store.id), eq(products.active, true), eq(products.archived, false))).get()
    : null;

  let slots: { start: number; label: string; day: string }[] | null = null;
  if (product.type === "booking") {
    const fmtTime = new Intl.DateTimeFormat("en-US", { timeZone: store.timezone, hour: "numeric", minute: "2-digit" });
    const fmtDay = new Intl.DateTimeFormat("en-US", { timeZone: store.timezone, weekday: "short", month: "short", day: "numeric" });
    slots = availableSlots({ settings: s, timeZone: store.timezone, busy: await busySlots(product.id) }).map((x) => ({
      start: x.start.getTime(),
      label: fmtTime.format(x.start),
      day: fmtDay.format(x.start),
    }));
  }

  let offerToken: string | null = null;
  let offerLabel: string | null = null;
  if (offer && offer.length <= 64) {
    const prior = await db.select().from(orders).where(eq(orders.accessToken, offer)).get();
    const priorProduct = prior ? await db.select().from(products).where(eq(products.id, prior.productId)).get() : null;
    if (prior?.status === "paid" && prior.storeId === store.id && priorProduct?.settings.upsellProductId === product.id && priorProduct.settings.upsellDiscountPercent) {
      offerToken = offer;
      offerLabel = `🎉 Your ${priorProduct.settings.upsellDiscountPercent}% thank-you discount is applied at checkout.`;
    }
  }

  const courseLessons = product.type === "course" ? await db.select({ title: lessons.title, module: lessons.module }).from(lessons).where(eq(lessons.productId, product.id)).orderBy(lessons.position).all() : [];
  const flexible = product.type === "tip" || s.payWhatYouWant;
  const min = s.minPriceCents ?? (product.type === "tip" ? 300 : product.priceCents);
  const image = mediaUrl(product.imageMediaId);
  const price =
    product.type === "tip" ? null
    : product.priceCents === 0 && !flexible ? "Free"
    : `${flexible ? "From " : ""}${formatMoney(flexible ? min : product.priceCents, store.currency)}${product.type === "membership" ? ` / ${s.interval ?? "month"}` : ""}`;
  const paymentsReady = stripeEnabled() ? chargesEnabled : demoPaymentsEnabled();

  return (
    <StoreShell store={store} showBranding={!plan.removeBranding} compactHeader>
      <TrackView slug={store.slug} productId={product.id} pixelEvent={{ value: product.priceCents / 100, currency: store.currency, name: product.title }} />
      <article className={storeCardClass} style={storeCardStyle}>
        {image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" className="aspect-[16/9] w-full object-cover" />
        )}
        <div className="p-5 sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-wide opacity-60">{PRODUCT_TYPES[product.type].label}</p>
          <h1 className="mt-1 text-2xl font-bold leading-tight">{product.title}</h1>
          {product.subtitle && <p className="mt-1 opacity-80">{product.subtitle}</p>}
          {price && (
            <p className="mt-3 text-xl font-bold">
              {price}
              {product.compareAtCents && <span className="ml-2 text-base font-normal line-through opacity-50">{formatMoney(product.compareAtCents, store.currency)}</span>}
            </p>
          )}
          {product.description && <div className="rich mt-4 text-[15px] leading-relaxed" dangerouslySetInnerHTML={{ __html: renderMarkdown(product.description) }} />}
          {product.type === "booking" && <p className="mt-3 text-sm opacity-70">{s.durationMinutes ?? 30}-minute video call · times shown in {store.timezone.replace(/_/g, " ")}</p>}
          {courseLessons.length > 0 && (
            <div className="mt-5">
              <h2 className="mb-2 font-semibold">What's inside · {courseLessons.length} lessons</h2>
              <ol className="space-y-1 text-sm opacity-85">
                {courseLessons.slice(0, 12).map((l, i) => (
                  <li key={i}>
                    {i + 1}. {l.title}
                  </li>
                ))}
                {courseLessons.length > 12 && <li>…and {courseLessons.length - 12} more</li>}
              </ol>
            </div>
          )}
          <div className="mt-6 border-t border-black/5 pt-5">
            <CheckoutForm
              slug={store.slug}
              productId={product.id}
              productName={product.title}
              type={product.type}
              priceCents={product.priceCents}
              currency={store.currency}
              cta={product.ctaLabel || PRODUCT_TYPES[product.type].cta}
              flexible={flexible ? { min, suggested: [min, min * 2, min * 4].filter((v, i, a) => a.indexOf(v) === i) } : null}
              bump={
                bumpProduct
                  ? { title: bumpProduct.title, subtitle: bumpProduct.subtitle, priceCents: s.bumpPriceCents ?? bumpProduct.priceCents, priceLabel: formatMoney(s.bumpPriceCents ?? bumpProduct.priceCents, store.currency) }
                  : null
              }
              slots={slots}
              offerToken={offerToken}
              offerLabel={offerLabel}
              paymentsReady={paymentsReady}
            />
          </div>
        </div>
      </article>
    </StoreShell>
  );
}
