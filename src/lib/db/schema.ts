import { sql } from "drizzle-orm";
import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const createdAt = () =>
  integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`);

export type PlanId = "free" | "pro" | "business";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  plan: text("plan").$type<PlanId>().notNull().default("free"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  stripeAccountId: text("stripe_account_id"),
  stripeChargesEnabled: integer("stripe_charges_enabled", { mode: "boolean" }).notNull().default(false),
  createdAt: createdAt(),
});

export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(), // sha256 of the cookie token
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export type StoreTheme = {
  preset: string;
  accent: string;
  background: string;
  text: string;
  card: string;
  font: "sans" | "serif" | "mono" | "rounded";
  buttonShape: "pill" | "rounded" | "square";
  layout: "list" | "grid";
};

export type StoreSocials = Partial<
  Record<"instagram" | "tiktok" | "youtube" | "x" | "linkedin" | "threads" | "website" | "email", string>
>;

export type StorePixels = { metaPixelId?: string; tiktokPixelId?: string; ga4Id?: string };

export const stores = sqliteTable("stores", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  slug: text("slug").notNull().unique(),
  displayName: text("display_name").notNull(),
  bio: text("bio").notNull().default(""),
  avatarMediaId: text("avatar_media_id"),
  theme: text("theme", { mode: "json" }).$type<StoreTheme>().notNull(),
  customCss: text("custom_css").notNull().default(""),
  socials: text("socials", { mode: "json" }).$type<StoreSocials>().notNull().default({}),
  pixels: text("pixels", { mode: "json" }).$type<StorePixels>().notNull().default({}),
  currency: text("currency").notNull().default("usd"),
  timezone: text("timezone").notNull().default("America/New_York"),
  published: integer("published", { mode: "boolean" }).notNull().default(true),
  createdAt: createdAt(),
});

export type ProductType =
  | "digital"
  | "lead_magnet"
  | "course"
  | "booking"
  | "membership"
  | "tip"
  | "bundle"
  | "link";

export type ProductSettings = {
  // booking
  durationMinutes?: number;
  bufferMinutes?: number;
  weekdays?: number[]; // 0 = Sunday
  startTime?: string; // "09:00"
  endTime?: string; // "17:00"
  daysAhead?: number;
  meetingUrl?: string;
  // membership
  interval?: "month" | "year";
  memberContent?: string;
  // pricing
  payWhatYouWant?: boolean;
  minPriceCents?: number;
  // checkout extras
  bumpProductId?: string;
  bumpPriceCents?: number;
  upsellProductId?: string;
  upsellDiscountPercent?: number;
  // bundle
  bundleProductIds?: string[];
  // link
  url?: string;
  // digital / lead magnet delivery
  deliveryUrl?: string;
  thankYouMessage?: string;
  maxDownloads?: number;
};

export const products = sqliteTable(
  "products",
  {
    id: text("id").primaryKey(),
    storeId: text("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    type: text("type").$type<ProductType>().notNull(),
    title: text("title").notNull(),
    subtitle: text("subtitle").notNull().default(""),
    description: text("description").notNull().default(""),
    priceCents: integer("price_cents").notNull().default(0),
    compareAtCents: integer("compare_at_cents"),
    ctaLabel: text("cta_label").notNull().default(""),
    imageMediaId: text("image_media_id"),
    fileMediaId: text("file_media_id"),
    settings: text("settings", { mode: "json" }).$type<ProductSettings>().notNull().default({}),
    position: integer("position").notNull().default(0),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    // Products are archived rather than deleted so order history stays intact.
    archived: integer("archived", { mode: "boolean" }).notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index("products_store_idx").on(t.storeId)],
);

export const media = sqliteTable(
  "media",
  {
    id: text("id").primaryKey(),
    storeId: text("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    kind: text("kind").$type<"image" | "file">().notNull(),
    filename: text("filename").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("media_store_idx").on(t.storeId)],
);

export type QuizQuestion = { question: string; options: string[]; answerIndex: number };

export const lessons = sqliteTable(
  "lessons",
  {
    id: text("id").primaryKey(),
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    module: text("module").notNull().default("Module 1"),
    title: text("title").notNull(),
    content: text("content").notNull().default(""),
    videoUrl: text("video_url"),
    quiz: text("quiz", { mode: "json" }).$type<QuizQuestion[]>(),
    passPercent: integer("pass_percent").notNull().default(70),
    position: integer("position").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index("lessons_product_idx").on(t.productId)],
);

export const coupons = sqliteTable(
  "coupons",
  {
    id: text("id").primaryKey(),
    storeId: text("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    percentOff: integer("percent_off"),
    amountOffCents: integer("amount_off_cents"),
    productId: text("product_id"),
    maxRedemptions: integer("max_redemptions"),
    redemptions: integer("redemptions").notNull().default(0),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("coupons_store_code_idx").on(t.storeId, t.code)],
);

export const affiliates = sqliteTable(
  "affiliates",
  {
    id: text("id").primaryKey(),
    storeId: text("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    email: text("email").notNull(),
    code: text("code").notNull(),
    commissionPercent: integer("commission_percent").notNull().default(20),
    portalToken: text("portal_token").notNull().unique(),
    clicks: integer("clicks").notNull().default(0),
    paidOutCents: integer("paid_out_cents").notNull().default(0),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("affiliates_store_code_idx").on(t.storeId, t.code)],
);

export type OrderStatus = "pending" | "paid" | "refunded" | "canceled" | "expired";

export const orders = sqliteTable(
  "orders",
  {
    id: text("id").primaryKey(),
    storeId: text("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    buyerEmail: text("buyer_email").notNull(),
    buyerName: text("buyer_name").notNull().default(""),
    subtotalCents: integer("subtotal_cents").notNull(),
    discountCents: integer("discount_cents").notNull().default(0),
    totalCents: integer("total_cents").notNull(),
    platformFeeCents: integer("platform_fee_cents").notNull().default(0),
    currency: text("currency").notNull(),
    status: text("status").$type<OrderStatus>().notNull().default("pending"),
    couponId: text("coupon_id"),
    affiliateId: text("affiliate_id"),
    affiliateCommissionCents: integer("affiliate_commission_cents").notNull().default(0),
    bumpProductId: text("bump_product_id"),
    accessToken: text("access_token").notNull().unique(),
    downloads: integer("downloads").notNull().default(0),
    stripeSessionId: text("stripe_session_id"),
    stripeSubscriptionId: text("stripe_subscription_id"),
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    note: text("note").notNull().default(""),
    paidAt: integer("paid_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
  },
  (t) => [
    index("orders_store_idx").on(t.storeId, t.createdAt),
    index("orders_stripe_session_idx").on(t.stripeSessionId),
    index("orders_stripe_sub_idx").on(t.stripeSubscriptionId),
    index("orders_stripe_pi_idx").on(t.stripePaymentIntentId),
  ],
);

export type BookingStatus = "held" | "confirmed" | "canceled";

export const bookings = sqliteTable(
  "bookings",
  {
    id: text("id").primaryKey(),
    storeId: text("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    startAt: integer("start_at", { mode: "timestamp_ms" }).notNull(),
    endAt: integer("end_at", { mode: "timestamp_ms" }).notNull(),
    status: text("status").$type<BookingStatus>().notNull().default("held"),
    holdExpiresAt: integer("hold_expires_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
  },
  (t) => [index("bookings_store_start_idx").on(t.storeId, t.startAt)],
);

export const contacts = sqliteTable(
  "contacts",
  {
    id: text("id").primaryKey(),
    storeId: text("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    name: text("name").notNull().default(""),
    source: text("source").notNull().default(""),
    tags: text("tags", { mode: "json" }).$type<string[]>().notNull().default([]),
    subscribed: integer("subscribed", { mode: "boolean" }).notNull().default(true),
    unsubscribeToken: text("unsubscribe_token").notNull().unique(),
    totalSpentCents: integer("total_spent_cents").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("contacts_store_email_idx").on(t.storeId, t.email)],
);

export type SequenceTrigger = "new_contact" | "lead_magnet" | "purchase";

export const sequences = sqliteTable(
  "sequences",
  {
    id: text("id").primaryKey(),
    storeId: text("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    trigger: text("trigger").$type<SequenceTrigger>().notNull(),
    productId: text("product_id"),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [index("sequences_store_idx").on(t.storeId)],
);

export const sequenceSteps = sqliteTable(
  "sequence_steps",
  {
    id: text("id").primaryKey(),
    sequenceId: text("sequence_id")
      .notNull()
      .references(() => sequences.id, { onDelete: "cascade" }),
    delayHours: integer("delay_hours").notNull().default(0),
    subject: text("subject").notNull(),
    body: text("body").notNull(),
    position: integer("position").notNull().default(0),
  },
  (t) => [index("steps_sequence_idx").on(t.sequenceId)],
);

export const emailQueue = sqliteTable(
  "email_queue",
  {
    id: text("id").primaryKey(),
    storeId: text("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    contactId: text("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    stepId: text("step_id").references(() => sequenceSteps.id, { onDelete: "cascade" }),
    broadcastId: text("broadcast_id"),
    sendAt: integer("send_at", { mode: "timestamp_ms" }).notNull(),
    status: text("status").$type<"queued" | "sent" | "failed" | "skipped">().notNull().default("queued"),
    attempts: integer("attempts").notNull().default(0),
    error: text("error"),
    sentAt: integer("sent_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
  },
  (t) => [
    index("queue_due_idx").on(t.status, t.sendAt),
    uniqueIndex("queue_contact_step_idx").on(t.contactId, t.stepId),
  ],
);

export const broadcasts = sqliteTable("broadcasts", {
  id: text("id").primaryKey(),
  storeId: text("store_id")
    .notNull()
    .references(() => stores.id, { onDelete: "cascade" }),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  tag: text("tag"),
  recipientCount: integer("recipient_count").notNull().default(0),
  sentAt: integer("sent_at", { mode: "timestamp_ms" }),
  createdAt: createdAt(),
});

export const lessonProgress = sqliteTable(
  "lesson_progress",
  {
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    lessonId: text("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    completedAt: integer("completed_at", { mode: "timestamp_ms" }),
    quizScore: integer("quiz_score"),
  },
  (t) => [primaryKey({ columns: [t.orderId, t.lessonId] })],
);

export type EventType = "view" | "click" | "checkout" | "purchase";

export const events = sqliteTable(
  "events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    storeId: text("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    productId: text("product_id"),
    type: text("type").$type<EventType>().notNull(),
    visitor: text("visitor").notNull(),
    source: text("source").notNull().default("direct"),
    amountCents: integer("amount_cents").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index("events_store_time_idx").on(t.storeId, t.createdAt)],
);

export const webhookEvents = sqliteTable("webhook_events", {
  id: text("id").primaryKey(),
  createdAt: createdAt(),
});

export type User = typeof users.$inferSelect;
export type Store = typeof stores.$inferSelect;
export type Product = typeof products.$inferSelect;
export type Lesson = typeof lessons.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type Contact = typeof contacts.$inferSelect;
export type Coupon = typeof coupons.$inferSelect;
export type Affiliate = typeof affiliates.$inferSelect;
export type Sequence = typeof sequences.$inferSelect;
export type SequenceStep = typeof sequenceSteps.$inferSelect;
