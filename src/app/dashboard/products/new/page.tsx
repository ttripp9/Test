import { Badge, PageHeader } from "@/components/ui";
import { requireCreator } from "@/lib/auth";
import type { ProductType } from "@/lib/db/schema";
import { getPlan } from "@/lib/plans";
import { PRODUCT_TYPES } from "@/lib/product-types";
import { createProduct } from "../actions";

export default async function NewProduct() {
  const { user } = await requireCreator();
  const plan = getPlan(user.plan);
  return (
    <>
      <PageHeader title="What do you want to sell?" description="Pick a type. You can change all the details next." />
      <div className="grid gap-3 sm:grid-cols-2">
        {(Object.entries(PRODUCT_TYPES) as [ProductType, (typeof PRODUCT_TYPES)[ProductType]][]).map(([type, t]) => {
          const locked = !plan.productTypes.includes(type);
          return (
            <form key={type} action={createProduct}>
              <input type="hidden" name="type" value={type} />
              <button className="flex h-full w-full items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-brand-500 hover:shadow">
                <span className="text-3xl" aria-hidden>{t.emoji}</span>
                <span>
                  <span className="flex items-center gap-2 font-semibold">
                    {t.label} {locked && <Badge tone="purple">Pro</Badge>}
                  </span>
                  <span className="mt-0.5 block text-sm text-slate-500">{t.description}</span>
                </span>
              </button>
            </form>
          );
        })}
      </div>
    </>
  );
}
