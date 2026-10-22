import type { ProductType } from "./db/schema";

export const PRODUCT_TYPES: Record<ProductType, { label: string; emoji: string; description: string; cta: string }> = {
  digital: { label: "Digital download", emoji: "📦", description: "E-books, templates, presets, files or a private link.", cta: "Buy now" },
  lead_magnet: { label: "Free lead magnet", emoji: "🧲", description: "Give something away for an email address.", cta: "Get it free" },
  course: { label: "Online course", emoji: "🎓", description: "Lessons with video, quizzes, progress and certificates.", cta: "Enroll now" },
  booking: { label: "1:1 call", emoji: "📅", description: "Sell coaching or consulting calls with your availability.", cta: "Book a call" },
  membership: { label: "Membership", emoji: "⭐", description: "Monthly or yearly subscription to members-only content.", cta: "Join now" },
  tip: { label: "Tip jar", emoji: "💛", description: "Let fans support you with any amount.", cta: "Send a tip" },
  bundle: { label: "Bundle", emoji: "🎁", description: "Sell several products together for one price.", cta: "Get the bundle" },
  link: { label: "Link", emoji: "🔗", description: "A plain link to anywhere — your podcast, YouTube, etc.", cta: "Visit" },
};
