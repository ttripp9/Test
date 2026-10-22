import { and, asc, eq } from "drizzle-orm";
import Link from "next/link";
import { Badge, Card, Empty, LinkButton, PageHeader } from "@/components/ui";
import { requireCreator } from "@/lib/auth";
import { db } from "@/lib/db";
import { products } from "@/lib/db/schema";
import { formatMoney } from "@/lib/money";
import { getPlan } from "@/lib/plans";
import { PRODUCT_TYPES } from "@/lib/product-types";
import { moveProduct, toggleProduct } from "./actions";

export default async function ProductsPage() {
  const { user, store } = await requireCreator();
  const plan = getPlan(user.plan);
  const list = await db
    .select()
    .from(products)
    .where(and(eq(products.storeId, store.id), eq(products.archived, false)))
    .orderBy(asc(products.position), asc(products.createdAt))
    .all();
  return (
    <>
      <PageHeader
        title="Products"
        description={`${list.length} of ${plan.maxProducts} on the ${plan.name} plan. Use the arrows to set the order on your store.`}
        actions={<LinkButton href="/dashboard/products/new" variant="brand">New product</LinkButton>}
      />
      <Card>
        {list.length === 0 ? (
          <Empty title="No products yet">
            <Link className="text-brand-700 underline" href="/dashboard/products/new">Add your first product</Link> — a free lead magnet is a great start.
          </Empty>
        ) : (
          <ul className="divide-y divide-slate-100">
            {list.map((p, i) => {
              const t = PRODUCT_TYPES[p.type];
              return (
                <li key={p.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="flex flex-col">
                    <form action={moveProduct}>
                      <input type="hidden" name="id" value={p.id} />
                      <input type="hidden" name="dir" value="up" />
                      <button disabled={i === 0} aria-label="Move up" className="px-1 text-slate-400 hover:text-slate-900 disabled:opacity-20">▲</button>
                    </form>
                    <form action={moveProduct}>
                      <input type="hidden" name="id" value={p.id} />
                      <input type="hidden" name="dir" value="down" />
                      <button disabled={i === list.length - 1} aria-label="Move down" className="px-1 text-slate-400 hover:text-slate-900 disabled:opacity-20">▼</button>
                    </form>
                  </div>
                  <span className="text-2xl" aria-hidden>{t.emoji}</span>
                  <Link href={`/dashboard/products/${p.id}`} className="min-w-0 flex-1">
                    <div className="truncate font-medium hover:underline">{p.title}</div>
                    <div className="text-xs text-slate-500">
                      {t.label}
                      {p.type !== "link" && ` · ${p.type === "tip" ? "Any amount" : p.priceCents ? formatMoney(p.priceCents, store.currency) : "Free"}`}
                      {p.type === "membership" && ` / ${p.settings.interval ?? "month"}`}
                    </div>
                  </Link>
                  <form action={toggleProduct}>
                    <input type="hidden" name="id" value={p.id} />
                    <button title="Click to toggle">{p.active ? <Badge tone="green">Live</Badge> : <Badge>Hidden</Badge>}</button>
                  </form>
                  <LinkButton href={`/dashboard/products/${p.id}`} variant="secondary" size="sm">Edit</LinkButton>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}
