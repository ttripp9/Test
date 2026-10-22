import { and, asc, desc, eq, gte, lt } from "drizzle-orm";
import { ConfirmButton } from "@/components/forms";
import { Badge, Card, Empty, PageHeader, Table, Td } from "@/components/ui";
import { requireCreator } from "@/lib/auth";
import { formatSlot } from "@/lib/booking";
import { db } from "@/lib/db";
import { bookings, orders, products } from "@/lib/db/schema";
import { cancelBooking } from "./actions";

export default async function BookingsPage() {
  const { store } = await requireCreator();
  const now = new Date();
  const base = db
    .select({ b: bookings, title: products.title, email: orders.buyerEmail, name: orders.buyerName })
    .from(bookings)
    .innerJoin(products, eq(products.id, bookings.productId))
    .innerJoin(orders, eq(orders.id, bookings.orderId));
  const [upcoming, past] = await Promise.all([
    base.where(and(eq(bookings.storeId, store.id), eq(bookings.status, "confirmed"), gte(bookings.endAt, now))).orderBy(asc(bookings.startAt)).all(),
    db
      .select({ b: bookings, title: products.title, email: orders.buyerEmail, name: orders.buyerName })
      .from(bookings)
      .innerJoin(products, eq(products.id, bookings.productId))
      .innerJoin(orders, eq(orders.id, bookings.orderId))
      .where(and(eq(bookings.storeId, store.id), lt(bookings.endAt, now)))
      .orderBy(desc(bookings.startAt))
      .limit(20)
      .all(),
  ]);
  return (
    <>
      <PageHeader title="Bookings" description={`Times shown in ${store.timezone}.`} />
      <Card title="Upcoming" className="mb-6">
        {upcoming.length === 0 ? (
          <Empty title="No upcoming calls" />
        ) : (
          <Table head={["When", "Who", "Call", ""]}>
            {upcoming.map(({ b, title, email, name }) => (
              <tr key={b.id}>
                <Td className="font-medium">{formatSlot(b.startAt, store.timezone)}</Td>
                <Td>{name || "—"}<div className="text-xs text-slate-500">{email}</div></Td>
                <Td>{title}</Td>
                <Td>
                  <form action={cancelBooking}>
                    <input type="hidden" name="id" value={b.id} />
                    <ConfirmButton message="Cancel this call? The buyer will be emailed. Refund them from Orders if needed.">Cancel</ConfirmButton>
                  </form>
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
      {past.length > 0 && (
        <Card title="Past">
          <Table head={["When", "Who", "Call", "Status"]}>
            {past.map(({ b, title, email }) => (
              <tr key={b.id}>
                <Td>{formatSlot(b.startAt, store.timezone)}</Td>
                <Td className="text-slate-500">{email}</Td>
                <Td>{title}</Td>
                <Td><Badge tone={b.status === "confirmed" ? "green" : "gray"}>{b.status === "confirmed" ? "done" : b.status}</Badge></Td>
              </tr>
            ))}
          </Table>
        </Card>
      )}
    </>
  );
}
