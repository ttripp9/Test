import Stripe from "stripe";
import { env } from "./env";

let client: Stripe | null = null;

export function stripeEnabled(): boolean {
  return Boolean(env.stripeSecretKey);
}

export function stripe(): Stripe {
  if (!env.stripeSecretKey) throw new Error("Stripe is not configured. Set STRIPE_SECRET_KEY.");
  client ??= new Stripe(env.stripeSecretKey, { appInfo: { name: env.appName } });
  return client;
}
