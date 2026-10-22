import type { PlanId, ProductType } from "./db/schema";

export type Plan = {
  id: PlanId;
  name: string;
  priceMonthly: number; // USD
  tagline: string;
  transactionFeePercent: number;
  maxProducts: number;
  maxContacts: number;
  maxSequences: number;
  productTypes: ProductType[];
  customCss: boolean;
  affiliates: boolean;
  removeBranding: boolean;
  highlights: string[];
};

const ALL_TYPES: ProductType[] = [
  "digital",
  "lead_magnet",
  "course",
  "booking",
  "membership",
  "tip",
  "bundle",
  "link",
];

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: "free",
    name: "Free",
    priceMonthly: 0,
    tagline: "Start selling today",
    transactionFeePercent: 5,
    maxProducts: 3,
    maxContacts: 250,
    maxSequences: 1,
    productTypes: ["digital", "lead_magnet", "tip", "link", "booking"],
    customCss: false,
    affiliates: false,
    removeBranding: false,
    highlights: [
      "3 products",
      "Email automation (1 sequence)",
      "Meta, TikTok & GA4 pixels",
      "250 contacts",
      "5% transaction fee",
    ],
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceMonthly: 19,
    tagline: "Everything a growing creator needs",
    transactionFeePercent: 0,
    maxProducts: 50,
    maxContacts: 5000,
    maxSequences: 10,
    productTypes: ALL_TYPES,
    customCss: false,
    affiliates: true,
    removeBranding: false,
    highlights: [
      "0% transaction fees",
      "Courses with quizzes & certificates",
      "Memberships & bundles",
      "Affiliate program",
      "Order bumps & upsells",
      "5,000 contacts",
    ],
  },
  business: {
    id: "business",
    name: "Business",
    priceMonthly: 49,
    tagline: "For teams and full-time creators",
    transactionFeePercent: 0,
    maxProducts: 500,
    maxContacts: 50000,
    maxSequences: 100,
    productTypes: ALL_TYPES,
    customCss: true,
    affiliates: true,
    removeBranding: true,
    highlights: [
      "Everything in Pro",
      "Custom CSS",
      "Remove platform branding",
      "50,000 contacts",
      "100 email sequences",
    ],
  },
};

export function getPlan(id: string | null | undefined): Plan {
  return PLANS[(id as PlanId) ?? "free"] ?? PLANS.free;
}

export function platformFeeCents(totalCents: number, plan: Plan): number {
  return Math.round((totalCents * plan.transactionFeePercent) / 100);
}
