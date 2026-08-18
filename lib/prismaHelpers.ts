/**
 * Shared helpers for translating flat Prisma columns into frontend-friendly value objects.
 */

import type { ModelOptions, UsageMetrics } from "@/components/extraction-job/types";

// ExtractionJob stores model options as flat columns:
// temperature Float, numCtx Int?, think String?
export function toModelOptions(job: {
  temperature: number;
  numCtx: number | null;
  think: string | null;
}): ModelOptions {
  const think =
    job.think === null
      ? undefined
      : job.think === "true"
        ? true
        : job.think === "false"
          ? false
          : (job.think as "low" | "medium" | "high");

  return {
    temperature: job.temperature,
    ...(job.numCtx != null && { num_ctx: job.numCtx }),
    ...(think !== undefined && { think }),
  };
}

export function serializeThink(
  think: boolean | "low" | "medium" | "high" | undefined | null,
): string | null {
  if (think === undefined || think === null) return null;
  if (think === true) return "true";
  if (think === false) return "false";
  return think;
}

// ExtractionResult stores usage metrics as flat columns.
export function toUsageMetrics(result: {
  totalDuration: number | null;
  loadDuration: number | null;
  promptEvalCount: number | null;
  promptEvalDuration: number | null;
  evalCount: number | null;
  evalDuration: number | null;
}): UsageMetrics | null {
  if (result.totalDuration === null) return null;

  return {
    totalDuration: result.totalDuration!,
    loadDuration: result.loadDuration!,
    promptEvalCount: result.promptEvalCount!,
    promptEvalDuration: result.promptEvalDuration!,
    evalCount: result.evalCount!,
    evalDuration: result.evalDuration!,
  };
}
