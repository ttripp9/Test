import type { Coupon, Product } from "./db/schema";

export type PriceQuote = {
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  bumpCents: number;
  couponError?: string;
};

export type CouponCheck = { ok: true } | { ok: false; reason: string };

export function checkCoupon(coupon: Coupon, productId: string, now = new Date()): CouponCheck {
  if (!coupon.active) return { ok: false, reason: "This code is no longer active." };
  if (coupon.expiresAt && coupon.expiresAt.getTime() < now.getTime())
    return { ok: false, reason: "This code has expired." };
  if (coupon.maxRedemptions != null && coupon.redemptions >= coupon.maxRedemptions)
    return { ok: false, reason: "This code has been fully redeemed." };
  if (coupon.productId && coupon.productId !== productId)
    return { ok: false, reason: "This code doesn't apply to this product." };
  return { ok: true };
}

/**
 * Work out what the buyer pays. All prices are computed on the server so the
 * browser can never choose its own price, except within pay-what-you-want limits.
 */
export function quote(opts: {
  product: Pick<Product, "id" | "priceCents" | "settings" | "type">;
  customAmountCents?: number | null;
  coupon?: Coupon | null;
  bump?: { priceCents: number } | null;
  now?: Date;
}): PriceQuote {
  const { product, coupon, bump } = opts;
  let base = product.priceCents;
  const flexible = product.type === "tip" || product.settings.payWhatYouWant;
  if (flexible && opts.customAmountCents != null) {
    const min = product.settings.minPriceCents ?? (product.type === "tip" ? 100 : product.priceCents);
    base = Math.max(min, Math.min(opts.customAmountCents, 100_000_00));
  }
  const bumpCents = bump ? Math.max(0, bump.priceCents) : 0;
  let discountCents = 0;
  let couponError: string | undefined;
  if (coupon) {
    const check = checkCoupon(coupon, product.id, opts.now);
    if (check.ok) {
      if (coupon.percentOff) discountCents = Math.round((base * Math.min(coupon.percentOff, 100)) / 100);
      else if (coupon.amountOffCents) discountCents = Math.min(coupon.amountOffCents, base);
    } else {
      couponError = check.reason;
    }
  }
  const subtotalCents = base + bumpCents;
  const totalCents = Math.max(0, subtotalCents - discountCents);
  return { subtotalCents, discountCents, totalCents, bumpCents, couponError };
}

/** Stripe requires a minimum charge (50 cents in USD). Smaller amounts are treated as free. */
export const STRIPE_MIN_CHARGE_CENTS = 50;
