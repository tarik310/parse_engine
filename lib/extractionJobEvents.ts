/**
 * Extraction Job Events — lib/extractionJobEvents.ts
 *
 * In-process EventEmitter singleton for streaming runner progress to SSE clients.
 * The runner emits events here; the SSE route subscribes and forwards them to the browser.
 * Same-process pattern — safe for Next.js single-server deployments (same as stopFlags).
 */

import { EventEmitter } from "events";
import { ExtractedData, UsageMetrics } from "@/components/extraction-job/types";

// ── Payload for an extraction result sent over SSE ─────────────────────────
// Matches ExtractionResult from components/extraction-job/types.ts so it can be
// used directly as ExtractionResult in the frontend without any casting.
export interface ExtractionResultEventPayload {
  id: string;
  inputLabel: string;
  status: "success" | "failed";
  extractedData: ExtractedData | null;
  errorMessage: string | null;
  processingDurationSeconds: number;
  processedAt: string; // ISO string
  datasetInputId: string;
  // Fields required by ExtractionResult (always fixed values in dataset flow)
  contentHash: string;
  extractionJobId: string;
  createdAt: string; // ISO string — same as processedAt
  usageMetrics: UsageMetrics | null;
}

// ── Discriminated union of all event types ────────────────────────────────────
export type ExtractionJobEvent =
  | { type: "started"; totalInputCount: number }
  | {
      type: "processing";
      currentInputLabel: string;
      successfulResultCount: number;
      failedResultCount: number;
    }
  | {
      type: "input_success";
      result: ExtractionResultEventPayload;
      successfulResultCount: number;
      failedResultCount: number;
      lastSuccessfulInputLabel: string;
    }
  | {
      type: "input_failed";
      result: ExtractionResultEventPayload;
      successfulResultCount: number;
      failedResultCount: number;
    }
  | {
      type: "input_skipped";
      label: string;
      successfulResultCount: number;
      failedResultCount: number;
    }
  | {
      type: "stopped";
      successfulResultCount: number;
      failedResultCount: number;
      totalProcessingTimeSeconds: number;
    }
  | {
      type: "completed";
      successfulResultCount: number;
      failedResultCount: number;
      totalProcessingTimeSeconds: number;
    }
  | { type: "heartbeat" };

// ── Singleton emitter — stored on global to survive Next.js module re-evals ──
// Next.js can evaluate lib modules in separate module contexts for different
// API routes. A plain module-level `const emitter` would produce two separate
// EventEmitter instances — the runner emits to one, the SSE route listens to
// the other, and events never cross. Storing on `global` (same pattern as
// a global singleton) guarantees all routes share the exact same instance.
declare global {
  var __extractionJobEmitter: EventEmitter | undefined;
}

if (!global.__extractionJobEmitter) {
  global.__extractionJobEmitter = new EventEmitter();
  global.__extractionJobEmitter.setMaxListeners(50); // support multiple browser tabs
}

const emitter = global.__extractionJobEmitter;

export function emitExtractionJobEvent(extractionJobId: string, event: ExtractionJobEvent): void {
  emitter.emit(extractionJobId, event);
}

export function subscribeToExtractionJob(
  extractionJobId: string,
  handler: (event: ExtractionJobEvent) => void,
): void {
  emitter.on(extractionJobId, handler);
}

export function unsubscribeFromExtractionJob(
  extractionJobId: string,
  handler: (event: ExtractionJobEvent) => void,
): void {
  emitter.off(extractionJobId, handler);
}
