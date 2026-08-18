"use client";

import { useState, useMemo } from "react";
import { ScrollArea } from "@/components/shadcn_ui/scroll-area";
import { Separator } from "@/components/shadcn_ui/separator";
import { Button } from "@/components/shadcn_ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/shadcn_ui/tabs";
import {
  Clock,
  CheckCircle2,
  XCircle,
  FileText,
  Play,
  Loader2,
  Cpu,
  SlidersHorizontal,
  X,
  Download,
} from "lucide-react";
import { schemaToSimplePreview } from "@/components/instruction/SchemaBuilder";
import { ExtractionJob, ExtractionResult } from "./types";
import { getJobStatus, formatTime } from "./utils";
import { StatusBadge } from "./StatusBadge";
import { ModelOptionsDisplay } from "./ModelOptionsDisplay";
import { ExtractionResultCard } from "./ExtractionResultCard";
import { FailedResultCard } from "./FailedResultCard";
import { FilterSheet } from "./FilterSheet";
import { computeFacets, matchesFilters, FilterState } from "./filterUtils";

function truncateValue(str: string, max = 70): string {
  return str.length > max ? str.slice(0, max) + "…" : str;
}

export function ExtractionJobDetails({
  job,
  successfulResults,
  failedResults,
  hasRunningJob,
  actionLoading,
  onStart,
}: {
  job: ExtractionJob;
  successfulResults: ExtractionResult[];
  failedResults: ExtractionResult[];
  hasRunningJob: boolean;
  actionLoading: boolean;
  onStart: () => void;
}) {
  const [activeFilters, setActiveFilters] = useState<FilterState>({});
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);

  const instructionTitle = job.instruction.title;
  const datasetName = job.dataset.name;
  const status = getJobStatus(job);
  const total = job.totalInputCount;

  const successPercent =
    total > 0 ? Math.min(100, Math.round((job.successfulResultCount / total) * 100)) : 0;
  const failurePercent = total > 0 ? Math.min(100, Math.round((job.failedResultCount / total) * 100)) : 0;

  // ── Facets — recomputed each time successfulResults updates (each poll) ─────────
  const facets = useMemo(() => computeFacets(successfulResults), [successfulResults]);

  const activeFilterCount = Object.values(activeFilters).filter((v) => v.length > 0).length;

  // ── Filtered list — new arrivals automatically pass through the same logic ─
  const filteredSuccessfulResults = useMemo(() => {
    if (activeFilterCount === 0) return successfulResults;
    return successfulResults.filter((result) => matchesFilters(result, activeFilters));
  }, [successfulResults, activeFilters, activeFilterCount]);

  function handleToggleValue(key: string, value: string) {
    setActiveFilters((prev) => {
      const current = prev[key] ?? [];
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      return { ...prev, [key]: next };
    });
  }

  function handleClearAll() {
    setActiveFilters({});
  }

  function handleDownloadJSON() {
    const rows = successfulResults.map((result) => ({
      inputLabel: result.inputLabel,
      processedAt: result.processedAt,
      processingDurationSeconds: result.processingDurationSeconds,
      data: result.extractedData,
    }));
    const blob = new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${job.title}-results.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <ScrollArea className="flex-1">
      <div className="px-3 py-5 space-y-5">
        {/* ── Header row ──────────────────────────────────────────────── */}
        <div className="flex gap-2 items-start justify-between">
          {/* ── Left: extraction job info ─────────────────────────────────────────── */}
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h2 className="font-mono text-base font-semibold text-foreground">{job.title}</h2>
              <StatusBadge status={status} />
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground font-mono mb-1">
              <span>
                Model: <span className="text-foreground">{job.modelName}</span>
              </span>
              <span>
                Instruction: <span className="text-foreground">{instructionTitle}</span>
              </span>
              <span>
                Dataset: <span className="text-foreground">{datasetName}</span>
              </span>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground font-mono">
              <ModelOptionsDisplay options={job.modelOptions} />
            </div>
          </div>

          {/* ── Right: Stats + Start button ───────────────────────────── */}
          <div className="flex items-center gap-6 pr-3 shrink-0">
            {/* Stats */}
            <div className="flex gap-8">
              <div className="space-y-0.5">
                <p className="font-mono text-sm text-muted-foreground uppercase tracking-wider">
                  Started
                </p>
                <p className="font-mono text-sm text-foreground">
                  {job.startedAt
                    ? new Date(job.startedAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })
                    : "—"}
                </p>
              </div>
              <div className="space-y-0.5">
                <p className="font-mono text-sm text-muted-foreground uppercase tracking-wider">
                  Total Time
                </p>
                <p className="font-mono text-sm text-foreground flex items-center gap-1">
                  <Clock className="size-4 text-blue-400" />
                  {formatTime(job.totalProcessingTimeSeconds)}
                </p>
              </div>
            </div>

            {/* Start button — only for pending jobs */}
            {status === "pending" && (
              <div className="flex flex-col items-end gap-1">
                <Button
                  size="sm"
                  onClick={onStart}
                  disabled={actionLoading || hasRunningJob}
                  className="cursor-pointer rounded-sm uppercase font-mono text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-40 shrink-0"
                >
                  {actionLoading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Play className="size-4 fill-white" />
                  )}
                  {actionLoading ? "Starting..." : "Start"}
                </Button>
                {hasRunningJob && !job.isRunning && (
                  <span className="font-mono text-[10px] text-muted-foreground">
                    Another job is running
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        <Separator />

        {/* ── Progress Bar ─────────────────────────────────────────────── */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm font-mono text-muted-foreground">
            <span>
              {job.failedResultCount + job.successfulResultCount}/{total} inputs
            </span>
            <span>{successPercent + failurePercent}%</span>
          </div>

          <div className="w-full bg-muted rounded-xs h-3 overflow-hidden flex">
            <div
              className="bg-blue-500 h-full transition-all duration-500"
              style={{ width: `${successPercent}%` }}
            />
            <div
              className="bg-red-500 h-full transition-all duration-500"
              style={{ width: `${failurePercent}%` }}
            />
          </div>

          <div className="flex items-center gap-4 text-sm font-mono text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
              {`Extracted ${successPercent}% (${job.successfulResultCount})`}
            </span>
            {failurePercent > 0 && (
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
                {`Failed ${failurePercent}% (${job.failedResultCount})`}
              </span>
            )}
          </div>

          {job.currentInputLabel && status === "running" && (
            <p className="text-xs font-mono text-muted-foreground truncate flex items-center gap-1.5">
              <Cpu className="size-3 text-blue-400 shrink-0" />
              Processing: <span className="text-foreground">{job.currentInputLabel}</span>
            </p>
          )}
          {job.lastSuccessfulInputLabel && (
            <p className="text-xs font-mono text-muted-foreground truncate">
              Last successful input: <span className="text-foreground">{job.lastSuccessfulInputLabel}</span>
            </p>
          )}
        </div>
        <Separator />

        {/* ── Tabs ────────────────────────────────────────────────────── */}
        <Tabs defaultValue="results">
          <TabsList className="w-full">
            <TabsTrigger value="results" className="flex-1 font-mono text-xs gap-1.5">
              <CheckCircle2 className="size-3.5 text-emerald-400" />
              Results (
              {activeFilterCount > 0
                ? `${filteredSuccessfulResults.length}/${successfulResults.length}`
                : successfulResults.length}
              )
            </TabsTrigger>
            {/* Only show Failed tab when there are actually failed results */}
            {failedResults.length > 0 && (
              <TabsTrigger value="failed" className="flex-1 font-mono text-xs gap-1.5">
                <XCircle className="size-3.5 text-red-400" />
                Failed ({failedResults.length})
              </TabsTrigger>
            )}

            <TabsTrigger value="instruction" className="flex-1 font-mono text-xs gap-1.5">
              <FileText className="size-3.5 text-muted-foreground" />
              Instruction
            </TabsTrigger>
          </TabsList>

          <TabsContent value="results" className="mt-3">
            {successfulResults.length === 0 ? (
              <p className="text-xs text-muted-foreground font-mono">
                No results yet.
              </p>
            ) : (
              <>
                {/* ── Filter controls row ─────────────────────────────── */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
                    {activeFilterCount > 0 && (
                      <>
                        <span>
                          Showing {filteredSuccessfulResults.length} of {successfulResults.length}
                        </span>
                        <span className="text-muted-foreground/40">·</span>
                        <button
                          onClick={handleClearAll}
                          className="text-blue-400 hover:text-blue-300 transition-colors cursor-pointer"
                        >
                          Clear filters
                        </button>
                      </>
                    )}
                  </div>
                  <div className="flex items-end gap-1.5 pr-3">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setFilterSheetOpen(true)}
                      className="font-mono text-xs gap-1.5 rounded-sm cursor-pointer h-7 px-2"
                    >
                      <SlidersHorizontal className="size-3" />
                      Filter
                      {activeFilterCount > 0 && (
                        <span className="ml-0.5 bg-blue-500 text-white font-mono text-[10px] rounded-full size-4 flex items-center justify-center shrink-0">
                          {activeFilterCount}
                        </span>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleDownloadJSON}
                      className="font-mono text-xs gap-1.5 rounded-sm cursor-pointer h-7 px-2"
                    >
                      <Download className="w-3 h-3" />
                      Export JSON
                    </Button>
                  </div>
                </div>

                {/* ── Active filter tags ──────────────────────────────── */}
                {activeFilterCount > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {Object.entries(activeFilters).flatMap(([key, values]) =>
                      values.map((value) => (
                        <span
                          key={`${key}:${value}`}
                          className="inline-flex items-center gap-1 bg-blue-500/10 border border-blue-500/20 rounded-sm px-1.5 py-0.5 font-mono text-[10px] max-w-full"
                        >
                          <span className="uppercase text-muted-foreground shrink-0">
                            {key.replace(/_/g, " ")}:
                          </span>
                          <span className="text-blue-400 truncate" title={value}>
                            {truncateValue(value)}
                          </span>
                          <button
                            onClick={() => handleToggleValue(key, value)}
                            className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer shrink-0 leading-none"
                          >
                            <X className="size-3.5" />
                          </button>
                        </span>
                      )),
                    )}
                  </div>
                )}

                {/* ── Result cards ────────────────────────────────────── */}
                {filteredSuccessfulResults.length === 0 ? (
                  <p className="text-xs text-muted-foreground font-mono">
                    No results match the current filters.
                  </p>
                ) : (
                    <ScrollArea type="auto" className="h-500 pr-3">
                      <div className="space-y-4">
                        {filteredSuccessfulResults.map((result) => (
                          <ExtractionResultCard key={result.id} result={result} />
                        ))}
                      </div>
                    </ScrollArea>
                )}
              </>
            )}
          </TabsContent>

          {failedResults.length > 0 && (
            <TabsContent value="failed" className="mt-3">
              <p className="text-xs text-muted-foreground font-mono mb-3">
                These inputs failed during extraction. They will be skipped when you start this job again.
              </p>
              <ScrollArea type="auto" className="h-500 pr-3">
                <div className="space-y-4">
                  {failedResults.map((result) => (
                    <FailedResultCard key={result.id} result={result} />
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>
          )}

          <TabsContent value="instruction" className="mt-3 space-y-3">
            <div className="space-y-1">
              <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
                Title
              </p>
              <p className="font-mono text-sm text-foreground">{instructionTitle}</p>
            </div>
            <Separator />
            <div className="space-y-1.5">
              <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
                PROMPT TEMPLATE
              </p>
              <pre className="h-150 overflow-auto font-mono text-xs text-foreground whitespace-pre-wrap leading-relaxed bg-muted/40 border border-border rounded-lg p-3">
                {job.instruction.prompt}
              </pre>
            </div>
            {job.instruction.outputSchema && (
              <>
                <Separator />
                <div className="flex-1 rounded-md border border-border overflow-hidden flex flex-col">
                  {/* Title bar */}
                  <div className="bg-muted/60 border-b border-border px-3 py-2 flex items-center gap-2 shrink-0">
                    <span className="size-2.5 rounded-full bg-red-400/70" />
                    <span className="size-2.5 rounded-full bg-yellow-400/70" />
                    <span className="size-2.5 rounded-full bg-green-400/70" />
                    <span className="ml-2 font-mono text-[10px] text-muted-foreground/50 uppercase tracking-wider">
                      Output Schema
                    </span>
                  </div>
                  {/* Code body */}
                  <pre className="bg-preview-window flex-1 font-mono text-[11px] p-3 text-muted-foreground overflow-auto whitespace-pre leading-relaxed">
                    {JSON.stringify(schemaToSimplePreview(job.instruction.outputSchema!), null, 2)}
                  </pre>
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Filter Sheet ────────────────────────────────────────────────── */}
      <FilterSheet
        open={filterSheetOpen}
        onOpenChange={setFilterSheetOpen}
        facets={facets}
        activeFilters={activeFilters}
        onToggleValue={handleToggleValue}
        onClearAll={handleClearAll}
      />
    </ScrollArea>
  );
}
