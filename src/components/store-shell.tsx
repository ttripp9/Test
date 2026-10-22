import Link from "next/link";
import Script from "next/script";
import type { CSSProperties, ReactNode } from "react";
import type { Store } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { mediaUrl } from "@/lib/media";
import { sanitizeCss } from "@/lib/safe";
import { contrastText, FONT_STACKS, RADIUS } from "@/lib/themes";

const SOCIAL_LABELS: Record<string, string> = {
  instagram: "Instagram", tiktok: "TikTok", youtube: "YouTube", x: "X", linkedin: "LinkedIn", threads: "Threads", website: "Website", email: "Email",
};

/** Tracking pixel snippets. IDs are validated on save, and validated again here. */
export function Pixels({ store }: { store: Store }) {
  const { metaPixelId, tiktokPixelId, ga4Id } = store.pixels;
  return (
    <>
      {metaPixelId && /^\d{5,20}$/.test(metaPixelId) && (
        <Script id="meta-pixel" strategy="afterInteractive">{`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${metaPixelId}');fbq('track','PageView');`}</Script>
      )}
      {tiktokPixelId && /^[A-Z0-9]{10,30}$/.test(tiktokPixelId) && (
        <Script id="tiktok-pixel" strategy="afterInteractive">{`!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"];ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.load=function(e){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{};ttq._i[e]=[];ttq._i[e]._u=i;ttq._t=ttq._t||{};ttq._t[e]=+new Date;var o=d.createElement("script");o.type="text/javascript";o.async=!0;o.src=i+"?sdkid="+e+"&lib="+t;var a=d.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};ttq.load('${tiktokPixelId}');ttq.page();}(window,document,'ttq');`}</Script>
      )}
      {ga4Id && /^G-[A-Z0-9]{4,15}$/.test(ga4Id) && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${ga4Id}`} strategy="afterInteractive" />
          <Script id="ga4" strategy="afterInteractive">{`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}window.gtag=gtag;gtag('js',new Date());gtag('config','${ga4Id}');`}</Script>
        </>
      )}
    </>
  );
}

export function themeVars(store: Store): CSSProperties {
  const t = store.theme;
  return {
    "--accent": t.accent,
    "--accent-text": contrastText(t.accent),
    "--bg": t.background,
    "--text": t.text,
    "--card": t.card,
    "--radius": RADIUS[t.buttonShape],
    fontFamily: FONT_STACKS[t.font],
    background: t.background,
    color: t.text,
  } as CSSProperties;
}

export function StoreShell({ store, showBranding, children, compactHeader }: { store: Store; showBranding: boolean; children: ReactNode; compactHeader?: boolean }) {
  const avatar = mediaUrl(store.avatarMediaId);
  const socials = Object.entries(store.socials).filter(([, v]) => v);
  return (
    <div className="store-root min-h-screen" style={themeVars(store)}>
      {store.customCss && <style dangerouslySetInnerHTML={{ __html: sanitizeCss(store.customCss) }} />}
      <Pixels store={store} />
      <div className="mx-auto w-full max-w-xl px-4 pb-16 pt-10">
        <header className={compactHeader ? "mb-6 flex items-center gap-3" : "mb-8 text-center"}>
          <Link href={`/${store.slug}`} className={compactHeader ? "flex items-center gap-3" : "block"}>
            {avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatar} alt="" className={compactHeader ? "h-10 w-10 rounded-full object-cover" : "mx-auto h-24 w-24 rounded-full object-cover shadow"} />
            ) : (
              <div
                className={compactHeader ? "flex h-10 w-10 items-center justify-center rounded-full font-bold" : "mx-auto flex h-24 w-24 items-center justify-center rounded-full text-3xl font-bold shadow"}
                style={{ background: "var(--accent)", color: "var(--accent-text)" }}
              >
                {store.displayName[0]?.toUpperCase()}
              </div>
            )}
            <span className={compactHeader ? "font-semibold" : "mt-4 block text-2xl font-bold"}>{store.displayName}</span>
          </Link>
          {!compactHeader && store.bio && <p className="mx-auto mt-2 max-w-md whitespace-pre-line text-sm opacity-80">{store.bio}</p>}
          {!compactHeader && socials.length > 0 && (
            <nav className="mt-4 flex flex-wrap justify-center gap-2">
              {socials.map(([k, v]) => (
                <a
                  key={k}
                  href={k === "email" ? `mailto:${v}` : v}
                  target="_blank"
                  rel="noopener noreferrer me"
                  className="rounded-full px-3 py-1 text-xs font-medium ring-1"
                  style={{ background: "var(--card)", borderColor: "var(--accent)" }}
                >
                  {SOCIAL_LABELS[k] ?? k}
                </a>
              ))}
            </nav>
          )}
        </header>
        {children}
        {showBranding && (
          <footer className="mt-12 text-center text-xs opacity-60">
            <Link href="/" className="hover:underline">Made with {env.appName} — start your own store free</Link>
          </footer>
        )}
      </div>
    </div>
  );
}

export { storeButtonClass, storeButtonStyle, storeCardClass, storeCardStyle } from "./store-styles";
