"use client";

import { useState } from "react";
import { toast } from "react-toastify";
import { Button } from "@/components/shadcn_ui/button";
import { ScrollArea } from "@/components/shadcn_ui/scroll-area";
import { Plus, Loader2 } from "lucide-react";
import { ExtractionJob, ExtractionResult, RightPanelMode } from "./extraction-job/types";
import { ExtractionJobCard } from "./extraction-job/ExtractionJobCard";
import { ExtractionJobDetails } from "./extraction-job/ExtractionJobDetails";
import { CreateExtractionJobForm } from "./extraction-job/CreateExtractionJobForm";

// ── Right Panel: Empty State ──────────────────────────────────────────────────
function EmptyState() {
  return (
    <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm font-mono">
      ← Select an extraction job to view details
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface ExtractionJobPanelProps {
  jobs: ExtractionJob[];
  setJobs: React.Dispatch<React.SetStateAction<ExtractionJob[]>>;
  hasRunningJob: boolean;
  jobsLoading: boolean;
  // Result state managed by parent (fed by SSE)
  successfulResults: ExtractionResult[];
  failedResults: ExtractionResult[];
  // Callbacks to parent
  onSelectJob: (id: string) => Promise<void>; // triggers snapshot fetch + viewedJobId tracking
  onStarted: (jobId: string) => void;         // triggers SSE stream open after successful start
}

// ── Main ExtractionJobPanel ─────────────────────────────────────────────────────
export function ExtractionJobPanel({
  jobs,
  setJobs,
  hasRunningJob,
  jobsLoading,
  successfulResults,
  failedResults,
  onSelectJob,
  onStarted,
}: ExtractionJobPanelProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<RightPanelMode>("empty");
  const [actionLoading, setActionLoading] = useState(false);

  async function handleSelectJob(id: string) {
    setSelectedId(id);
    setMode("view");
    await onSelectJob(id);
  }

  function handleOpenCreate() {
    setMode("create");
  }
  function handleCancelCreate() {
    setMode(selectedId ? "view" : "empty");
  }

  async function handleCreated(newJob: ExtractionJob) {
    setJobs((prev) => [newJob, ...prev]);
    setSelectedId(newJob.id);
    setMode("view");
    // Notify parent to clear results and set viewedJobId for the new job
    await onSelectJob(newJob.id);
  }

  async function handleStart() {
    if (!selectedId) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/extraction-jobs/${selectedId}/start`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to start the extraction job.");
        return;
      }
      toast.success("Extraction job started.");
      // Open SSE immediately — SSE is the source of truth while running.
      // Do NOT call fetchJobs() here: the runner sets isRunning=true in the DB
      // only after the health check (~100–500ms), so a fetchJobs() call now
      // would return isRunning:false and overwrite the optimistic banner update.
      onStarted(selectedId);
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setActionLoading(false);
    }
  }

  const selectedJob = jobs.find((job) => job.id === selectedId) ?? null;

  // ── Sort: running job always first, preserve original order for the rest ──
  const sortedJobs = [...jobs].sort((a, b) => {
    if (a.isRunning && !b.isRunning) return -1;
    if (!a.isRunning && b.isRunning) return 1;
    return 0;
  });

  return (
    <div className="flex gap-3 h-full">
      {/* ── Left Panel — 20% ────────────────────────────────────────────────── */}
      <div className="w-1/5 flex flex-col gap-2 min-w-0">
        <div className="flex items-center justify-between shrink-0">
          <Button
            size="sm"
            onClick={handleOpenCreate}
            className="font-mono text-xs gap-1.5 bg-green-600 hover:bg-green-500 text-white"
          >
            <Plus className="w-3.5 h-3.5" />
            New
          </Button>
          <span className="font-mono text-xs text-muted-foreground uppercase tracking-wider">
            {jobs.length} {jobs.length === 1 ? "Extraction Job" : "Extraction Jobs"}
          </span>
        </div>

        <ScrollArea className="flex-1">
          <div className="space-y-2">
            {jobsLoading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              </div>
            )}
            {!jobsLoading && jobs.length === 0 && (
              <p className="text-center text-xs text-muted-foreground font-mono py-8">
                No extraction jobs yet.
                <br />
                Create your first one.
              </p>
            )}
            {!jobsLoading &&
              sortedJobs.map((job) => (
                <ExtractionJobCard
                  key={job.id}
                  job={job}
                  isSelected={selectedId === job.id}
                  onClick={() => handleSelectJob(job.id)}
                />
              ))}
          </div>
        </ScrollArea>
      </div>

      {/* ── Right Panel — 80% ───────────────────────────────────────────────── */}
      <div className="flex-1 border border-border rounded-sm bg-card flex flex-col overflow-hidden min-w-0">
        {mode === "empty" && <EmptyState />}

        {mode === "view" && selectedJob && (
          <ExtractionJobDetails
            key={selectedJob.id}
            job={selectedJob}
            successfulResults={successfulResults}
            failedResults={failedResults}
            hasRunningJob={hasRunningJob}
            actionLoading={actionLoading}
            onStart={handleStart}
          />
        )}

        {mode === "create" && (
          <CreateExtractionJobForm onCreated={handleCreated} onCancel={handleCancelCreate} />
        )}
      </div>
    </div>
  );
}
