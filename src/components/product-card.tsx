"use client";

import Link from "next/link";
import { trackClick } from "./tracking";
import { storeButtonClass, storeButtonStyle, storeCardClass, storeCardStyle } from "./store-styles";

export type CardProduct = {
  id: string;
  type: string;
  title: string;
  subtitle: string;
  price: string | null;
  compareAt: string | null;
  cta: string;
  image: string | null;
  href: string;
  external: boolean;
};

export function ProductCard({ slug, p, grid }: { slug: string; p: CardProduct; grid: boolean }) {
  const inner = (
    <div className={`${storeCardClass} ${grid ? "flex h-full flex-col" : "flex items-center gap-4 p-3"}`} style={storeCardStyle}>
      {p.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={p.image} alt="" className={grid ? "aspect-[4/3] w-full object-cover" : "h-20 w-20 shrink-0 rounded-xl object-cover"} />
      )}
      <div className={grid ? "flex flex-1 flex-col p-4" : "min-w-0 flex-1 py-1"}>
        <div className="font-semibold leading-snug">{p.title}</div>
        {p.subtitle && <div className="mt-0.5 line-clamp-2 text-sm opacity-75">{p.subtitle}</div>}
        {p.price && (
          <div className="mt-1 text-sm font-semibold">
            {p.price}
            {p.compareAt && <span className="ml-2 font-normal line-through opacity-50">{p.compareAt}</span>}
          </div>
        )}
        {grid && (
          <span className={`${storeButtonClass} mt-auto pt-3`} style={{ ...storeButtonStyle, marginTop: "0.75rem" }}>
            {p.cta}
          </span>
        )}
      </div>
      {!grid && (
        <span className="shrink-0 px-4 py-2 text-xs font-semibold" style={storeButtonStyle}>
          {p.cta}
        </span>
      )}
    </div>
  );
  if (p.external) {
    return (
      <a href={p.href} target="_blank" rel="noopener noreferrer nofollow" onClick={() => trackClick(slug, p.id)} className="block">
        {inner}
      </a>
    );
  }
  return (
    <Link href={p.href} onClick={() => trackClick(slug, p.id)} className="block">
      {inner}
    </Link>
  );
}
