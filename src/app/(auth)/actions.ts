"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { createSession, destroySession } from "@/lib/auth";
import { db } from "@/lib/db";
import { stores, users } from "@/lib/db/schema";
import type { FormState } from "@/components/forms";
import { newId } from "@/lib/ids";
import { DUMMY_HASH, hashPassword, verifyPassword } from "@/lib/password";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request";
import { isEmail, normalizeSlug, slugError } from "@/lib/safe";
import { DEFAULT_THEME } from "@/lib/themes";

export async function signup(_: FormState, form: FormData): Promise<FormState> {
  const ip = await clientIp();
  if (!rateLimit(`signup:${ip}`, 5, 60 * 60_000).ok) return { error: "Too many sign-ups from this network. Try again later." };

  const name = String(form.get("name") ?? "").trim().slice(0, 80);
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const slug = normalizeSlug(String(form.get("slug") ?? ""));

  if (!name) return { error: "Enter your name." };
  if (!isEmail(email)) return { error: "Enter a valid email address." };
  if (password.length < 10) return { error: "Use a password with at least 10 characters." };
  if (password.length > 200) return { error: "That password is too long." };
  const bad = slugError(slug);
  if (bad) return { error: `Store link: ${bad}` };

  if (await db.select({ id: users.id }).from(users).where(eq(users.email, email)).get())
    return { error: "An account with this email already exists. Try logging in." };
  if (await db.select({ id: stores.id }).from(stores).where(eq(stores.slug, slug)).get())
    return { error: "That store link is taken. Try another." };

  const userId = newId();
  const passwordHash = await hashPassword(password);
  try {
    db.transaction((tx) => {
      tx.insert(users).values({ id: userId, email, name, passwordHash }).run();
      tx.insert(stores)
        .values({ id: newId(), userId, slug, displayName: name, bio: "", theme: DEFAULT_THEME })
        .run();
    });
  } catch {
    return { error: "That email or store link was just taken. Try again." };
  }
  await createSession(userId);
  redirect("/dashboard?welcome=1");
}

export async function login(_: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const ip = await clientIp();
  if (!rateLimit(`login:ip:${ip}`, 20, 15 * 60_000).ok || !rateLimit(`login:email:${email}`, 8, 15 * 60_000).ok)
    return { error: "Too many attempts. Wait a few minutes and try again." };

  const user = await db.select().from(users).where(eq(users.email, email)).get();
  // Always run a hash check so response time doesn't reveal which emails exist.
  const ok = await verifyPassword(password.slice(0, 200), user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) return { error: "Email or password is incorrect." };
  await createSession(user.id);
  const next = String(form.get("next") ?? "");
  redirect(next.startsWith("/dashboard") ? next : "/dashboard");
}

export async function logout() {
  await destroySession();
  redirect("/");
}
