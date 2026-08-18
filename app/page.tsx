"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "react-toastify";
import { InstructionPanel } from "@/components/InstructionPanel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/shadcn_ui/tabs";
import { ExtractionJobPanel } from "@/components/ExtractionJobPanel";
import { DatasetPanel } from "@/components/DatasetPanel";
import { RunningBanner } from "@/components/RunningBanner";
import { Cpu, FileText, Database, RefreshCcw, Wifi } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/shadcn_ui/tooltip";
import { ExtractionJob, ExtractionResult } from "@/components/extraction-job/types";
import type { ExtractionJobEvent } from "@/lib/extractionJobEvents";
import { Button } from "@/components/shadcn_ui/button";
import Logo from "@/components/Logo";
import SupportDev from "@/components/SupportDev";

export default function Home() {
  const [jobs, setJobs] = useState<ExtractionJob[]>([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [stopping, setStopping] = useState(false);
  const [ollamaOnline, setOllamaOnline] = useState<boolean | null>(null);

  // ── Result state lifted here so SSE can append to it ──────────────────────
  const [successfulResults, setSuccessfulResults] = useState<ExtractionResult[]>([]);
  const [failedResults, setFailedResults] = useState<ExtractionResult[]>([]);

  // ── Refs: avoid stale closures inside SSE onmessage handlers ─────────────
  const eventSourceRef = useRef<EventSource | null>(null);
  const viewedJobIdRef = useRef<string | null>(null); // extraction job currently being viewed

  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch("/api/extraction-jobs");
      const data = await res.json();
      setJobs(Array.isArray(data) ? data : []);
    } catch {
      console.error("Failed to fetch extraction jobs");
    } finally {
      setJobsLoading(false);
    }
  }, []);

  // ── SSE stream management ─────────────────────────────────────────────────
  const openSSEStream = useCallback(
    (jobId: string) => {
      // Close any existing stream first
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }

      const es = new EventSource(`/api/extraction-jobs/${jobId}/events`);
      eventSourceRef.current = es;

      es.onmessage = (e: MessageEvent) => {
        let event: ExtractionJobEvent;
        try {
          event = JSON.parse(e.data as string) as ExtractionJobEvent;
        } catch {
          return;
        }

        switch (event.type) {
          case "heartbeat":
            // Keep-alive ping — no UI action needed
            break;

          case "started":
            // Runner confirmed started — mark the job as running in local state
            setJobs((prev) =>
              prev.map((job) => (job.id === jobId ? { ...job, isRunning: true } : job)),
            );
            break;

          case "processing":
            setJobs((prev) =>
              prev.map((job) =>
                job.id === jobId
                  ? {
                      ...job,
                      currentInputLabel: event.currentInputLabel,
                      successfulResultCount: event.successfulResultCount,
                      failedResultCount: event.failedResultCount,
                    }
                  : job,
              ),
            );
            break;

          case "input_success":
            setJobs((prev) =>
              prev.map((job) =>
                job.id === jobId
                  ? {
                      ...job,
                      successfulResultCount: event.successfulResultCount,
                      failedResultCount: event.failedResultCount,
                      lastSuccessfulInputLabel: event.lastSuccessfulInputLabel,
                      currentInputLabel: null,
                    }
                  : job,
              ),
            );
            // Append the result only if the user is viewing this job
            if (viewedJobIdRef.current === jobId) {
              setSuccessfulResults((prev) => [event.result as ExtractionResult, ...prev]);
            }
            break;

          case "input_failed":
            setJobs((prev) =>
              prev.map((job) =>
                job.id === jobId
                  ? {
                      ...job,
                      successfulResultCount: event.successfulResultCount,
                      failedResultCount: event.failedResultCount,
                      currentInputLabel: null,
                    }
                  : job,
              ),
            );
            if (viewedJobIdRef.current === jobId) {
              setFailedResults((prev) => [event.result as ExtractionResult, ...prev]);
            }
            break;

          case "input_skipped":
            setJobs((prev) =>
              prev.map((job) =>
                job.id === jobId
                  ? {
                      ...job,
                      successfulResultCount: event.successfulResultCount,
                      failedResultCount: event.failedResultCount,
                    }
                  : job,
              ),
            );
            break;

          case "stopped":
          case "completed":
            setJobs((prev) =>
              prev.map((job) =>
                job.id === jobId
                  ? {
                      ...job,
                      isRunning: false,
                      currentInputLabel: null,
                      successfulResultCount: event.successfulResultCount,
                      failedResultCount: event.failedResultCount,
                      totalProcessingTimeSeconds: event.totalProcessingTimeSeconds,
                    }
                  : job,
              ),
            );
            es.close();
            eventSourceRef.current = null;
            // Final sync from DB to pick up any fields we don't track in SSE
            fetchJobs();
            break;
        }
      };

      es.onerror = () => {
        es.close();
        eventSourceRef.current = null;
        // Fall back to a DB fetch so the UI doesn't get stuck
        fetchJobs();
      };
    },
    [fetchJobs],
  );
  // ── Called when user selects an extraction job to view ───────────────────
  const handleSelectJob = useCallback(async (id: string) => {
    viewedJobIdRef.current = id;
    setSuccessfulResults([]);
    setFailedResults([]);
    try {
      const res = await fetch(`/api/extraction-jobs/${id}/results`);
      const data = await res.json();
      setSuccessfulResults(data.successfulResults ?? []);
      setFailedResults(data.failedResults ?? []);
    } catch {
      console.error("Failed to fetch extraction results snapshot");
    }
  }, []);
  // ── Initial load ──────────────────────────────────────────────────────────
  useEffect(() => {
    const initFetchJobs = async () => {
      await fetchJobs();
    };
    initFetchJobs();
  }, [fetchJobs]);

  // ── Reconnect SSE if a job is already running on page load ────────────────
  // Runs once when the initial fetchJobs completes (jobsLoading flips to false)
  useEffect(() => {
    if (jobsLoading) return;
    const runningJob = jobs.find((job) => job.isRunning);
    if (runningJob && !eventSourceRef.current) {
      openSSEStream(runningJob.id);
      // Also select the running job so viewedJobIdRef is set and the snapshot
      // loads — otherwise input_success/input_failed events are dropped because
      // viewedJobIdRef.current is null and results never appear on refresh.
      handleSelectJob(runningJob.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobsLoading]); // intentionally only fires when loading state changes

  // ── Cleanup SSE stream on unmount ─────────────────────────────────────────
  useEffect(() => {
    return () => {
      eventSourceRef.current?.close();
    };
  }, []);

  // ── Ollama health check — once on mount ───────────────────────────────────
  async function checkOllama() {
    setOllamaOnline(null);
    try {
      const res = await fetch("/api/ollama/models");
      setOllamaOnline(res.ok);
    } catch {
      setOllamaOnline(false);
    }
  }

  useEffect(() => {
    const initOllamaCheck = async () => {
      await checkOllama();
    };
    initOllamaCheck();
  }, []);

  // ── Called after a successful Start in the panel ─────────────────────────
  const handleStarted = useCallback(
    (jobId: string) => {
      // Optimistically mark as running so the banner appears immediately,
      // without waiting for the SSE "started" event (which can be missed if
      // the runner emits it before the EventSource connects).
      setJobs((prev) => prev.map((job) => (job.id === jobId ? { ...job, isRunning: true } : job)));
      openSSEStream(jobId);
    },
    [openSSEStream],
  );

  // ── Stop handler — owned here so banner and panel share the same action ───
  async function handleStop() {
    const runningJob = jobs.find((job) => job.isRunning);
    if (!runningJob) return;
    setStopping(true);
    try {
      const res = await fetch(`/api/extraction-jobs/${runningJob.id}/stop`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to stop the extraction job.");
        return;
      }
      toast.success(data.message || "Stop requested.");
      // Optimistically clear running state so the banner disappears immediately.
      // If the SSE stream is dead, the "stopped" event will never arrive and
      // the banner would hang forever. fetchJobs() syncs final DB state.
      setJobs((prev) =>
        prev.map((job) =>
          job.id === runningJob.id ? { ...job, isRunning: false, currentInputLabel: null } : job,
        ),
      );
      fetchJobs();
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setStopping(false);
    }
  }

  const runningJob = jobs.find((job) => job.isRunning) ?? null;
  const hasRunningJob = runningJob !== null;

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <header className="border-b border-border px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Logo className="size-7 fill-blue-500" />
            <span className="font-mono text-sm font-semibold tracking-widest uppercase">
              Parse Engine
            </span>
          </div>
          <SupportDev />
        </div>

        {ollamaOnline !== null && (
          <div className="flex items-center gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  {ollamaOnline ? (
                    <span className="flex items-center gap-1.5 font-mono text-[11px] text-green-400/80 cursor-default">
                      <Wifi className="size-4" />
                      Ollama running
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 font-mono text-[11px] text-red-400 cursor-help">
                      <span className="size-4 rounded-full bg-red-400/20 border border-red-400/40 flex items-center justify-center text-[10px] font-bold leading-none">
                        !
                      </span>
                      Ollama offline
                    </span>
                  )}
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  {ollamaOnline
                    ? "Ollama is running"
                    : "Ollama is unavailable. Make sure it is installed and running before starting an extraction job."}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={checkOllama}
                    variant="ghost"
                    size="icon"
                    className="size-6 text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    <RefreshCcw className="size-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Refresh Ollama status</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        )}
      </header>

      {/* ── Running Banner — sticky, only visible when an extraction job is running ── */}
      <RunningBanner runningJob={runningJob} onStop={handleStop} stopping={stopping} />

      {/* ── Main Content ──────────────────────────────────────────────────── */}
      <main className="flex-1 px-6 pt-6 pb-20 overflow-hidden">
        <Tabs defaultValue="extraction-jobs" className="h-full flex flex-col">
          {/* Tab Navigation */}
          <TabsList className="mb-6 shrink-0 w-full">
            <TabsTrigger
              value="extraction-jobs"
              className="gap-2 font-mono text-sm uppercase tracking-wider data-[state=active]:text-blue-400"
            >
              <Cpu className="w-5 h-5" />
              Extraction Jobs
            </TabsTrigger>
            <TabsTrigger
              value="datasets"
              className="gap-2 font-mono text-sm uppercase tracking-wider data-[state=active]:text-blue-400"
            >
              <Database className="w-5 h-5" />
              Datasets
            </TabsTrigger>
            <TabsTrigger
              value="instructions"
              className="gap-2 font-mono text-sm uppercase tracking-wider data-[state=active]:text-blue-400"
            >
              <FileText className="w-5 h-5" />
              Instructions
            </TabsTrigger>
          </TabsList>

          {/* Tab: Extraction Jobs */}
          <TabsContent value="extraction-jobs" className="flex-1 overflow-hidden mt-0">
            <ExtractionJobPanel
              jobs={jobs}
              setJobs={setJobs}
              hasRunningJob={hasRunningJob}
              jobsLoading={jobsLoading}
              successfulResults={successfulResults}
              failedResults={failedResults}
              onSelectJob={handleSelectJob}
              onStarted={handleStarted}
            />
          </TabsContent>

          {/* Tab: Datasets */}
          <TabsContent value="datasets" className="flex-1 overflow-hidden mt-0">
            <DatasetPanel />
          </TabsContent>

          {/* Tab: Instructions */}
          <TabsContent value="instructions" className="flex-1 overflow-hidden mt-0">
            <InstructionPanel />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
