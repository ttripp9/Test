import type { CSSProperties } from "react";

// Shared storefront styles. Kept free of server imports so client components can use them.
export const storeButtonClass = "store-button inline-flex w-full items-center justify-center px-5 py-3 text-sm font-semibold transition hover:opacity-90 disabled:opacity-50";
export const storeButtonStyle: CSSProperties = { background: "var(--accent)", color: "var(--accent-text)", borderRadius: "var(--radius)" };
export const storeCardClass = "store-card overflow-hidden shadow-sm ring-1 ring-black/5";
export const storeCardStyle: CSSProperties = { background: "var(--card)", borderRadius: "min(var(--radius), 20px)" };
