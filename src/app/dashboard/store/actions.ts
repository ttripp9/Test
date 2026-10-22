"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import type { FormState } from "@/components/forms";
import { requireCreator } from "@/lib/auth";
import { db } from "@/lib/db";
import { stores, type StoreSocials, type StoreTheme } from "@/lib/db/schema";
import { removeMedia, uploadMedia } from "@/lib/media";
import { getPlan } from "@/lib/plans";
import { cleanPixelIds, isHexColor, normalizeSlug, safeHttpUrl, sanitizeCss, slugError, isEmail } from "@/lib/safe";
import { THEME_PRESETS } from "@/lib/themes";

const str = (f: FormData, k: string, max = 500) => String(f.get(k) ?? "").trim().slice(0, max);

export async function saveProfile(_: FormState, form: FormData): Promise<FormState> {
  const { store } = await requireCreator();
  const displayName = str(form, "displayName", 80);
  if (!displayName) return { error: "Add a display name." };
  const slug = normalizeSlug(str(form, "slug", 40));
  const bad = slugError(slug);
  if (bad) return { error: `Store link: ${bad}` };
  if (slug !== store.slug) {
    const taken = await db.select({ id: stores.id }).from(stores).where(eq(stores.slug, slug)).get();
    if (taken) return { error: "That store link is taken." };
  }
  const timezone = str(form, "timezone", 64);
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
  } catch {
    return { error: "Pick a valid time zone." };
  }
  const currency = str(form, "currency", 3).toLowerCase();
  if (!["usd", "eur", "gbp", "cad", "aud"].includes(currency)) return { error: "Pick a supported currency." };

  let avatarMediaId = store.avatarMediaId;
  try {
    const uploaded = await uploadMedia(store.id, form.get("avatar"), "image");
    if (uploaded) {
      await removeMedia(store.id, store.avatarMediaId);
      avatarMediaId = uploaded;
    }
  } catch (e) {
    return { error: (e as Error).message };
  }
  if (form.get("removeAvatar") === "on") {
    await removeMedia(store.id, store.avatarMediaId);
    avatarMediaId = null;
  }

  const socials: StoreSocials = {};
  for (const key of ["instagram", "tiktok", "youtube", "x", "linkedin", "threads", "website"] as const) {
    const url = safeHttpUrl(str(form, key, 300));
    if (url) socials[key] = url;
  }
  const email = str(form, "email", 254);
  if (email && isEmail(email)) socials.email = email;

  await db
    .update(stores)
    .set({
      displayName,
      slug,
      bio: str(form, "bio", 400),
      timezone,
      currency,
      published: form.get("published") === "on",
      avatarMediaId,
      socials,
    })
    .where(eq(stores.id, store.id))
    .run();
  revalidatePath("/dashboard", "layout");
  return { ok: "Saved." };
}

export async function saveDesign(_: FormState, form: FormData): Promise<FormState> {
  const { user, store } = await requireCreator();
  const preset = str(form, "preset", 20);
  const base = THEME_PRESETS[preset] ?? THEME_PRESETS.minimal;
  const color = (k: keyof typeof base) => {
    const v = str(form, k, 7);
    return isHexColor(v) ? v : (base[k] as string);
  };
  const font = str(form, "font", 10) as StoreTheme["font"];
  const shape = str(form, "buttonShape", 10) as StoreTheme["buttonShape"];
  const layout = str(form, "layout", 10) as StoreTheme["layout"];
  const theme: StoreTheme = {
    preset: THEME_PRESETS[preset] ? preset : "minimal",
    accent: color("accent"),
    background: color("background"),
    text: color("text"),
    card: color("card"),
    font: ["sans", "serif", "mono", "rounded"].includes(font) ? font : base.font,
    buttonShape: ["pill", "rounded", "square"].includes(shape) ? shape : "pill",
    layout: layout === "grid" ? "grid" : "list",
  };
  const plan = getPlan(user.plan);
  const customCss = plan.customCss ? sanitizeCss(String(form.get("customCss") ?? "")) : store.customCss;
  await db.update(stores).set({ theme, customCss }).where(eq(stores.id, store.id)).run();
  revalidatePath("/dashboard/store");
  return { ok: plan.customCss || !form.get("customCss") ? "Design saved." : "Design saved. Custom CSS needs the Business plan." };
}

export async function applyPreset(form: FormData) {
  const { store } = await requireCreator();
  const preset = String(form.get("preset") ?? "");
  const base = THEME_PRESETS[preset];
  if (!base) return;
  await db
    .update(stores)
    .set({ theme: { ...store.theme, ...base, preset } })
    .where(eq(stores.id, store.id))
    .run();
  revalidatePath("/dashboard/store");
}

export async function savePixels(_: FormState, form: FormData): Promise<FormState> {
  const { store } = await requireCreator();
  const raw = { metaPixelId: str(form, "metaPixelId", 40), tiktokPixelId: str(form, "tiktokPixelId", 40), ga4Id: str(form, "ga4Id", 40) };
  const pixels = cleanPixelIds(raw);
  const rejected = (Object.keys(raw) as (keyof typeof raw)[]).filter((k) => raw[k] && !pixels[k]);
  await db.update(stores).set({ pixels }).where(eq(stores.id, store.id)).run();
  revalidatePath("/dashboard/store");
  if (rejected.length) return { error: `Saved, but these IDs don't look right and were skipped: ${rejected.join(", ")}` };
  return { ok: "Tracking pixels saved." };
}
