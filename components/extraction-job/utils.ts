import { ExtractionJob, JobStatus } from "./types";

export function getJobStatus(job: ExtractionJob): JobStatus {
  if (job.isRunning) return "running";
  // Completed: all inputs accounted for (success + failed >= total in dataset)
  if (
    job.finishedAt &&
    job.totalInputCount > 0 &&
    job.successfulResultCount + job.failedResultCount >= job.totalInputCount
  )
    return "completed";
  // Everything else: never started, stopped mid-run, or new inputs added since
  return "pending";
}

export function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
  }
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h}h ${m}m ${s}s`;
}
export function formatNumCtx(val: number | null): string {
  if (val === null) return "Auto";
  if (val >= 1024) return `${val / 1024}k`;
  return String(val);
}
