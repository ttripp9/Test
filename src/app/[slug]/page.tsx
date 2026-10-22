import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductCard, type CardProduct } from "@/components/product-card";
import { StoreShell } from "@/components/store-shell";
import { TrackView } from "@/components/tracking";
import { mediaUrl } from "@/lib/media";
import { formatMoney } from "@/lib/money";
import { PRODUCT_TYPES } from "@/lib/product-types";
import { loadStore, storeProducts } from "@/lib/storefront";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const data = await loadStore((await params).slug);
  if (!data) return { title: "Store not found" };
  const avatar = mediaUrl(data.store.avatarMediaId);
  return {
    title: data.store.displayName,
    description: data.store.bio.slice(0, 160) || `Shop ${data.store.displayName}`,
    openGraph: { title: data.store.displayName, description: data.store.bio.slice(0, 160), images: avatar ? [avatar] : [] },
  };
}

export default async function Storefront({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await loadStore(slug);
  if (!data) notFound();
  const { store, plan } = data;
  const items = await storeProducts(store.id);
  const cards: CardProduct[] = items.map((p) => {
    const isLink = p.type === "link";
    const price =
      isLink ? null
      : p.type === "tip" ? "Any amount"
      : p.priceCents === 0 ? "Free"
      : `${p.settings.payWhatYouWant ? "From " : ""}${formatMoney(p.priceCents, store.currency)}${p.type === "membership" ? ` / ${p.settings.interval ?? "month"}` : ""}`;
    return {
      id: p.id,
      type: p.type,
      title: p.title,
      subtitle: p.subtitle,
      price,
      compareAt: p.compareAtCents ? formatMoney(p.compareAtCents, store.currency) : null,
      cta: p.ctaLabel || PRODUCT_TYPES[p.type].cta,
      image: mediaUrl(p.imageMediaId),
      href: isLink ? (p.settings.url ?? "#") : `/${store.slug}/p/${p.id}`,
      external: isLink,
    };
  });
  const grid = store.theme.layout === "grid";
  return (
    <StoreShell store={store} showBranding={!plan.removeBranding}>
      <TrackView slug={store.slug} />
      {cards.length === 0 ? (
        <p className="text-center text-sm opacity-60">Nothing here yet — check back soon.</p>
      ) : (
        <div className={grid ? "grid grid-cols-1 gap-4 sm:grid-cols-2" : "space-y-3"}>
          {cards.map((p) => (
            <ProductCard key={p.id} slug={store.slug} p={p} grid={grid} />
          ))}
        </div>
      )}
    </StoreShell>
  );
}
