"use client";

import { Button } from "@/components/shadcn_ui/button";
import { Loader2, Square } from "lucide-react";
import { ExtractionJob } from "@/components/extraction-job/types";

export function RunningBanner({
  runningJob,
  onStop,
  stopping,
}: {
  runningJob: ExtractionJob | null;
  onStop: () => void;
  stopping: boolean;
}) {
  if (!runningJob) return null;

  const total = runningJob.totalInputCount;
  const completedInputCount = runningJob.successfulResultCount + runningJob.failedResultCount;
  const completionPercent = total > 0 ? Math.round((completedInputCount / total) * 100) : 0;
  const successPercent = total > 0 ? Math.round((runningJob.successfulResultCount / total) * 100) : 0;
  const failurePercent = total > 0 ? Math.round((runningJob.failedResultCount / total) * 100) : 0;

  return (
    <div className="sticky top-0 z-50 w-full border-b border-blue-500/30 bg-blue-500/20 backdrop-blur-lg px-6 py-2 flex items-center gap-4 shrink-0">
      {/* ── Stop button ───────────────────────────────────────────────────── */}
      <Button
        size="sm"
        variant="outline"
        onClick={onStop}
        disabled={stopping}
        className="cursor-pointer group uppercase rounded-sm font-mono text-xs gap-1.5 border-red-400 text-red-400 bg-transparent hover:bg-red-400/10 hover:text-red-700 hover:border-red-700  disabled:opacity-40 shrink-0"
      >
        {stopping ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Square className="size-4 fill-red-400 group-hover:fill-red-700" />
        )}
        Stop
      </Button>

      {/* ── Running info ──────────────────────────────────────────────────── */}
      <div className="flex flex-col justify-center min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <Loader2 className="size-4 text-blue-600 animate-spin shrink-0" />
          <span className="font-mono text-xs text-blue-600 font-semibold shrink-0">Running:</span>
          <span className="font-mono text-xs text-blue-600 truncate">{runningJob.title}</span>
        </div>
        {runningJob.currentInputLabel && (
          <span className="font-mono text-[11px] text-blue-500/70 truncate pl-5">
            ↳ {runningJob.currentInputLabel}
          </span>
        )}
      </div>

      {/* ── Extracted / Failed breakdown ──────────────────────────────────── */}
      <div className="hidden sm:flex items-center gap-3 shrink-0">
        <span className="font-mono text-xs text-blue-600 shrink-0">
          {completionPercent}% ({completedInputCount}/{total})
        </span>
        <span className="flex items-center gap-1 font-mono text-xs text-blue-600">
          <span className="size-2 rounded-full bg-blue-600 inline-block" />
          {`Extracted ${successPercent}% (${runningJob.successfulResultCount})`}
        </span>

        {failurePercent > 0 && (
          <span className="flex items-center gap-1 font-mono text-xs text-red-600">
            <span className="size-2 rounded-full bg-red-600 inline-block" />
            {`Failed ${failurePercent}% (${runningJob.failedResultCount})`}
          </span>
        )}
      </div>
    </div>
  );
}
