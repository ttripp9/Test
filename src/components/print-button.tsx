"use client";

export function PrintButton() {
  return (
    <button onClick={() => window.print()} className="no-print mt-6 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white">
      Print or save as PDF
    </button>
  );
}
