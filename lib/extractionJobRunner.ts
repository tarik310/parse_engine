/**
 * Extraction Job Runner — lib/extractionJobRunner.ts
 *
 * Core async runner that executes an Extraction Job:
 * - Checks Ollama health before starting
 * - Queries DatasetInput records for the job's dataset
 * - Processes inputs sequentially
 * - Skips already-processed inputs (datasetInputId + extractionJobId check)
 * - Saves ExtractionResult record immediately per input (success or failure)
 * - Supports stopping by aborting the in-flight Ollama call
 * - Emits SSE events via extractionJobEvents for real-time UI updates
 */

import { prisma, Prisma } from "./prisma";
import { callOllamaModel, checkOllamaHealth } from "./ollamaClient";
import { sanitizeExtractedData } from "./sanitizeExtractedData";
import { emitExtractionJobEvent } from "./extractionJobEvents";
import type { ExtractedData } from "@/components/extraction-job/types";

/**
 * In-memory stop flags — keyed by extractionJobId string.
 */
const stopFlags: Record<string, boolean> = {};

/**
 * In-memory AbortControllers — keyed by extractionJobId string.
 * Used to cancel the in-flight Ollama request immediately on Stop.
 */
const abortControllers: Record<string, AbortController> = {};

export function requestExtractionJobStop(extractionJobId: string): void {
  stopFlags[extractionJobId] = true;
  if (abortControllers[extractionJobId]) {
    abortControllers[extractionJobId].abort();
  }
}

export function clearExtractionJobStopState(extractionJobId: string): void {
  delete stopFlags[extractionJobId];
  delete abortControllers[extractionJobId];
}

export function shouldStopExtractionJob(extractionJobId: string): boolean {
  return stopFlags[extractionJobId] === true;
}

/**
 * Main runner function.
 * Call this from the API route — it runs in the background (no await needed).
 */
export async function runExtractionJob(extractionJobId: string): Promise<void> {
  // ── STEP 1: Load Extraction Job ──────────────────────────────────────────────
  const job = await prisma.extractionJob.findUnique({ where: { id: extractionJobId } });
  if (!job) {
    console.error(`❌ Extraction job not found: ${extractionJobId}`);
    return;
  }

  // ── STEP 2: Load Instruction ───────────────────────────────────────────────
  const instruction = await prisma.instruction.findUnique({ where: { id: job.instructionId } });
  if (!instruction) {
    console.error(`❌ Instruction not found for extraction job: ${extractionJobId}`);
    return;
  }

  // ── STEP 3: Check Ollama health BEFORE touching the DB ────────────────────
  const ollamaHealthy = await checkOllamaHealth();
  if (!ollamaHealthy) {
    console.error(`❌ Ollama is not reachable. Aborting extraction job: ${extractionJobId}`);
    throw new Error("OLLAMA_OFFLINE");
  }

  // ── STEP 4: Mark as running ────────────────────────────────────────────────
  clearExtractionJobStopState(extractionJobId);
  await prisma.extractionJob.update({
    where: { id: extractionJobId },
    data: {
      isRunning: true,
      startedAt: job.startedAt ?? new Date(),
      finishedAt: null,
    },
  });

  // ── STEP 5: Capture previous processing time ───────────────────────────────────
  const previousProcessingTimeSeconds = job.totalProcessingTimeSeconds;
  const sessionStartedAtMs = Date.now();

  console.log(`🚀 Starting extraction job: ${job.title} (${extractionJobId})`);

  // ── STEP 6: Load dataset inputs ────────────────────────────────────────────
  const datasetInputs = await prisma.datasetInput.findMany({
    where: { datasetId: job.datasetId },
  });

  if (datasetInputs.length === 0) {
    console.warn("⚠️  No inputs found in the dataset.");
    await finishExtractionJob(job.id, job.title, sessionStartedAtMs, previousProcessingTimeSeconds, 0, 0, "completed");
    return;
  }

  // ── Initialize resume-aware counters ──────────────────────────────────────
  const initialSuccessfulResultCount = await prisma.extractionResult.count({
    where: { extractionJobId, status: "success" },
  });
  const initialFailedResultCount = await prisma.extractionResult.count({
    where: { extractionJobId, status: "failed" },
  });

  let successfulResultCount = initialSuccessfulResultCount;
  let failedResultCount = initialFailedResultCount;

  // ── Emit "started" ─────────────────────────────────────────────────────────
  emitExtractionJobEvent(extractionJobId, { type: "started", totalInputCount: datasetInputs.length });

  // ── Reconstruct modelOptions from flat columns ─────────────────────────────
  const modelOptions = {
    temperature: job.temperature,
    ...(job.numCtx != null && { num_ctx: job.numCtx }),
    ...(job.think != null && {
      think:
        job.think === "true" ? (true as const)
        : job.think === "false" ? (false as const)
        : (job.think as "low" | "medium" | "high"),
    }),
  };

  // ── STEP 7: Process inputs sequentially ───────────────────────────────────
  for (const input of datasetInputs) {
    // ── Check in-memory stop flag ────────────────────────────────────────────
    if (shouldStopExtractionJob(extractionJobId)) {
      console.log(`🛑 Stop flag detected. Halting.`);
      await finishExtractionJob(
        job.id,
        job.title,
        sessionStartedAtMs,
        previousProcessingTimeSeconds,
        successfulResultCount,
        failedResultCount,
        "stopped",
      );
      return;
    }

    // ── Re-check isRunning from DB ───────────────────────────────────────────
    const currentJob = await prisma.extractionJob.findUnique({ where: { id: extractionJobId } });
    if (!currentJob || !currentJob.isRunning) {
      console.log(`🛑 isRunning=false detected in DB. Halting.`);
      await finishExtractionJob(
        job.id,
        job.title,
        sessionStartedAtMs,
        previousProcessingTimeSeconds,
        successfulResultCount,
        failedResultCount,
        "stopped",
      );
      return;
    }

    // ── Check for duplicate (datasetInputId + extractionJobId) ─────────────────
    const alreadyProcessed = await prisma.extractionResult.findFirst({
      where: { datasetInputId: input.id, extractionJobId },
    });

    if (alreadyProcessed) {
      emitExtractionJobEvent(extractionJobId, {
        type: "input_skipped",
        label: input.label,
        successfulResultCount,
        failedResultCount,
      });
      continue;
    }

    // ── Create AbortController for this input's Ollama call ──────────────────
    const controller = new AbortController();
    abortControllers[extractionJobId] = controller;

    const inputStartedAtMs = Date.now();
    console.log(`⚙️  Processing: ${input.label}`);

    // ── Mark the input currently being processed (BEFORE emitting) ───────────
    await prisma.extractionJob.update({
      where: { id: extractionJobId },
      data: { currentInputLabel: input.label },
    });

    // ── Emit "processing" (AFTER save so DB is consistent) ────────────────────
    emitExtractionJobEvent(extractionJobId, {
      type: "processing",
      currentInputLabel: input.label,
      successfulResultCount,
      failedResultCount,
    });

    // ── Build renderedPrompt ───────────────────────────────────────────────────────
    const renderedPrompt = instruction.prompt.includes("{INPUT_TEXT}")
      ? instruction.prompt.replace("{INPUT_TEXT}", input.content)
      : `${instruction.prompt}\n\n<input_text>\n${input.content}\n</input_text>`;

    try {
      const { parsedOutput, rawResponse, usageMetrics } = await callOllamaModel(
        renderedPrompt,
        job.modelName,
        modelOptions,
        (instruction.outputSchema as Record<string, unknown>) ?? undefined,
        controller.signal,
      );

      const extractedData = sanitizeExtractedData(parsedOutput);
      const processingDurationSeconds = Math.round((Date.now() - inputStartedAtMs) / 1000);
      const processedAt = new Date();

      const created = await prisma.extractionResult.create({
        data: {
          inputLabel: input.label,
          contentHash: input.contentHash,
          extractionJobId,
          datasetInputId: input.id,
          processedAt,
          processingDurationSeconds,
          status: "success",
          extractedData: extractedData as unknown as Prisma.InputJsonObject,
          errorMessage: null,
          renderedPrompt,
          rawResponse,
          // Flatten usageMetrics into individual columns
          totalDuration: usageMetrics?.totalDuration ?? null,
          loadDuration: usageMetrics?.loadDuration ?? null,
          promptEvalCount: usageMetrics?.promptEvalCount ?? null,
          promptEvalDuration: usageMetrics?.promptEvalDuration ?? null,
          evalCount: usageMetrics?.evalCount ?? null,
          evalDuration: usageMetrics?.evalDuration ?? null,
        },
      });

      successfulResultCount++;

      const updatedTotalProcessingTimeSeconds = previousProcessingTimeSeconds + Math.round((Date.now() - sessionStartedAtMs) / 1000);
      await prisma.extractionJob.update({
        where: { id: extractionJobId },
        data: {
          lastSuccessfulInputLabel: input.label,
          currentInputLabel: null,
          totalProcessingTimeSeconds: updatedTotalProcessingTimeSeconds,
        },
      });

      // ── Emit "input_success" ───────────────────────────────────────────────
      emitExtractionJobEvent(extractionJobId, {
        type: "input_success",
        result: {
          id: created.id,
          inputLabel: input.label,
          status: "success",
          extractedData: extractedData as ExtractedData,
          errorMessage: null,
          processingDurationSeconds,
          processedAt: processedAt.toISOString(),
          datasetInputId: input.id,
          contentHash: input.contentHash,
          extractionJobId,
          createdAt: processedAt.toISOString(),
          usageMetrics: usageMetrics ?? null,
        },
        successfulResultCount,
        failedResultCount,
        lastSuccessfulInputLabel: input.label,
      });

      console.log(`✅ Done: ${input.label} (${processingDurationSeconds}s)`);
    } catch (err) {
      const processingDurationSeconds = Math.round((Date.now() - inputStartedAtMs) / 1000);

      // ── Detect abort ───────────────────────────────────────────────────────
      const isAbort =
        stopFlags[extractionJobId] === true &&
        err instanceof Error &&
        (err.name === "AbortError" || err.name === "TimeoutError");

      if (isAbort) {
        console.log(`🛑 Ollama call aborted for: ${input.label}. No record saved.`);
        await finishExtractionJob(
          job.id,
          job.title,
          sessionStartedAtMs,
          previousProcessingTimeSeconds,
          successfulResultCount,
          failedResultCount,
          "stopped",
        );
        return;
      }

      // ── Ollama went offline ────────────────────────────────────────────────
      const isOllamaOffline = err instanceof Error && err.message === "fetch failed";

      if (isOllamaOffline) {
        console.error(`❌ Ollama went offline during: ${input.label}. Stopping run.`);
        await finishExtractionJob(
          job.id,
          job.title,
          sessionStartedAtMs,
          previousProcessingTimeSeconds,
          successfulResultCount,
          failedResultCount,
          "stopped",
        );
        return;
      }

      // ── Genuine failure ────────────────────────────────────────────────────
      console.error(`❌ Error processing input: ${input.label}`, err);

      const processedAt = new Date();

      const created = await prisma.extractionResult.create({
        data: {
          inputLabel: input.label,
          contentHash: input.contentHash,
          extractionJobId,
          datasetInputId: input.id,
          processedAt,
          processingDurationSeconds,
          status: "failed",
          extractedData: Prisma.DbNull,
          errorMessage: JSON.stringify(err, Object.getOwnPropertyNames(err)),
          renderedPrompt,
          rawResponse: null,
        },
      });

      failedResultCount++;

      const updatedTotalProcessingTimeSeconds = previousProcessingTimeSeconds + Math.round((Date.now() - sessionStartedAtMs) / 1000);
      await prisma.extractionJob.update({
        where: { id: extractionJobId },
        data: {
          currentInputLabel: null,
          totalProcessingTimeSeconds: updatedTotalProcessingTimeSeconds,
        },
      });

      // ── Emit "input_failed" ────────────────────────────────────────────────
      emitExtractionJobEvent(extractionJobId, {
        type: "input_failed",
        result: {
          id: created.id,
          inputLabel: input.label,
          status: "failed",
          extractedData: null,
          errorMessage: JSON.stringify(err, Object.getOwnPropertyNames(err)),
          processingDurationSeconds,
          processedAt: processedAt.toISOString(),
          datasetInputId: input.id,
          contentHash: input.contentHash,
          extractionJobId,
          createdAt: processedAt.toISOString(),
          usageMetrics: null,
        },
        successfulResultCount,
        failedResultCount,
      });
    }
  }

  // ── STEP 8: All inputs iterated naturally ──────────────────────────────────
  await finishExtractionJob(
    job.id,
    job.title,
    sessionStartedAtMs,
    previousProcessingTimeSeconds,
    successfulResultCount,
    failedResultCount,
    "completed",
  );
  console.log(`🎉 Extraction job completed: ${job.title}`);
}

async function finishExtractionJob(
  extractionJobId: string,
  title: string,
  sessionStartedAtMs: number,
  previousProcessingTimeSeconds: number,
  successfulResultCount: number,
  failedResultCount: number,
  reason: "completed" | "stopped",
): Promise<void> {
  const totalProcessingTimeSeconds = previousProcessingTimeSeconds + Math.round((Date.now() - sessionStartedAtMs) / 1000);

  await prisma.extractionJob.update({
    where: { id: extractionJobId },
    data: {
      isRunning: false,
      finishedAt: new Date(),
      currentInputLabel: null,
      totalProcessingTimeSeconds,
    },
  });

  clearExtractionJobStopState(extractionJobId);

  emitExtractionJobEvent(extractionJobId, {
    type: reason,
    successfulResultCount,
    failedResultCount,
    totalProcessingTimeSeconds,
  });

  console.log(`📌 Extraction job finished (${reason}): ${title}. Total time: ${totalProcessingTimeSeconds}s`);
}
