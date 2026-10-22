export const dynamic = "force-dynamic";

import Link from "next/link";
import { env } from "@/lib/env";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-brand-50 to-white px-4 py-12">
      <Link href="/" className="mb-8 text-2xl font-black tracking-tight text-slate-900">
        {env.appName}
      </Link>
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">{children}</div>
    </div>
  );
}
