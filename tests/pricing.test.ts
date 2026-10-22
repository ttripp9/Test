import { describe, expect, it } from "vitest";
import type { Coupon } from "@/lib/db/schema";
import { parseMoneyToCents } from "@/lib/money";
import { platformFeeCents, PLANS } from "@/lib/plans";
import { quote } from "@/lib/pricing";

const product = { id: "p1", priceCents: 4900, settings: {}, type: "digital" as const };
const coupon = (c: Partial<Coupon>): Coupon => ({
  id: "c1", storeId: "s", code: "SAVE", percentOff: null, amountOffCents: null, productId: null,
  maxRedemptions: null, redemptions: 0, expiresAt: null, active: true, createdAt: new Date(), ...c,
});

describe("quote", () => {
  it("applies percent and fixed coupons", () => {
    expect(quote({ product, coupon: coupon({ percentOff: 20 }) }).totalCents).toBe(3920);
    expect(quote({ product, coupon: coupon({ amountOffCents: 10000 }) }).totalCents).toBe(0);
  });
  it("rejects expired, used up and wrong-product coupons", () => {
    expect(quote({ product, coupon: coupon({ percentOff: 10, expiresAt: new Date(Date.now() - 1000) }) }).couponError).toMatch(/expired/);
    expect(quote({ product, coupon: coupon({ percentOff: 10, maxRedemptions: 1, redemptions: 1 }) }).couponError).toBeTruthy();
    expect(quote({ product, coupon: coupon({ percentOff: 10, productId: "other" }) }).couponError).toBeTruthy();
  });
  it("adds the order bump without discounting it", () => {
    const q = quote({ product, coupon: coupon({ percentOff: 50 }), bump: { priceCents: 1000 } });
    expect(q.subtotalCents).toBe(5900);
    expect(q.totalCents).toBe(5900 - 2450);
  });
  it("enforces pay-what-you-want minimums server side", () => {
    const pwyw = { ...product, settings: { payWhatYouWant: true, minPriceCents: 500 } };
    expect(quote({ product: pwyw, customAmountCents: 1 }).totalCents).toBe(500);
    expect(quote({ product: pwyw, customAmountCents: 2500 }).totalCents).toBe(2500);
    expect(quote({ product: { ...product, type: "tip", priceCents: 0 }, customAmountCents: 10 }).totalCents).toBe(100);
  });
});

describe("money and fees", () => {
  it("parses prices", () => {
    expect(parseMoneyToCents("$12.50")).toBe(1250);
    expect(parseMoneyToCents("12")).toBe(1200);
    expect(parseMoneyToCents("-3")).toBeNull();
    expect(parseMoneyToCents("1.234")).toBeNull();
  });
  it("charges a fee only on the free plan", () => {
    expect(platformFeeCents(10000, PLANS.free)).toBe(500);
    expect(platformFeeCents(10000, PLANS.pro)).toBe(0);
  });
});
