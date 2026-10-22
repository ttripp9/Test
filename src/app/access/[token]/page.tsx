import Link from "next/link";
import { notFound } from "next/navigation";
import { StoreShell, storeButtonClass, storeButtonStyle, storeCardClass, storeCardStyle } from "@/components/store-shell";
import { courseState, loadAccess } from "@/lib/access";
import { formatSlot } from "@/lib/booking";
import { db } from "@/lib/db";
import { bookings, media } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { PRODUCT_TYPES } from "@/lib/product-types";
import { renderMarkdown } from "@/lib/safe";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your purchase", robots: { index: false } };

export default async function AccessPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const access = await loadAccess(token);
  if (!access) notFound();
  const { order, store, product, unlocked } = access;
  const booking = await db.select().from(bookings).where(eq(bookings.orderId, order.id)).get();

  if (order.status !== "paid") {
    const msg =
      order.status === "pending" ? "Your payment is still processing. Check back in a minute."
      : order.status === "canceled" ? "This membership has ended. Rejoin any time from the store."
      : order.status === "refunded" ? "This order was refunded, so access has been removed."
      : "This order is no longer active.";
    return (
      <StoreShell store={store} showBranding={false} compactHeader>
        <div className={`${storeCardClass} p-6 text-center`} style={storeCardStyle}>
          <h1 className="text-xl font-bold">{product.title}</h1>
          <p className="mt-2 text-sm opacity-80">{msg}</p>
          <Link href={`/${store.slug}`} className={`${storeButtonClass} mt-5`} style={storeButtonStyle}>Visit the store</Link>
        </div>
      </StoreShell>
    );
  }

  const items = await Promise.all(
    unlocked.map(async (p) => ({
      p,
      file: p.fileMediaId ? await db.select().from(media).where(eq(media.id, p.fileMediaId)).get() : null,
      course: p.type === "course" ? await courseState(order.id, p.id) : null,
    })),
  );

  return (
    <StoreShell store={store} showBranding={false} compactHeader>
      <h1 className="mb-1 text-2xl font-bold">Your library</h1>
      <p className="mb-6 text-sm opacity-70">Bookmark this page — it's your personal link. Bought by {order.buyerEmail}.</p>
      <div className="space-y-4">
        {items.map(({ p, file, course }) => (
          <section key={p.id} className={`${storeCardClass} p-5`} style={storeCardStyle}>
            <p className="text-xs font-semibold uppercase tracking-wide opacity-60">{PRODUCT_TYPES[p.type].emoji} {PRODUCT_TYPES[p.type].label}</p>
            <h2 className="mt-1 text-lg font-bold">{p.title}</h2>

            {p.type === "booking" && booking && (
              <div className="mt-3 text-sm">
                <p>
                  {booking.status === "confirmed" ? "Booked for" : "Status:"} <b>{booking.status === "confirmed" ? formatSlot(booking.startAt, store.timezone) : booking.status}</b>
                </p>
                {p.settings.meetingUrl && booking.status === "confirmed" && (
                  <a href={p.settings.meetingUrl} target="_blank" rel="noopener noreferrer" className={`${storeButtonClass} mt-3`} style={storeButtonStyle}>Join the call</a>
                )}
              </div>
            )}

            {p.type === "membership" && (
              <div className="rich mt-3 text-[15px]" dangerouslySetInnerHTML={{ __html: renderMarkdown(p.settings.memberContent || "Welcome! Members-only content will appear here.") }} />
            )}

            {p.type === "tip" && <p className="mt-2 text-sm opacity-80">Thank you so much for your support. 💛</p>}

            {course && (
              <div className="mt-3">
                <div className="h-2 overflow-hidden rounded-full bg-black/10">
                  <div className="h-full" style={{ width: `${course.percent}%`, background: "var(--accent)" }} />
                </div>
                <p className="mt-1 text-xs opacity-70">{course.percent}% complete · {course.lessons.length} lessons</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link href={`/access/${token}/course/${p.id}`} className={storeButtonClass} style={{ ...storeButtonStyle, width: "auto" }}>
                    {course.percent ? "Continue course" : "Start course"}
                  </Link>
                  {course.percent === 100 && (
                    <Link href={`/access/${token}/certificate/${p.id}`} className="inline-flex items-center px-4 text-sm font-semibold underline">View certificate</Link>
                  )}
                </div>
              </div>
            )}

            {(file || p.settings.deliveryUrl) && (
              <div className="mt-3 flex flex-wrap gap-2">
                {file && (
                  <a href={`/access/${token}/download/${p.id}`} className={storeButtonClass} style={{ ...storeButtonStyle, width: "auto" }}>
                    Download {file.filename}
                  </a>
                )}
                {p.settings.deliveryUrl && (
                  <a href={p.settings.deliveryUrl} target="_blank" rel="noopener noreferrer" className={storeButtonClass} style={{ ...storeButtonStyle, width: "auto" }}>
                    Open your content ↗
                  </a>
                )}
              </div>
            )}
            {file && (
              <p className="mt-2 text-xs opacity-60">
                {Math.max(0, (p.settings.maxDownloads ?? 20) - order.downloads)} downloads left
              </p>
            )}
          </section>
        ))}
      </div>
    </StoreShell>
  );
}
