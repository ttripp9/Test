"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { startCheckout } from "@/app/[slug]/p/[productId]/actions";
import { firePixels } from "./tracking";
import { storeButtonClass, storeButtonStyle } from "./store-styles";

export type CheckoutProps = {
  slug: string;
  productId: string;
  productName: string;
  type: string;
  priceCents: number;
  currency: string;
  cta: string;
  flexible: { min: number; suggested: number[] } | null;
  bump: { title: string; subtitle: string; priceLabel: string; priceCents: number } | null;
  slots: { start: number; label: string; day: string }[] | null;
  offerToken: string | null;
  offerLabel: string | null;
  paymentsReady: boolean;
};

const inputCls = "block w-full rounded-xl border border-black/10 bg-white/90 px-3 py-2.5 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-black/10";

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={storeButtonClass} style={storeButtonStyle}>
      {pending ? "One moment…" : label}
    </button>
  );
}

export function CheckoutForm(p: CheckoutProps) {
  const [state, action] = useActionState(startCheckout, undefined);
  const [amount, setAmount] = useState(p.flexible ? (p.flexible.suggested[0] ?? p.flexible.min) / 100 : 0);
  const [slot, setSlot] = useState<number | null>(null);
  const days = useMemo(() => {
    const map = new Map<string, { start: number; label: string }[]>();
    for (const s of p.slots ?? []) map.set(s.day, [...(map.get(s.day) ?? []), s]);
    return [...map.entries()];
  }, [p.slots]);
  const [day, setDay] = useState(days[0]?.[0] ?? "");
  const free = p.priceCents === 0 && !p.flexible;
  const [source, setSource] = useState("");
  useEffect(() => setSource(new URLSearchParams(location.search).get("utm_source") ?? ""), []);

  return (
    <form
      action={action}
      className="space-y-3"
      onSubmit={() => firePixels(free ? "Lead" : "InitiateCheckout", { value: (p.flexible ? amount * 100 : p.priceCents) / 100, currency: p.currency, name: p.productName })}
    >
      <input type="hidden" name="slug" value={p.slug} />
      <input type="hidden" name="productId" value={p.productId} />
      {p.offerToken && <input type="hidden" name="offer" value={p.offerToken} />}
      <input type="hidden" name="source" value={source} />

      {p.offerLabel && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">{p.offerLabel}</p>}

      {p.slots && (
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">Pick a time</legend>
          {days.length === 0 ? (
            <p className="text-sm opacity-70">No times available right now. Check back soon.</p>
          ) : (
            <>
              <div className="-mx-1 mb-2 flex gap-1 overflow-x-auto pb-1">
                {days.map(([d]) => (
                  <button key={d} type="button" onClick={() => setDay(d)} className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium ring-1 ring-black/10" style={d === day ? storeButtonStyle : undefined}>
                    {d}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {(days.find(([d]) => d === day)?.[1] ?? []).map((s) => (
                  <button key={s.start} type="button" onClick={() => setSlot(s.start)} className="rounded-lg px-2 py-2 text-xs font-medium ring-1 ring-black/10" style={slot === s.start ? storeButtonStyle : { background: "white", color: "#0f172a" }}>
                    {s.label}
                  </button>
                ))}
              </div>
              <input type="hidden" name="slot" value={slot ?? ""} />
            </>
          )}
        </fieldset>
      )}

      {p.flexible && (
        <div>
          <span className="mb-2 block text-sm font-semibold">{p.type === "tip" ? "Choose an amount" : "Pay what you want"}</span>
          <div className="mb-2 flex flex-wrap gap-2">
            {p.flexible.suggested.map((c) => (
              <button key={c} type="button" onClick={() => setAmount(c / 100)} className="rounded-lg px-3 py-1.5 text-sm font-medium ring-1 ring-black/10" style={amount === c / 100 ? storeButtonStyle : { background: "white", color: "#0f172a" }}>
                {(c / 100).toLocaleString("en-US", { style: "currency", currency: p.currency.toUpperCase(), maximumFractionDigits: 0 })}
              </button>
            ))}
          </div>
          <input name="amount" type="number" min={p.flexible.min / 100} step="0.01" value={amount} onChange={(e) => setAmount(Number(e.target.value))} className={inputCls} aria-label="Amount" />
          <span className="mt-1 block text-xs opacity-60">Minimum {(p.flexible.min / 100).toFixed(2)}</span>
        </div>
      )}

      <input name="name" placeholder="Your name" autoComplete="name" className={inputCls} maxLength={100} />
      <input name="email" type="email" required placeholder="Your email" autoComplete="email" className={inputCls} />

      {p.bump && (
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border-2 border-dashed p-3 text-sm" style={{ borderColor: "var(--accent)" }}>
          <input type="checkbox" name="bump" className="mt-1 h-4 w-4" />
          <span>
            <span className="font-semibold">Yes, add {p.bump.title} for {p.bump.priceLabel}</span>
            {p.bump.subtitle && <span className="block opacity-75">{p.bump.subtitle}</span>}
          </span>
        </label>
      )}

      {!free && !p.offerToken && (
        <details className="text-sm">
          <summary className="cursor-pointer opacity-70">Have a discount code?</summary>
          <input name="coupon" placeholder="CODE" className={`${inputCls} mt-2 uppercase`} maxLength={40} />
        </details>
      )}

      {state?.error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      {!free && !p.paymentsReady && <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">This creator is still setting up payments.</p>}
      <Submit label={p.cta} />
      {!free && <p className="text-center text-xs opacity-60">Secure checkout · Instant delivery by email</p>}
    </form>
  );
}
