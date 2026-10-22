import { and, asc, eq, inArray } from "drizzle-orm";
import { orderByToken, unlockedProducts } from "./commerce";
import { db } from "./db";
import { lessonProgress, lessons } from "./db/schema";

export async function loadAccess(token: string) {
  const row = await orderByToken(token);
  if (!row) return null;
  const unlocked = row.order.status === "paid" ? await unlockedProducts(row.order) : [];
  return { ...row, unlocked };
}

/** The product, if this access token unlocks it and the order is in good standing. */
export async function accessibleProduct(token: string, productId: string) {
  const access = await loadAccess(token);
  if (!access || access.order.status !== "paid") return null;
  const product = access.unlocked.find((p) => p.id === productId);
  return product ? { ...access, product } : null;
}

export async function courseState(orderId: string, productId: string) {
  const list = await db.select().from(lessons).where(eq(lessons.productId, productId)).orderBy(asc(lessons.position)).all();
  const progress = list.length
    ? await db
        .select()
        .from(lessonProgress)
        .where(and(eq(lessonProgress.orderId, orderId), inArray(lessonProgress.lessonId, list.map((l) => l.id))))
        .all()
    : [];
  const done = new Set(progress.filter((p) => p.completedAt).map((p) => p.lessonId));
  const percent = list.length ? Math.round((done.size / list.length) * 100) : 0;
  const finishedAt = percent === 100 ? new Date(Math.max(...progress.map((p) => p.completedAt?.getTime() ?? 0))) : null;
  return { lessons: list, progress, done, percent, finishedAt };
}
