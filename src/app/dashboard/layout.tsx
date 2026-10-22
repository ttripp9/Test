import Link from "next/link";
import { logout } from "@/app/(auth)/actions";
import { DashboardNav } from "@/components/dashboard-nav";
import { Badge } from "@/components/ui";
import { requireCreator } from "@/lib/auth";
import { env } from "@/lib/env";
import { getPlan } from "@/lib/plans";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, store } = await requireCreator();
  const plan = getPlan(user.plan);
  return (
    <div className="min-h-screen md:flex">
      <aside className="border-b border-slate-200 bg-white p-4 md:sticky md:top-0 md:h-screen md:w-60 md:shrink-0 md:border-b-0 md:border-r">
        <div className="mb-4 flex items-center justify-between md:block">
          <Link href="/dashboard" className="text-xl font-black tracking-tight">
            {env.appName}
          </Link>
          <div className="flex items-center gap-2 md:mt-3">
            <Badge tone={plan.id === "free" ? "gray" : "purple"}>{plan.name}</Badge>
            <Link href={`/${store.slug}`} target="_blank" className="truncate text-xs text-brand-700 hover:underline">
              /{store.slug} ↗
            </Link>
          </div>
        </div>
        <DashboardNav />
        <form action={logout} className="mt-3 md:mt-4">
          <button className="text-sm text-slate-500 hover:text-slate-900">Log out</button>
        </form>
      </aside>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 md:px-8 md:py-10">{children}</main>
    </div>
  );
}
