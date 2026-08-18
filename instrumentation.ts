/**
 * instrumentation.ts — Next.js server startup hook
 *
 * Next.js calls register() exactly once when the server boots,
 * before serving any requests.
 *
 * Purpose: reset any ExtractionJob records left with isRunning=true
 * from a previous server crash or restart. These are "zombie" records —
 * the in-memory runner is gone but the DB flag was never cleared.
 * Without this, the UI would show a RunningBanner for a job that
 * no longer exists.
 */

export async function register() {
  // Only run on the Node.js runtime — skip edge/worker runtimes
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  try {
    const { prisma } = await import("./lib/prisma");

    const result = await prisma.extractionJob.updateMany({
      where: { isRunning: true },
      data: { isRunning: false, currentInputLabel: null },
    });

    if (result.count > 0) {
      console.warn(
        `⚠️  Startup cleanup: reset ${result.count} ExtractionJob(s) to isRunning=false`,
      );
    }
  } catch (err) {
    // Non-fatal — log and continue. The server should still start
    // even if cleanup fails.
    console.error("❌ Startup cleanup failed:", err);
  }
}
