import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { processEmailQueue, queueBroadcast } from "@/lib/automation";
import { CheckoutError, createCheckout, markOrderPaid, unlockedProducts } from "@/lib/commerce";
import { db } from "@/lib/db";
import { affiliates, bookings, contacts, coupons, emailQueue, orders, sequenceSteps, sequences } from "@/lib/db/schema";
import { newId, newToken } from "@/lib/ids";
import { outbox } from "@/lib/mailer";
import { makeProduct, makeStore } from "./helpers";

let storeId: string;

beforeEach(async () => {
  ({ storeId } = await makeStore("pro"));
  outbox.length = 0;
});

async function order(id: string) {
  return (await db.select().from(orders).where(eq(orders.id, id)).get())!;
}

describe("checkout", () => {
  it("delivers free lead magnets immediately and adds the contact", async () => {
    const pid = await makeProduct(storeId, "lead_magnet", 0);
    const res = await createCheckout({ storeSlug: "cara", productId: pid, email: "Fan@Example.com", name: "Fan" });
    expect((await order(res.orderId)).status).toBe("paid");
    const c = await db.select().from(contacts).get();
    expect(c?.email).toBe("fan@example.com");
    expect(c?.tags).toContain("lead");
    expect(outbox.some((e) => e.to === "fan@example.com")).toBe(true);
    expect(outbox.some((e) => e.to === "creator@example.com")).toBe(true);
  });

  it("creates a pending order for paid products and charges the server-side price", async () => {
    const pid = await makeProduct(storeId, "digital", 2900);
    const res = await createCheckout({ storeSlug: "cara", productId: pid, email: "a@b.co", customAmountCents: 1 });
    const o = await order(res.orderId);
    expect(o.status).toBe("pending");
    expect(o.totalCents).toBe(2900);
    expect(res.redirectUrl).toContain("/checkout/demo?t=");
  });

  it("applies coupons and counts redemptions only after payment", async () => {
    const pid = await makeProduct(storeId, "digital", 2000);
    await db.insert(coupons).values({ id: newId(), storeId, code: "HALF", percentOff: 50, maxRedemptions: 1 });
    const res = await createCheckout({ storeSlug: "cara", productId: pid, email: "a@b.co", couponCode: "half" });
    expect((await order(res.orderId)).totalCents).toBe(1000);
    expect((await db.select().from(coupons).get())!.redemptions).toBe(0);
    await markOrderPaid(res.orderId);
    await markOrderPaid(res.orderId); // idempotent
    expect((await db.select().from(coupons).get())!.redemptions).toBe(1);
    await expect(createCheckout({ storeSlug: "cara", productId: pid, email: "c@d.co", couponCode: "HALF" })).rejects.toThrow(CheckoutError);
  });

  it("adds order bumps and unlocks them", async () => {
    const bump = await makeProduct(storeId, "digital", 1500);
    const pid = await makeProduct(storeId, "digital", 3000, { bumpProductId: bump, bumpPriceCents: 900 });
    const res = await createCheckout({ storeSlug: "cara", productId: pid, email: "a@b.co", includeBump: true });
    const o = await order(res.orderId);
    expect(o.totalCents).toBe(3900);
    expect((await unlockedProducts(o)).map((p) => p.id)).toEqual([pid, bump]);
  });

  it("unlocks bundle contents", async () => {
    const a = await makeProduct(storeId, "digital", 1000);
    const b = await makeProduct(storeId, "course", 5000);
    const bundle = await makeProduct(storeId, "bundle", 4500, { bundleProductIds: [a, b] });
    const res = await createCheckout({ storeSlug: "cara", productId: bundle, email: "a@b.co" });
    const ids = (await unlockedProducts(await order(res.orderId))).map((p) => p.id);
    expect(ids).toEqual(expect.arrayContaining([bundle, a, b]));
  });

  it("prevents double booking of a call slot", async () => {
    const pid = await makeProduct(storeId, "booking", 5000, { weekdays: [0, 1, 2, 3, 4, 5, 6], daysAhead: 3 });
    const { availableSlots } = await import("@/lib/booking");
    const slot = availableSlots({ settings: { weekdays: [0, 1, 2, 3, 4, 5, 6], daysAhead: 3 }, timeZone: "America/New_York", busy: [] })[0];
    const first = await createCheckout({ storeSlug: "cara", productId: pid, email: "a@b.co", slotStart: slot.start.getTime() });
    await expect(
      createCheckout({ storeSlug: "cara", productId: pid, email: "z@b.co", slotStart: slot.start.getTime() }),
    ).rejects.toThrow(/taken/);
    await markOrderPaid(first.orderId);
    expect((await db.select().from(bookings).get())!.status).toBe("confirmed");
  });

  it("credits affiliates but not self-referrals", async () => {
    const pid = await makeProduct(storeId, "digital", 10000);
    await db.insert(affiliates).values({ id: newId(), storeId, name: "Al", email: "al@x.co", code: "AL", commissionPercent: 30, portalToken: newToken() });
    const res = await createCheckout({ storeSlug: "cara", productId: pid, email: "a@b.co", affiliateCode: "al" });
    expect((await order(res.orderId)).affiliateCommissionCents).toBe(3000);
    const self = await createCheckout({ storeSlug: "cara", productId: pid, email: "al@x.co", affiliateCode: "AL" });
    expect((await order(self.orderId)).affiliateId).toBeNull();
  });

  it("rejects bad email and hidden products", async () => {
    const pid = await makeProduct(storeId, "digital", 1000);
    await expect(createCheckout({ storeSlug: "cara", productId: pid, email: "nope" })).rejects.toThrow(/email/);
    await expect(createCheckout({ storeSlug: "cara", productId: "missing", email: "a@b.co" })).rejects.toThrow(CheckoutError);
  });

  it("applies the free plan transaction fee", async () => {
    ({ storeId } = await makeStore("free"));
    const pid = await makeProduct(storeId, "digital", 2000);
    const res = await createCheckout({ storeSlug: "cara", productId: pid, email: "a@b.co" });
    expect((await order(res.orderId)).platformFeeCents).toBe(100);
  });
});

describe("email automation", () => {
  it("queues sequence steps on lead magnet signup and sends when due", async () => {
    const pid = await makeProduct(storeId, "lead_magnet", 0);
    const seqId = newId();
    await db.insert(sequences).values({ id: seqId, storeId, name: "Welcome", trigger: "lead_magnet", productId: pid });
    await db.insert(sequenceSteps).values([
      { id: newId(), sequenceId: seqId, delayHours: 0, subject: "Hi {{first_name}}", body: "Welcome to {{store_name}}", position: 0 },
      { id: newId(), sequenceId: seqId, delayHours: 48, subject: "Day 2", body: "More", position: 1 },
    ]);
    await createCheckout({ storeSlug: "cara", productId: pid, email: "fan@x.co", name: "Fan Person" });
    expect(await db.select().from(emailQueue).all()).toHaveLength(2);
    outbox.length = 0;
    const r1 = await processEmailQueue();
    expect(r1.sent).toBe(1);
    expect(outbox[0].subject).toBe("Hi Fan");
    expect(outbox[0].body).toContain("Welcome to Cara Creates");
    expect(outbox[0].html).toContain("Unsubscribe");
    const later = await processEmailQueue(100, new Date(Date.now() + 49 * 3600_000));
    expect(later.sent).toBe(1);
  });

  it("skips unsubscribed contacts and respects broadcast tags", async () => {
    await db.insert(contacts).values([
      { id: newId(), storeId, email: "a@x.co", tags: ["vip"], unsubscribeToken: newToken() },
      { id: newId(), storeId, email: "b@x.co", tags: [], unsubscribeToken: newToken() },
      { id: newId(), storeId, email: "c@x.co", tags: ["vip"], subscribed: false, unsubscribeToken: newToken() },
    ]);
    const { recipients } = await queueBroadcast({ storeId, subject: "Sale", body: "50% off", tag: "vip" });
    expect(recipients).toBe(1);
    outbox.length = 0;
    await processEmailQueue();
    expect(outbox.map((e) => e.to)).toEqual(["a@x.co"]);
  });
});

describe("after-purchase offer", () => {
  it("discounts the offered product only for paid buyers of the first product", async () => {
    const offer = await makeProduct(storeId, "digital", 4000);
    const main = await makeProduct(storeId, "digital", 2000, { upsellProductId: offer, upsellDiscountPercent: 25 });
    const first = await createCheckout({ storeSlug: "cara", productId: main, email: "a@b.co" });
    const early = await createCheckout({ storeSlug: "cara", productId: offer, email: "a@b.co", upsellToken: first.accessToken });
    expect((await order(early.orderId)).totalCents).toBe(4000); // not paid yet
    await markOrderPaid(first.orderId);
    const res = await createCheckout({ storeSlug: "cara", productId: offer, email: "a@b.co", upsellToken: first.accessToken });
    expect((await order(res.orderId)).totalCents).toBe(3000);
    expect((await order(res.orderId)).couponId).toBeNull();
  });
});

describe("analytics revenue", () => {
  it("counts paid orders and excludes refunds", async () => {
    const { summarize } = await import("@/lib/analytics");
    const { markOrderRefunded } = await import("@/lib/commerce");
    const pid = await makeProduct(storeId, "digital", 2500);
    const a = await createCheckout({ storeSlug: "cara", productId: pid, email: "a@b.co" });
    const b = await createCheckout({ storeSlug: "cara", productId: pid, email: "c@d.co" });
    await markOrderPaid(a.orderId);
    await markOrderPaid(b.orderId);
    await markOrderRefunded(b.orderId);
    const s = await summarize(storeId, 7);
    expect(s.revenueCents).toBe(2500);
    expect(s.purchases).toBe(1);
    expect(s.daily.at(-1)?.revenueCents).toBe(2500);
  });
});
