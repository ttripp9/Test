import { and, desc, eq, type SQL } from "drizzle-orm";
import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Badge, Card, Empty, PageHeader, Table, Td, cx } from "@/components/ui";
import { requireCreator } from "@/lib/auth";
import { db } from "@/lib/db";
import { affiliates, orders, products, type OrderStatus } from "@/lib/db/schema";
import { formatMoney } from "@/lib/money";
import { refundOrder, resendAccess } from "./actions";

const TONES: Record<OrderStatus, "green" | "gray" | "amber" | "red"> = { paid: "green", pending: "amber", refunded: "red", canceled: "gray", expired: "gray" };
const FILTERS = ["all", "paid", "pending", "refunded", "canceled"] as const;

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ status?: string; page?: string }> }) {
  const { store } = await requireCreator();
  const sp = await searchParams;
  const status = FILTERS.includes(sp.status as (typeof FILTERS)[number]) ? sp.status! : "all";
  const page = Math.max(1, Number(sp.page) || 1);
  const conds: SQL[] = [eq(orders.storeId, store.id)];
  if (status !== "all") conds.push(eq(orders.status, status as OrderStatus));
  const rows = await db
    .select({ order: orders, title: products.title, affiliate: affiliates.name })
    .from(orders)
    .innerJoin(products, eq(products.id, orders.productId))
    .leftJoin(affiliates, eq(affiliates.id, orders.affiliateId))
    .where(and(...conds))
    .orderBy(desc(orders.createdAt))
    .limit(51)
    .offset((page - 1) * 50)
    .all();
  const more = rows.length > 50;
  return (
    <>
      <PageHeader title="Orders" description="Every sale and free signup." />
      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link key={f} href={`/dashboard/orders?status=${f}`} className={cx("rounded-full px-3 py-1 text-sm capitalize ring-1", f === status ? "bg-slate-900 text-white ring-slate-900" : "bg-white ring-slate-200")}>
            {f}
          </Link>
        ))}
      </div>
      <Card>
        {rows.length === 0 ? (
          <Empty title="No orders here yet" />
        ) : (
          <Table head={["Date", "Buyer", "Product", "Total", "Status", ""]}>
            {rows.slice(0, 50).map(({ order: o, title, affiliate }) => (
              <tr key={o.id}>
                <Td className="text-slate-500">{o.createdAt.toLocaleDateString()}</Td>
                <Td>
                  <div className="font-medium">{o.buyerName || "—"}</div>
                  <div className="text-xs text-slate-500">{o.buyerEmail}</div>
                </Td>
                <Td>
                  {title}
                  {o.bumpProductId && <div className="text-xs text-slate-500">+ order bump</div>}
                  {affiliate && <div className="text-xs text-slate-500">via {affiliate}</div>}
                </Td>
                <Td className="tabular-nums">
                  {o.totalCents ? formatMoney(o.totalCents, o.currency) : "Free"}
                  {o.discountCents > 0 && <div className="text-xs text-slate-500">−{formatMoney(o.discountCents, o.currency)} off</div>}
                  {o.platformFeeCents > 0 && <div className="text-xs text-slate-400">fee {formatMoney(o.platformFeeCents, o.currency)}</div>}
                </Td>
                <Td><Badge tone={TONES[o.status]}>{o.status}</Badge></Td>
                <Td>
                  {o.status === "paid" && (
                    <details className="relative">
                      <summary className="cursor-pointer list-none text-sm text-brand-700">Manage</summary>
                      <div className="absolute right-0 z-10 mt-1 w-56 space-y-2 rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
                        <ActionForm action={resendAccess}>
                          <input type="hidden" name="id" value={o.id} />
                          <SubmitButton variant="secondary" size="sm" className="w-full" pendingText="Sending…">Resend access email</SubmitButton>
                        </ActionForm>
                        <ActionForm action={refundOrder}>
                          <input type="hidden" name="id" value={o.id} />
                          <SubmitButton variant="danger" size="sm" className="w-full" pendingText="Refunding…">{o.totalCents ? "Refund & revoke" : "Revoke access"}</SubmitButton>
                        </ActionForm>
                      </div>
                    </details>
                  )}
                </Td>
              </tr>
            ))}
          </Table>
        )}
        {(page > 1 || more) && (
          <div className="mt-4 flex justify-between text-sm">
            {page > 1 ? <Link href={`/dashboard/orders?status=${status}&page=${page - 1}`}>← Newer</Link> : <span />}
            {more && <Link href={`/dashboard/orders?status=${status}&page=${page + 1}`}>Older →</Link>}
          </div>
        )}
      </Card>
    </>
  );
}
