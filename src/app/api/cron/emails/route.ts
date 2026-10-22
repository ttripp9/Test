import { timingSafeEqual } from "node:crypto";
import { processEmailQueue } from "@/lib/automation";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

function authorized(req: Request) {
  const expected = env.cronSecret;
  const got = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!expected || expected === "change-me" || !got) return false;
  const a = Buffer.from(got);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Call every minute from a scheduler: curl -H "Authorization: Bearer $CRON_SECRET" -X POST /api/cron/emails */
export async function POST(req: Request) {
  if (!authorized(req)) return new Response("Unauthorized", { status: 401 });
  const result = await processEmailQueue(200);
  return Response.json(result);
}
