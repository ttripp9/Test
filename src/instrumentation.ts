// Runs once when the server starts. Sends due emails every minute unless you
// turn it off (RUN_INLINE_WORKER=false) and use the cron endpoint or worker script.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.RUN_INLINE_WORKER === "false" || process.env.NODE_ENV === "test") return;
  const { processEmailQueue } = await import("./lib/automation");
  const tick = async () => {
    try {
      await processEmailQueue(100);
    } catch (e) {
      console.error("[worker] email queue failed", e);
    }
  };
  setInterval(tick, 60_000).unref?.();
  setTimeout(tick, 5_000).unref?.();
}
