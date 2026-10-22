// Central place for configuration read from environment variables.
export const env = {
  appUrl: (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, ""),
  appName: process.env.APP_NAME ?? "Plinth",
  databasePath: process.env.DATABASE_PATH ?? "./data/plinth.db",
  storageDir: process.env.STORAGE_DIR ?? "./storage",
  stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? "",
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
  stripeConnectWebhookSecret: process.env.STRIPE_CONNECT_WEBHOOK_SECRET ?? "",
  stripePricePro: process.env.STRIPE_PRICE_PRO ?? "",
  stripePriceBusiness: process.env.STRIPE_PRICE_BUSINESS ?? "",
  emailProvider: (process.env.EMAIL_PROVIDER ?? "console") as "console" | "resend",
  resendApiKey: process.env.RESEND_API_KEY ?? "",
  emailFrom: process.env.EMAIL_FROM ?? "Plinth <hello@example.com>",
  cronSecret: process.env.CRON_SECRET ?? "",
  analyticsSalt: process.env.ANALYTICS_SALT ?? "dev-salt",
  isProduction: process.env.NODE_ENV === "production",
};

/**
 * Demo payments let you click through checkout without Stripe. They are on
 * automatically in development when no Stripe key is set, and never on in
 * production unless ALLOW_DEMO_PAYMENTS=true is set on purpose.
 */
export function demoPaymentsEnabled(): boolean {
  if (env.stripeSecretKey) return false;
  if (!env.isProduction) return true;
  return process.env.ALLOW_DEMO_PAYMENTS === "true";
}
