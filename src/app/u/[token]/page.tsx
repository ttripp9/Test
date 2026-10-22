import { eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { contacts, stores } from "@/lib/db/schema";
import { unsubscribe } from "@/lib/unsubscribe";

export const dynamic = "force-dynamic";
export const metadata = { title: "Unsubscribe", robots: { index: false } };

async function confirm(form: FormData) {
  "use server";
  const token = String(form.get("token") ?? "");
  await unsubscribe(token);
  redirect(`/u/${encodeURIComponent(token)}?done=1`);
}

// Unsubscribing takes a button press so email link scanners can't do it by accident.
export default async function Unsubscribe({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ done?: string }> }) {
  const { token } = await params;
  const { done } = await searchParams;
  if (token.length > 64) notFound();
  const row = await db.select({ c: contacts, store: stores.displayName }).from(contacts).innerJoin(stores, eq(stores.id, contacts.storeId)).where(eq(contacts.unsubscribeToken, token)).get();
  if (!row) notFound();
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        {done || !row.c.subscribed ? (
          <>
            <h1 className="text-lg font-bold">You're unsubscribed</h1>
            <p className="mt-2 text-sm text-slate-500">You won't get marketing emails from {row.store} any more. Receipts for purchases will still arrive.</p>
          </>
        ) : (
          <>
            <h1 className="text-lg font-bold">Unsubscribe from {row.store}?</h1>
            <p className="mt-2 text-sm text-slate-500">{row.c.email}</p>
            <form action={confirm} className="mt-5">
              <input type="hidden" name="token" value={token} />
              <button className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white">Unsubscribe</button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
