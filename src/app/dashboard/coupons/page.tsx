import { and, desc, eq } from "drizzle-orm";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Badge, Card, Empty, Field, Input, PageHeader, Select, Table, Td } from "@/components/ui";
import { requireCreator } from "@/lib/auth";
import { db } from "@/lib/db";
import { coupons, products } from "@/lib/db/schema";
import { formatMoney } from "@/lib/money";
import { createCoupon, toggleCoupon } from "./actions";

export default async function CouponsPage() {
  const { store } = await requireCreator();
  const [list, items] = await Promise.all([
    db.select({ c: coupons, product: products.title }).from(coupons).leftJoin(products, eq(products.id, coupons.productId)).where(eq(coupons.storeId, store.id)).orderBy(desc(coupons.createdAt)).all(),
    db.select({ id: products.id, title: products.title }).from(products).where(and(eq(products.storeId, store.id), eq(products.archived, false))).all(),
  ]);
  return (
    <>
      <PageHeader title="Coupons" description="Discount codes buyers enter at checkout." />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          {list.length === 0 ? (
            <Empty title="No codes yet">Try a launch code like LAUNCH20.</Empty>
          ) : (
            <Table head={["Code", "Discount", "Applies to", "Used", "Status"]}>
              {list.map(({ c, product }) => {
                const expired = c.expiresAt && c.expiresAt < new Date();
                return (
                  <tr key={c.id}>
                    <Td className="font-mono font-semibold">{c.code}</Td>
                    <Td>{c.percentOff ? `${c.percentOff}% off` : `${formatMoney(c.amountOffCents ?? 0, store.currency)} off`}</Td>
                    <Td className="text-slate-500">{product ?? "Everything"}</Td>
                    <Td className="tabular-nums">{c.redemptions}{c.maxRedemptions ? ` / ${c.maxRedemptions}` : ""}</Td>
                    <Td>
                      <form action={toggleCoupon}>
                        <input type="hidden" name="id" value={c.id} />
                        <button title="Toggle">{expired ? <Badge tone="amber">Expired</Badge> : c.active ? <Badge tone="green">Active</Badge> : <Badge>Off</Badge>}</button>
                      </form>
                    </Td>
                  </tr>
                );
              })}
            </Table>
          )}
        </Card>
        <Card title="New code">
          <ActionForm action={createCoupon} className="space-y-3" resetOnSuccess>
            <Field label="Code">
              <Input name="code" required className="uppercase" placeholder="LAUNCH20" />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Type">
                <Select name="kind">
                  <option value="percent">% off</option>
                  <option value="amount">Amount off</option>
                </Select>
              </Field>
              <Field label="Value">
                <Input name="value" required inputMode="decimal" placeholder="20" />
              </Field>
            </div>
            <Field label="Product">
              <Select name="productId">
                <option value="">All products</option>
                {items.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
              </Select>
            </Field>
            <Field label="Max uses" hint="Leave empty for unlimited">
              <Input name="maxRedemptions" type="number" min={1} />
            </Field>
            <Field label="Ends on" hint="Optional">
              <Input name="expiresAt" type="date" />
            </Field>
            <SubmitButton>Create code</SubmitButton>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
