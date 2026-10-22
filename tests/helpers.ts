import { openDatabase, setDbForTests } from "@/lib/db";
import { products, stores, users, type ProductSettings, type ProductType } from "@/lib/db/schema";
import { newId } from "@/lib/ids";
import { DEFAULT_THEME } from "@/lib/themes";
import type { PlanId } from "@/lib/db/schema";

export function freshDb() {
  const { db } = openDatabase(":memory:");
  setDbForTests(db);
  return db;
}

export async function makeStore(plan: PlanId = "pro") {
  const db = freshDb();
  const userId = newId();
  await db.insert(users).values({ id: userId, email: "creator@example.com", name: "Cara", passwordHash: "x", plan });
  const storeId = newId();
  await db.insert(stores).values({ id: storeId, userId, slug: "cara", displayName: "Cara Creates", theme: DEFAULT_THEME, timezone: "America/New_York" });
  return { db, userId, storeId };
}

export async function makeProduct(
  storeId: string,
  type: ProductType,
  priceCents: number,
  settings: ProductSettings = {},
) {
  const { db } = await import("@/lib/db");
  const id = newId();
  await db.insert(products).values({ id, storeId, type, title: `${type} product`, priceCents, settings });
  return id;
}
