import { headers } from "next/headers";

/** Best-effort client IP. Only trust X-Forwarded-For when running behind your own proxy. */
export async function clientIp(): Promise<string> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return h.get("x-real-ip") ?? "unknown";
}

export async function userAgent(): Promise<string> {
  return (await headers()).get("user-agent") ?? "";
}
