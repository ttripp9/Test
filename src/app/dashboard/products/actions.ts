"use server";

import { and, asc, count, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "@/components/forms";
import { requireCreator } from "@/lib/auth";
import { parseQuizText } from "@/lib/courses";
import { db } from "@/lib/db";
import { lessons, products, type ProductSettings, type ProductType } from "@/lib/db/schema";
import { newId } from "@/lib/ids";
import { removeMedia, uploadMedia } from "@/lib/media";
import { parseMoneyToCents } from "@/lib/money";
import { getPlan } from "@/lib/plans";
import { PRODUCT_TYPES } from "@/lib/product-types";
import { safeHttpUrl } from "@/lib/safe";

const str = (f: FormData, k: string, max = 500) => String(f.get(k) ?? "").trim().slice(0, max);
const int = (f: FormData, k: string, min: number, max: number, fallback: number) => {
  const n = Number.parseInt(String(f.get(k) ?? ""), 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

async function ownedProduct(storeId: string, id: string) {
  const p = await db.select().from(products).where(and(eq(products.id, id), eq(products.storeId, storeId))).get();
  if (!p) throw new Error("Product not found");
  return p;
}

export async function createProduct(form: FormData) {
  const { user, store } = await requireCreator();
  const type = str(form, "type", 20) as ProductType;
  if (!PRODUCT_TYPES[type]) redirect("/dashboard/products/new");
  const plan = getPlan(user.plan);
  if (!plan.productTypes.includes(type)) redirect(`/dashboard/billing?need=${type}`);
  const total = (await db.select({ n: count() }).from(products).where(and(eq(products.storeId, store.id), eq(products.archived, false))).get())?.n ?? 0;
  if (total >= plan.maxProducts) redirect("/dashboard/billing?need=products");

  const defaults: Record<ProductType, { title: string; price: number; settings: ProductSettings }> = {
    digital: { title: "My digital product", price: 1900, settings: {} },
    lead_magnet: { title: "Free guide", price: 0, settings: {} },
    course: { title: "My course", price: 9900, settings: {} },
    booking: { title: "30-minute call", price: 7500, settings: { durationMinutes: 30, bufferMinutes: 15, weekdays: [1, 2, 3, 4, 5], startTime: "09:00", endTime: "17:00", daysAhead: 14 } },
    membership: { title: "Inner circle", price: 900, settings: { interval: "month" } },
    tip: { title: "Buy me a coffee", price: 0, settings: { minPriceCents: 300 } },
    bundle: { title: "Everything bundle", price: 4900, settings: { bundleProductIds: [] } },
    link: { title: "My latest video", price: 0, settings: { url: "https://" } },
  };
  const d = defaults[type];
  const id = newId();
  await db
    .insert(products)
    .values({ id, storeId: store.id, type, title: d.title, priceCents: d.price, ctaLabel: PRODUCT_TYPES[type].cta, settings: d.settings, position: total, active: false })
    .run();
  redirect(`/dashboard/products/${id}?new=1`);
}

export async function saveProduct(_: FormState, form: FormData): Promise<FormState> {
  const { store } = await requireCreator();
  const product = await ownedProduct(store.id, str(form, "id", 32));
  const title = str(form, "title", 120);
  if (!title) return { error: "Give your product a title." };

  const settings: ProductSettings = { ...product.settings };
  let priceCents = product.priceCents;
  if (["digital", "course", "booking", "membership", "bundle"].includes(product.type)) {
    const p = parseMoneyToCents(str(form, "price", 20));
    if (p == null) return { error: "Enter a price like 19 or 19.99." };
    if (p !== 0 && p < 50) return { error: "Prices must be 0 or at least 0.50." };
    if (product.type === "membership" && p < 100) return { error: "Membership price must be at least 1.00." };
    priceCents = p;
  }
  const compareRaw = str(form, "compareAt", 20);
  const compareAtCents = compareRaw ? parseMoneyToCents(compareRaw) : null;

  if (product.type === "digital" || product.type === "lead_magnet" || product.type === "bundle" || product.type === "course") {
    const delivery = str(form, "deliveryUrl", 1000);
    settings.deliveryUrl = delivery ? (safeHttpUrl(delivery) ?? undefined) : undefined;
    if (delivery && !settings.deliveryUrl) return { error: "Delivery link must start with https://" };
    settings.thankYouMessage = str(form, "thankYouMessage", 1000) || undefined;
    settings.maxDownloads = int(form, "maxDownloads", 1, 1000, 20);
  }
  if (product.type === "digital" || product.type === "course") {
    settings.payWhatYouWant = form.get("payWhatYouWant") === "on";
    settings.minPriceCents = settings.payWhatYouWant ? (parseMoneyToCents(str(form, "minPrice", 20)) ?? priceCents) : undefined;
  }
  if (product.type === "tip") {
    settings.minPriceCents = Math.max(100, parseMoneyToCents(str(form, "minPrice", 20)) ?? 300);
    priceCents = settings.minPriceCents;
  }
  if (product.type === "booking") {
    settings.durationMinutes = int(form, "durationMinutes", 10, 480, 30);
    settings.bufferMinutes = int(form, "bufferMinutes", 0, 240, 15);
    settings.daysAhead = int(form, "daysAhead", 1, 90, 14);
    const hm = (k: string, fb: string) => (/^\d{2}:\d{2}$/.test(str(form, k, 5)) ? str(form, k, 5) : fb);
    settings.startTime = hm("startTime", "09:00");
    settings.endTime = hm("endTime", "17:00");
    if (settings.endTime <= settings.startTime) return { error: "End time must be after start time." };
    settings.weekdays = form.getAll("weekdays").map(Number).filter((n) => n >= 0 && n <= 6);
    if (!settings.weekdays.length) return { error: "Choose at least one day you're available." };
    const meeting = str(form, "meetingUrl", 500);
    settings.meetingUrl = meeting ? (safeHttpUrl(meeting) ?? undefined) : undefined;
  }
  if (product.type === "membership") {
    settings.interval = str(form, "interval", 5) === "year" ? "year" : "month";
    settings.memberContent = str(form, "memberContent", 20000);
  }
  if (product.type === "bundle") {
    const ids = form.getAll("bundleProductIds").map(String).slice(0, 50);
    const valid = ids.length
      ? await db.select({ id: products.id }).from(products).where(and(eq(products.storeId, store.id), inArray(products.id, ids))).all()
      : [];
    settings.bundleProductIds = valid.map((v) => v.id).filter((id) => id !== product.id);
  }
  if (product.type === "link") {
    const url = safeHttpUrl(str(form, "url", 1000));
    if (!url) return { error: "Enter a full link starting with https://" };
    settings.url = url;
  }
  if (product.type !== "link" && product.type !== "tip") {
    const bumpId = str(form, "bumpProductId", 32);
    if (bumpId && bumpId !== product.id) {
      await ownedProduct(store.id, bumpId);
      settings.bumpProductId = bumpId;
      settings.bumpPriceCents = parseMoneyToCents(str(form, "bumpPrice", 20)) ?? undefined;
    } else {
      settings.bumpProductId = undefined;
      settings.bumpPriceCents = undefined;
    }
    const upsellId = str(form, "upsellProductId", 32);
    if (upsellId && upsellId !== product.id) {
      await ownedProduct(store.id, upsellId);
      settings.upsellProductId = upsellId;
      settings.upsellDiscountPercent = int(form, "upsellDiscountPercent", 0, 90, 20);
    } else {
      settings.upsellProductId = undefined;
      settings.upsellDiscountPercent = undefined;
    }
  }

  let imageMediaId = product.imageMediaId;
  let fileMediaId = product.fileMediaId;
  try {
    const img = await uploadMedia(store.id, form.get("image"), "image");
    if (img) {
      await removeMedia(store.id, product.imageMediaId);
      imageMediaId = img;
    }
    const file = await uploadMedia(store.id, form.get("file"), "file");
    if (file) {
      await removeMedia(store.id, product.fileMediaId);
      fileMediaId = file;
    }
  } catch (e) {
    return { error: (e as Error).message };
  }
  if (form.get("removeImage") === "on") {
    await removeMedia(store.id, product.imageMediaId);
    imageMediaId = null;
  }
  if (form.get("removeFile") === "on") {
    await removeMedia(store.id, product.fileMediaId);
    fileMediaId = null;
  }

  await db
    .update(products)
    .set({
      title,
      subtitle: str(form, "subtitle", 160),
      description: str(form, "description", 20000),
      ctaLabel: str(form, "ctaLabel", 40) || PRODUCT_TYPES[product.type].cta,
      priceCents,
      compareAtCents: compareAtCents && compareAtCents > priceCents ? compareAtCents : null,
      active: form.get("active") === "on",
      settings,
      imageMediaId,
      fileMediaId,
    })
    .where(eq(products.id, product.id))
    .run();
  revalidatePath("/dashboard/products");
  revalidatePath(`/${store.slug}`);
  return { ok: "Product saved." };
}

export async function archiveProduct(form: FormData) {
  const { store } = await requireCreator();
  const product = await ownedProduct(store.id, str(form, "id", 32));
  await db.update(products).set({ archived: true, active: false }).where(eq(products.id, product.id)).run();
  revalidatePath("/dashboard/products");
  redirect("/dashboard/products");
}

export async function duplicateProduct(form: FormData) {
  const { user, store } = await requireCreator();
  const product = await ownedProduct(store.id, str(form, "id", 32));
  const plan = getPlan(user.plan);
  const total = (await db.select({ n: count() }).from(products).where(and(eq(products.storeId, store.id), eq(products.archived, false))).get())?.n ?? 0;
  if (total >= plan.maxProducts) redirect("/dashboard/billing?need=products");
  const id = newId();
  const src = await db.select().from(lessons).where(eq(lessons.productId, product.id)).all();
  db.transaction((tx) => {
    tx.insert(products)
      .values({ ...product, id, title: `${product.title} (copy)`, active: false, position: total, imageMediaId: null, fileMediaId: null, createdAt: new Date() })
      .run();
    for (const l of src) tx.insert(lessons).values({ ...l, id: newId(), productId: id, createdAt: new Date() }).run();
  });
  redirect(`/dashboard/products/${id}`);
}

export async function toggleProduct(form: FormData) {
  const { store } = await requireCreator();
  const product = await ownedProduct(store.id, str(form, "id", 32));
  await db.update(products).set({ active: !product.active }).where(eq(products.id, product.id)).run();
  revalidatePath("/dashboard/products");
}

export async function moveProduct(form: FormData) {
  const { store } = await requireCreator();
  const id = str(form, "id", 32);
  const dir = str(form, "dir", 4) === "up" ? -1 : 1;
  const list = await db
    .select({ id: products.id })
    .from(products)
    .where(and(eq(products.storeId, store.id), eq(products.archived, false)))
    .orderBy(asc(products.position), asc(products.createdAt))
    .all();
  const i = list.findIndex((p) => p.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  db.transaction((tx) => {
    list.forEach((p, pos) => tx.update(products).set({ position: pos }).where(eq(products.id, p.id)).run());
  });
  revalidatePath("/dashboard/products");
}

// ---- Course lessons ----

export async function addLesson(form: FormData) {
  const { store } = await requireCreator();
  const product = await ownedProduct(store.id, str(form, "productId", 32));
  const n = (await db.select({ n: count() }).from(lessons).where(eq(lessons.productId, product.id)).get())?.n ?? 0;
  if (n >= 300) return;
  await db
    .insert(lessons)
    .values({ id: newId(), productId: product.id, module: str(form, "module", 80) || "Module 1", title: str(form, "title", 120) || `Lesson ${n + 1}`, position: n })
    .run();
  revalidatePath(`/dashboard/products/${product.id}`);
}

export async function saveLesson(_: FormState, form: FormData): Promise<FormState> {
  const { store } = await requireCreator();
  const product = await ownedProduct(store.id, str(form, "productId", 32));
  const id = str(form, "lessonId", 32);
  const quizText = str(form, "quiz", 20000);
  const quiz = parseQuizText(quizText);
  if (quizText && quiz.length === 0) return { error: "Quiz format: start questions with 'Q:' and mark the right answer with '*'." };
  const video = str(form, "videoUrl", 500);
  if (video && !safeHttpUrl(video)) return { error: "Video link must start with https://" };
  await db
    .update(lessons)
    .set({
      title: str(form, "title", 120) || "Untitled lesson",
      module: str(form, "module", 80) || "Module 1",
      content: str(form, "content", 50000),
      videoUrl: video || null,
      quiz: quiz.length ? quiz : null,
      passPercent: int(form, "passPercent", 0, 100, 70),
    })
    .where(and(eq(lessons.id, id), eq(lessons.productId, product.id)))
    .run();
  revalidatePath(`/dashboard/products/${product.id}`);
  return { ok: "Lesson saved." };
}

export async function deleteLesson(form: FormData) {
  const { store } = await requireCreator();
  const product = await ownedProduct(store.id, str(form, "productId", 32));
  await db.delete(lessons).where(and(eq(lessons.id, str(form, "lessonId", 32)), eq(lessons.productId, product.id))).run();
  revalidatePath(`/dashboard/products/${product.id}`);
}

export async function moveLesson(form: FormData) {
  const { store } = await requireCreator();
  const product = await ownedProduct(store.id, str(form, "productId", 32));
  const list = await db.select({ id: lessons.id }).from(lessons).where(eq(lessons.productId, product.id)).orderBy(asc(lessons.position)).all();
  const i = list.findIndex((l) => l.id === str(form, "lessonId", 32));
  const j = i + (str(form, "dir", 4) === "up" ? -1 : 1);
  if (i < 0 || j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  db.transaction((tx) => list.forEach((l, pos) => tx.update(lessons).set({ position: pos }).where(eq(lessons.id, l.id)).run()));
  revalidatePath(`/dashboard/products/${product.id}`);
}
