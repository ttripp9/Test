"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { FormState } from "@/components/forms";
import { classifySource, visitorId } from "@/lib/analytics";
import { CheckoutError, createCheckout } from "@/lib/commerce";
import { parseMoneyToCents } from "@/lib/money";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp, userAgent } from "@/lib/request";

export async function startCheckout(_: FormState, form: FormData): Promise<FormState> {
  const ip = await clientIp();
  if (!rateLimit(`checkout:${ip}`, 20, 10 * 60_000).ok) return { error: "Too many attempts. Please wait a few minutes." };
  const slug = String(form.get("slug") ?? "");
  const ref = (await cookies()).get(`plinth_ref_${slug}`)?.value ?? null;
  const slotRaw = Number(form.get("slot") ?? 0);
  let redirectUrl: string;
  try {
    const result = await createCheckout({
      storeSlug: slug,
      productId: String(form.get("productId") ?? ""),
      email: String(form.get("email") ?? ""),
      name: String(form.get("name") ?? ""),
      couponCode: String(form.get("coupon") ?? "") || null,
      customAmountCents: form.get("amount") ? parseMoneyToCents(String(form.get("amount"))) : null,
      includeBump: form.get("bump") === "on",
      slotStart: Number.isFinite(slotRaw) && slotRaw > 0 ? slotRaw : null,
      affiliateCode: ref && /^[A-Z0-9_-]{2,32}$/.test(ref) ? ref : null,
      upsellToken: String(form.get("offer") ?? "") || null,
      visitor: visitorId(ip, await userAgent()),
      source: classifySource(null, String(form.get("source") ?? "") || null),
    });
    redirectUrl = result.redirectUrl;
  } catch (e) {
    if (e instanceof CheckoutError) return { error: e.message };
    console.error("[checkout]", e);
    return { error: "Something went wrong starting checkout. Please try again." };
  }
  redirect(redirectUrl);
}
