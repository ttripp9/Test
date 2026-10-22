// Creates a demo creator with one of every product type so you can click around.
//   npm run db:seed     →  log in as demo@example.com / demo-password-123
import { eq } from "drizzle-orm";
import { openDatabase, setDbForTests } from "../src/lib/db";
import { affiliates, contacts, coupons, events, lessons, orders, products, sequenceSteps, sequences, stores, users } from "../src/lib/db/schema";
import { env } from "../src/lib/env";
import { newId, newToken } from "../src/lib/ids";
import { hashPassword } from "../src/lib/password";
import { THEME_PRESETS } from "../src/lib/themes";

async function main() {
  const { db } = openDatabase(env.databasePath);
  setDbForTests(db);
  const email = "demo@example.com";
  const existing = await db.select().from(users).where(eq(users.email, email)).get();
  if (existing) {
    console.log("Demo user already exists. Delete the database file to reseed.");
    return;
  }
  const userId = newId();
  await db.insert(users).values({ id: userId, email, name: "Maya Rivera", passwordHash: await hashPassword("demo-password-123"), plan: "pro", stripeChargesEnabled: true });
  const storeId = newId();
  await db.insert(stores).values({
    id: storeId,
    userId,
    slug: "maya",
    displayName: "Maya Rivera",
    bio: "Fitness coach & recipe creator. Helping busy people get strong in 20 minutes a day. 💪",
    theme: { preset: "sunset", ...THEME_PRESETS.sunset, buttonShape: "pill", layout: "list" },
    socials: { instagram: "https://instagram.com/", tiktok: "https://tiktok.com/", youtube: "https://youtube.com/" },
    timezone: "America/New_York",
  });

  const id = () => newId();
  const guide = id(), course = id(), call = id(), member = id(), tip = id(), plan = id(), bundle = id(), link = id();
  await db.insert(products).values([
    { id: guide, storeId, type: "lead_magnet", title: "Free 7-day starter plan", subtitle: "A printable plan to kickstart your week", description: "Get my **7-day starter plan** — short workouts and a simple grocery list.\n\n- 20 minutes a day\n- No equipment\n- Printable PDF", ctaLabel: "Send it to me", position: 0, settings: { deliveryUrl: "https://example.com/starter-plan.pdf" } },
    { id: plan, storeId, type: "digital", title: "12-week strength program", subtitle: "Progressive home workouts, PDF + video links", description: "# What you get\n\n- 36 workouts\n- Warm-up and cool-down guides\n- Progress tracker", priceCents: 2900, compareAtCents: 4900, ctaLabel: "Get the program", position: 1, settings: { deliveryUrl: "https://example.com/program", upsellProductId: course, upsellDiscountPercent: 30 } },
    { id: course, storeId, type: "course", title: "Meal prep masterclass", subtitle: "Cook once, eat well all week", description: "A step-by-step video course with quizzes and a certificate.", priceCents: 7900, ctaLabel: "Enroll now", position: 2, settings: { bumpProductId: plan, bumpPriceCents: 1500 } },
    { id: call, storeId, type: "booking", title: "1:1 coaching call", subtitle: "45 minutes to build your personal plan", description: "We'll go through your goals and build a plan together.", priceCents: 12000, ctaLabel: "Book a call", position: 3, settings: { durationMinutes: 45, bufferMinutes: 15, weekdays: [1, 2, 3, 4], startTime: "10:00", endTime: "16:00", daysAhead: 21, meetingUrl: "https://meet.example.com/maya" } },
    { id: member, storeId, type: "membership", title: "Inner circle", subtitle: "New workouts every week + live Q&A", description: "Join the community.", priceCents: 1200, ctaLabel: "Join now", position: 4, settings: { interval: "month", memberContent: "# Welcome to the inner circle!\n\nThis week's workout is below. Live Q&A is every **Thursday at 7pm**." } },
    { id: bundle, storeId, type: "bundle", title: "Everything bundle", subtitle: "The program + the masterclass", priceCents: 8900, compareAtCents: 10800, ctaLabel: "Get both", position: 5, settings: { bundleProductIds: [plan, course] } },
    { id: tip, storeId, type: "tip", title: "Buy me a protein shake", subtitle: "Support my free content", ctaLabel: "Send a tip", position: 6, settings: { minPriceCents: 300 } },
    { id: link, storeId, type: "link", title: "Watch my latest YouTube video", ctaLabel: "Watch", position: 7, settings: { url: "https://youtube.com/" } },
  ]);

  await db.insert(lessons).values([
    { id: id(), productId: course, module: "Getting started", title: "Welcome & kitchen setup", content: "Welcome! In this lesson we set up your kitchen for fast meal prep.\n\n- Containers\n- Sheet pans\n- A good knife", videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", position: 0 },
    { id: id(), productId: course, module: "Getting started", title: "Planning your week", content: "Pick **3 proteins, 3 veggies, 2 carbs**. Mix and match.", position: 1, quiz: [{ question: "How many proteins should you pick?", options: ["1", "3", "7"], answerIndex: 1 }, { question: "Is a sheet pan useful?", options: ["Yes", "No"], answerIndex: 0 }], passPercent: 50 },
    { id: id(), productId: course, module: "Cooking", title: "The 60-minute prep session", content: "Follow along as we cook a whole week's food in an hour.", position: 2 },
  ]);

  await db.insert(coupons).values({ id: id(), storeId, code: "LAUNCH20", percentOff: 20 });
  await db.insert(affiliates).values({ id: id(), storeId, name: "Sam Lee", email: "sam@example.com", code: "SAM", commissionPercent: 30, portalToken: newToken() });

  const seq = id();
  await db.insert(sequences).values({ id: seq, storeId, name: "Starter plan follow-up", trigger: "lead_magnet", productId: guide, active: true });
  await db.insert(sequenceSteps).values([
    { id: id(), sequenceId: seq, delayHours: 24, position: 0, subject: "Day 1 tips, {{first_name}}", body: "How did your first workout go? Here's a tip for day 2…" },
    { id: id(), sequenceId: seq, delayHours: 96, position: 1, subject: "Ready for more?", body: "If you liked the starter plan, the [12-week program]({{store_url}}) is the next step." },
  ]);

  // A month of sample traffic so the analytics pages have something to show.
  const sources = ["instagram", "tiktok", "youtube", "direct", "google"];
  const rows: (typeof events.$inferInsert)[] = [];
  for (let d = 29; d >= 0; d--) {
    const day = Date.now() - d * 86_400_000;
    const visitors = 15 + Math.round(Math.random() * 25);
    for (let v = 0; v < visitors; v++) {
      const visitor = `seed${d}-${v}`;
      const source = sources[v % sources.length];
      rows.push({ storeId, type: "view", visitor, source, createdAt: new Date(day - v * 60_000) });
      if (v % 3 === 0) rows.push({ storeId, productId: plan, type: "view", visitor, source, createdAt: new Date(day - v * 60_000 + 1000) });
      if (v % 9 === 0) rows.push({ storeId, productId: plan, type: "checkout", visitor, source, createdAt: new Date(day - v * 60_000 + 2000) });
      if (v % 18 === 0) {
        const at = new Date(day - v * 60_000 + 3000);
        rows.push({ storeId, productId: plan, type: "purchase", visitor, source, amountCents: 2900, createdAt: at });
        const buyer = `customer${d}-${v}@example.com`;
        await db.insert(orders).values({ id: newId(), storeId, productId: plan, buyerEmail: buyer, buyerName: "Sample Customer", subtotalCents: 2900, totalCents: 2900, currency: "usd", status: "paid", accessToken: newToken(), paidAt: at, createdAt: at });
        await db.insert(contacts).values({ id: newId(), storeId, email: buyer, name: "Sample Customer", source: "12-week strength program", tags: ["customer", "digital"], unsubscribeToken: newToken(), totalSpentCents: 2900, createdAt: at });
      }
    }
  }
  for (let i = 0; i < rows.length; i += 500) await db.insert(events).values(rows.slice(i, i + 500));

  console.log(`Seeded. Store: ${env.appUrl}/maya — log in as ${email} / demo-password-123`);
}

main();
