import { notFound } from "next/navigation";
import { PrintButton } from "@/components/print-button";
import { accessibleProduct, courseState } from "@/lib/access";
import { contrastText } from "@/lib/themes";

export const dynamic = "force-dynamic";
export const metadata = { title: "Certificate of completion", robots: { index: false } };

export default async function Certificate({ params }: { params: Promise<{ token: string; productId: string }> }) {
  const { token, productId } = await params;
  const access = await accessibleProduct(token, productId);
  if (!access || access.product.type !== "course") notFound();
  const state = await courseState(access.order.id, productId);
  if (state.percent < 100 || !state.finishedAt) notFound();
  const { store, product, order } = access;
  const accent = store.theme.accent;
  const certId = `${order.id.slice(0, 8)}-${product.id.slice(0, 4)}`.toUpperCase();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-100 p-4 print:bg-white">
      <div className="aspect-[1.414/1] w-full max-w-3xl rounded-lg bg-white p-[5%] text-center shadow-xl print:shadow-none" style={{ border: `10px solid ${accent}` }}>
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500">Certificate of completion</p>
        <p className="mt-[6%] text-sm text-slate-500">This certifies that</p>
        <p className="mt-2 font-serif text-3xl font-bold text-slate-900 sm:text-5xl">{order.buyerName || order.buyerEmail}</p>
        <p className="mt-[4%] text-sm text-slate-500">has successfully completed</p>
        <p className="mt-2 text-xl font-bold sm:text-2xl" style={{ color: contrastText(accent) === "#ffffff" ? accent : "#0f172a" }}>{product.title}</p>
        <div className="mt-[8%] flex items-end justify-between text-left text-xs text-slate-500">
          <div>
            <div className="text-base font-semibold text-slate-900">{store.displayName}</div>
            <div>Instructor</div>
          </div>
          <div className="text-right">
            <div className="text-base font-semibold text-slate-900">{state.finishedAt.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</div>
            <div>Certificate ID {certId}</div>
          </div>
        </div>
      </div>
      <PrintButton />
    </div>
  );
}
