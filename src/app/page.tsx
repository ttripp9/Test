import Link from "next/link";
import { LinkButton } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { env } from "@/lib/env";
import { PLANS } from "@/lib/plans";

export const dynamic = "force-dynamic";

const FEATURES = [
  { emoji: "📦", title: "Digital downloads", body: "Sell e-books, templates and presets with secure, limited download links." },
  { emoji: "🎓", title: "Courses that teach", body: "Video lessons, modules, quizzes, progress tracking and printable certificates." },
  { emoji: "📅", title: "Coaching calls", body: "Set your hours once. Buyers pick a time; double-bookings are impossible." },
  { emoji: "⭐", title: "Memberships", body: "Monthly or yearly subscriptions with members-only content." },
  { emoji: "✉️", title: "Email automation — every plan", body: "Welcome series, post-purchase follow-ups and broadcasts. No upgrade needed." },
  { emoji: "📈", title: "Pixels & analytics — every plan", body: "Meta, TikTok and GA4 pixels plus a built-in funnel: views → checkouts → sales." },
  { emoji: "🚀", title: "Order bumps & upsells", body: "One-click add-ons at checkout and a thank-you offer after purchase." },
  { emoji: "🤝", title: "Affiliate program", body: "Give partners a link, track their sales and what you owe them." },
  { emoji: "🎨", title: "Make it yours", body: "7 themes, your colors, fonts and button styles — or full custom CSS." },
];

const COMPARE: [string, string, string][] = [
  ["Free plan", "Yes", "Often none"],
  ["Email automation on the starter plan", "Yes", "Usually a higher tier"],
  ["Tracking pixels on the starter plan", "Yes", "Usually a higher tier"],
  ["Course quizzes & certificates", "Yes", "Often missing"],
  ["Built-in affiliate program", "Yes", "Rare"],
  ["Transaction fees on paid plans", "0%", "0–10%"],
  ["Paid plans from", `$${PLANS.pro.priceMonthly}/mo`, "$29+/mo"],
];

export default async function Landing() {
  const user = await getCurrentUser();
  return (
    <div className="bg-white">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
        <span className="text-xl font-black tracking-tight">{env.appName}</span>
        <nav className="flex items-center gap-2 text-sm">
          <a href="#pricing" className="hidden px-3 py-2 text-slate-600 hover:text-slate-900 sm:inline">Pricing</a>
          {user ? (
            <LinkButton href="/dashboard">Dashboard</LinkButton>
          ) : (
            <>
              <Link href="/login" className="px-3 py-2 text-slate-600 hover:text-slate-900">Log in</Link>
              <LinkButton href="/signup">Start free</LinkButton>
            </>
          )}
        </nav>
      </header>

      <section className="mx-auto max-w-4xl px-4 pb-16 pt-12 text-center sm:pt-20">
        <p className="mx-auto mb-4 inline-block rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">The link-in-bio store that doesn't hold features hostage</p>
        <h1 className="text-4xl font-black leading-tight tracking-tight text-slate-900 sm:text-6xl">
          Turn your followers into <span className="text-brand-600">customers</span>.
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-600">
          Sell downloads, courses, coaching and memberships from one link — with email automation, pixels and affiliates included from day one.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <LinkButton href="/signup" variant="brand" className="px-6 py-3 text-base">Create your free store</LinkButton>
          <a href="#features" className="rounded-lg px-6 py-3 text-base font-medium text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50">See features</a>
        </div>
        <p className="mt-3 text-sm text-slate-500">Set up in under 10 minutes. No card required.</p>
      </section>

      <section id="features" className="bg-slate-50 py-16">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-center text-3xl font-bold tracking-tight">Everything you need to sell</h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="text-3xl" aria-hidden>{f.emoji}</div>
                <h3 className="mt-3 font-semibold">{f.title}</h3>
                <p className="mt-1 text-sm text-slate-600">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-16">
        <h2 className="text-center text-3xl font-bold tracking-tight">More included, for less</h2>
        <div className="mt-8 overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left">
              <tr>
                <th className="px-4 py-3 font-medium text-slate-500" />
                <th className="px-4 py-3 font-semibold text-brand-700">{env.appName}</th>
                <th className="px-4 py-3 font-medium text-slate-500">Typical creator stores</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {COMPARE.map(([k, a, b]) => (
                <tr key={k}>
                  <td className="px-4 py-3 text-slate-700">{k}</td>
                  <td className="px-4 py-3 font-semibold">{a}</td>
                  <td className="px-4 py-3 text-slate-500">{b}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section id="pricing" className="bg-slate-50 py-16">
        <div className="mx-auto max-w-5xl px-4">
          <h2 className="text-center text-3xl font-bold tracking-tight">Simple pricing</h2>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {Object.values(PLANS).map((p) => (
              <div key={p.id} className={`rounded-2xl border bg-white p-6 ${p.id === "pro" ? "border-brand-500 shadow-lg" : "border-slate-200"}`}>
                <h3 className="text-lg font-bold">{p.name}</h3>
                <p className="text-sm text-slate-500">{p.tagline}</p>
                <p className="mt-4 text-4xl font-black">${p.priceMonthly}<span className="text-base font-normal text-slate-500">/mo</span></p>
                <ul className="mt-5 space-y-2 text-sm">
                  {p.highlights.map((h) => (
                    <li key={h} className="flex gap-2"><span className="text-brand-600">✓</span>{h}</li>
                  ))}
                </ul>
                <LinkButton href="/signup" variant={p.id === "pro" ? "brand" : "secondary"} className="mt-6 w-full">Get started</LinkButton>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="mx-auto max-w-6xl px-4 py-10 text-sm text-slate-500">
        © {new Date().getFullYear()} {env.appName}
      </footer>
    </div>
  );
}
