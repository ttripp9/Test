// Standalone email worker for setups that run several web servers
// (set RUN_INLINE_WORKER=false on the web servers and run this once).
import { processEmailQueue } from "../src/lib/automation";

async function loop() {
  for (;;) {
    try {
      const r = await processEmailQueue(200);
      if (r.sent || r.failed) console.log(`[worker] sent=${r.sent} failed=${r.failed} skipped=${r.skipped}`);
    } catch (e) {
      console.error("[worker]", e);
    }
    await new Promise((res) => setTimeout(res, 30_000));
  }
}
loop();
