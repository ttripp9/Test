import { unsubscribe } from "@/lib/unsubscribe";

/** RFC 8058 one-click unsubscribe from mail clients. */
export async function POST(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  await unsubscribe((await params).token);
  return new Response(null, { status: 204 });
}
