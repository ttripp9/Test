import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 text-center">
      <h1 className="text-2xl font-bold">Page not found</h1>
      <p className="mt-2 text-sm text-slate-500">The link may be wrong, or the page was removed.</p>
      <Link href="/" className="mt-6 text-sm font-medium text-brand-700">Go home</Link>
    </div>
  );
}
