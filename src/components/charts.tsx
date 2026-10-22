import { formatMoney } from "@/lib/money";

/** Simple, dependency-free bar chart rendered as SVG. */
export function BarChart({ data, money, currency = "usd", height = 160 }: { data: { label: string; value: number }[]; money?: boolean; currency?: string; height?: number }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const w = 100 / Math.max(1, data.length);
  const total = data.reduce((n, d) => n + d.value, 0);
  return (
    <figure>
      <svg viewBox={`0 0 100 ${height / 4}`} preserveAspectRatio="none" className="w-full" style={{ height }} role="img" aria-label={`Total ${money ? formatMoney(total, currency) : total}`}>
        {data.map((d, i) => {
          const h = (d.value / max) * (height / 4 - 2);
          return (
            <rect key={i} x={i * w + w * 0.15} y={height / 4 - h} width={w * 0.7} height={Math.max(h, d.value ? 0.6 : 0.2)} rx={0.6} className={d.value ? "fill-brand-500" : "fill-slate-200"}>
              <title>{`${d.label}: ${money ? formatMoney(d.value, currency) : d.value}`}</title>
            </rect>
          );
        })}
      </svg>
      <figcaption className="mt-1 flex justify-between text-[11px] text-slate-400">
        <span>{data[0]?.label}</span>
        <span>{data[data.length - 1]?.label}</span>
      </figcaption>
    </figure>
  );
}
