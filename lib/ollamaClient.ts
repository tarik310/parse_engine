/**
 * Ollama Client — lib/ollamaClient.ts
 *
 * Uses the official Ollama JavaScript/TypeScript library.
 * Install: npm install ollama
 *
 * The caller is responsible for injecting input content into the prompt
 * before passing it here. This keeps renderedPrompt available in the caller's
 * scope so it can be stored even when this function throws.
 *
 * Uses /api/chat instead of /api/generate so that thinking models
 * (gpt-oss, qwen3, deepseek-r1, etc.) work correctly — the reasoning
 * trace is separated into message.thinking while message.content always
 * contains only the clean final answer.
 */

import { Ollama } from "ollama";
import { fetch as undiciFetch, Agent } from "undici";
import type { ModelOptions } from "@/components/extraction-job/types";

/**
 * Custom undici Agent with extended timeouts for Ollama model calls only.
 *
 * Node.js's built-in fetch uses undici internally with a default
 * headersTimeout of 300s (5 minutes). Large models processing large inputs
 * can take longer than that before sending back the first response header.
 *
 * This agent is used ONLY for Ollama model calls — all other requests in the
 * project continue using Node.js defaults.
 */
const ollamaAgent = new Agent({
  headersTimeout: 600_000, // 10 minutes — overrides undici's 5-minute default
  bodyTimeout: 600_000, // 10 minutes — for large response bodies
});

/**
 * Checks if Ollama is reachable and running.
 * Used before starting an extraction job to catch offline Ollama early.
 *
 * @returns true if Ollama is reachable, false otherwise
 */
export async function checkOllamaHealth(): Promise<boolean> {
  try {
    const res = await fetch(process.env.OLLAMA_URL + "/api/tags", {
      signal: AbortSignal.timeout(5_000), // 5 second health check timeout
    });
    return res.ok;
  } catch {
    return false;
  }
}

// Flexible key-value output — matches whatever fields the instruction instructs the model to extract
// Supports scalars, arrays of primitives, and arrays of flat objects (e.g. invoice line items)
export type ParsedModelOutput = Record<string, unknown>;

// ── Usage metrics returned by the Ollama API ──────────────────────────────────
// All timing values are in nanoseconds; token counts are raw integers.
export interface OllamaUsageMetrics {
  totalDuration: number; // total wall-clock time for the request
  loadDuration: number; // time spent loading the model
  promptEvalCount: number; // number of input tokens processed
  promptEvalDuration: number; // time spent evaluating the prompt
  evalCount: number; // number of output tokens generated
  evalDuration: number; // time spent generating output tokens
}

/**
 * Return shape of callOllamaModel.
 *
 * - parsedOutput — parsed JSON object returned by the model
 * - rawResponse  — raw response string received from the model before parsing
 * - usageMetrics — Ollama performance/usage counters for this call
 *
 * renderedPrompt is NOT returned here — the caller builds it before calling this
 * function so it remains available in the catch block on failure.
 */
export interface OllamaModelCallResult {
  parsedOutput: ParsedModelOutput;
  rawResponse: string;
  usageMetrics: OllamaUsageMetrics;
}

/**
 * Calls the local Ollama model with the given prompt and model options.
 *
 * The caller is responsible for constructing renderedPrompt (i.e. injecting
 * the input content into the prompt template) before passing it in.
 * This ensures renderedPrompt is available in the caller's scope regardless
 * of whether this function succeeds or throws.
 *
 * Uses ollama.chat() instead of ollama.generate() so that:
 * - message.content always contains the final clean answer only
 * - message.thinking contains the reasoning trace (ignored by us)
 * - works correctly for all models — thinking and non-thinking alike
 *
 * @param renderedPrompt   - Full prompt string with input content already injected
 * @param modelName    - Ollama model name (e.g. "llama3.2", "gpt-oss:20b")
 * @param modelOptions - Per-job model configuration (temperature, num_ctx, think)
 * @param outputSchema - Optional JSON Schema object. When provided, passed to Ollama as the
 *                       `format` parameter for constrained decoding (guaranteed schema-matching
 *                       output). When absent, falls back to `format: "json"` (free-form JSON).
 * @param signal       - AbortSignal to cancel the request mid-flight (used by Stop)
 * @returns            - Parsed model output, raw response, and usage metrics
 */
export async function callOllamaModel(
  renderedPrompt: string,
  modelName: string,
  modelOptions: ModelOptions,
  outputSchema?: Record<string, unknown> | null,
  signal?: AbortSignal,
): Promise<OllamaModelCallResult> {
  // ── STEP 1: Build Ollama instance with custom fetch ───────────────────────
  const timeoutSignal = AbortSignal.timeout(
    process.env.OLLAMA_CALL_TIMEOUT ? parseInt(process.env.OLLAMA_CALL_TIMEOUT) : 600_000,
  ); // 10 minutes
  const combinedSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;

  const ollama = new Ollama({
    host: process.env.OLLAMA_URL,
    fetch: (url, options) =>
      undiciFetch(url.toString(), {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...(options as any),
        dispatcher: ollamaAgent,
        signal: combinedSignal,
      }) as unknown as Promise<Response>,
  });

  // ── STEP 2: Build options object — only include defined values ────────────
  const ollamaOptions: Record<string, number> = {
    temperature: modelOptions.temperature ?? 0,
  };
  if (modelOptions.num_ctx) {
    ollamaOptions.num_ctx = modelOptions.num_ctx;
  }

  // ── STEP 3: Call the model via chat API ────────────────────────────────────
  // think is a top-level parameter (not inside options) per Ollama docs.
  // We only pass it if it's explicitly set — undefined means don't send it.
  const response = await ollama.chat({
    model: modelName,
    messages: [{ role: "user", content: renderedPrompt }],
    // When an outputSchema is provided, pass it as a JSON Schema object for constrained
    // decoding — Ollama will guarantee the output matches the schema exactly.
    // Without a schema, fall back to free-form JSON mode.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    format: (outputSchema ?? "json") as any,
    stream: false,
    ...(modelOptions.think !== null &&
      modelOptions.think !== undefined && {
        think: modelOptions.think as boolean | "low" | "medium" | "high",
      }),
    options: ollamaOptions,
  });

  // ── STEP 4: Extract the raw response string ────────────────────────────────
  const rawResponse = response.message.content.trim();

  if (!rawResponse) {
    throw new Error(
      `Model returned an empty response. The input may be too large for the model's context window.`,
    );
  }

  // ── STEP 5: Parse the JSON result ─────────────────────────────────────────
  const jsonStart = rawResponse.indexOf("{");
  const jsonEnd = rawResponse.lastIndexOf("}");

  if (jsonStart === -1 || jsonEnd === -1) {
    throw new Error(`Model response did not contain valid JSON. Raw response: ${rawResponse}`);
  }

  const jsonStr = rawResponse.slice(jsonStart, jsonEnd + 1);
  const parsedOutput = JSON.parse(jsonStr) as ParsedModelOutput;

  // ── STEP 6: Return parsed output, raw response, and usage metrics ─────────────
  return {
    parsedOutput,
    rawResponse,
    usageMetrics: {
      totalDuration: response.total_duration ?? 0,
      loadDuration: response.load_duration ?? 0,
      promptEvalCount: response.prompt_eval_count ?? 0,
      promptEvalDuration: response.prompt_eval_duration ?? 0,
      evalCount: response.eval_count ?? 0,
      evalDuration: response.eval_duration ?? 0,
    },
  };
}
