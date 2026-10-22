"use client";

import { useEffect } from "react";

type PixelWindow = Window & {
  fbq?: (...args: unknown[]) => void;
  ttq?: { track: (...args: unknown[]) => void };
  gtag?: (...args: unknown[]) => void;
};

export function firePixels(event: "InitiateCheckout" | "Purchase" | "Lead" | "ViewContent", data: { value?: number; currency?: string; name?: string } = {}) {
  const w = window as PixelWindow;
  try {
    w.fbq?.("track", event, { value: data.value, currency: data.currency?.toUpperCase(), content_name: data.name });
    const tt = { InitiateCheckout: "InitiateCheckout", Purchase: "CompletePayment", Lead: "SubmitForm", ViewContent: "ViewContent" }[event];
    w.ttq?.track(tt, { value: data.value, currency: data.currency?.toUpperCase() });
    const ga = { InitiateCheckout: "begin_checkout", Purchase: "purchase", Lead: "generate_lead", ViewContent: "view_item" }[event];
    w.gtag?.("event", ga, { value: data.value, currency: data.currency?.toUpperCase() });
  } catch {
    // Pixels are best-effort; never break the page.
  }
}

function beacon(body: Record<string, unknown>) {
  const payload = JSON.stringify(body);
  if (navigator.sendBeacon) navigator.sendBeacon("/api/track", new Blob([payload], { type: "application/json" }));
  else fetch("/api/track", { method: "POST", body: payload, headers: { "Content-Type": "application/json" }, keepalive: true });
}

/** Records a page view (and affiliate referral) once per page load. */
export function TrackView({ slug, productId, pixelEvent }: { slug: string; productId?: string; pixelEvent?: { value: number; currency: string; name: string } }) {
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const ref = params.get("ref");
    if (ref && /^[A-Za-z0-9_-]{2,32}$/.test(ref)) {
      document.cookie = `plinth_ref_${slug}=${ref.toUpperCase()}; Max-Age=${30 * 86400}; Path=/; SameSite=Lax`;
    }
    beacon({ type: "view", slug, productId, referrer: document.referrer || null, utm: params.get("utm_source"), ref });
    if (pixelEvent) firePixels("ViewContent", pixelEvent);
  }, [slug, productId, pixelEvent]);
  return null;
}

export function trackClick(slug: string, productId: string) {
  beacon({ type: "click", slug, productId, referrer: document.referrer || null, utm: new URLSearchParams(location.search).get("utm_source") });
}

export function PurchasePixel({ value, currency, name, lead }: { value: number; currency: string; name: string; lead?: boolean }) {
  useEffect(() => {
    const key = `plinth_px_${name}_${value}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {}
    firePixels(lead ? "Lead" : "Purchase", { value, currency, name });
  }, [value, currency, name, lead]);
  return null;
}
