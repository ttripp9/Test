import { desc, eq } from "drizzle-orm";
import { requireCreator } from "@/lib/auth";
import { toCsv } from "@/lib/contacts";
import { db } from "@/lib/db";
import { contacts } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  const { store } = await requireCreator();
  const rows = await db.select().from(contacts).where(eq(contacts.storeId, store.id)).orderBy(desc(contacts.createdAt)).all();
  return new Response(toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${store.slug}-contacts.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
