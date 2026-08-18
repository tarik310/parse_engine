export interface InstructionDetails {
  id: string;
  title: string;
  prompt: string;
  outputSchema: Record<string, unknown> | null;
}

export interface DatasetSummary {
  id: string;
  name: string;
  slug: string;
}

export interface ModelOptions {
  temperature: number;
  num_ctx?: number;
  think?: boolean | "low" | "medium" | "high";
}

export interface ExtractionJob {
  id: string;
  title: string;
  modelName: string;
  instructionId: string;
  datasetId: string;
  instruction: InstructionDetails;
  dataset: DatasetSummary;
  modelOptions?: ModelOptions;
  isRunning: boolean;
  startedAt?: string | null;
  finishedAt?: string | null;
  totalProcessingTimeSeconds: number;
  successfulResultCount: number;
  failedResultCount: number;
  totalInputCount: number;
  lastSuccessfulInputLabel?: string | null;
  currentInputLabel?: string | null;
  createdAt: string;
  updatedAt: string;
}

// Primitive scalar values supported in structured extraction output.
export type Primitive = string | number | boolean | null;

// A flat object whose values are primitives or arrays of primitives (e.g. an invoice line item).
export type FlatObject = Record<string, Primitive | Primitive[]>;

// Flexible extraction output — supports scalars, tag lists, and arrays of flat objects (e.g. line items).
export type ExtractedData = Record<string, Primitive | Primitive[] | FlatObject[]>;

// Ollama usage metrics stored per extraction result (null for failed results).
export interface UsageMetrics {
  totalDuration: number;
  loadDuration: number;
  promptEvalCount: number;
  promptEvalDuration: number;
  evalCount: number;
  evalDuration: number;
}

export interface ExtractionResult {
  id: string;
  datasetInputId: string;
  inputLabel: string;
  contentHash: string;
  extractionJobId: string;
  processedAt: string;
  processingDurationSeconds: number;
  status: "success" | "failed";
  extractedData: ExtractedData | null;
  errorMessage: string | null;
  usageMetrics: UsageMetrics | null;
  createdAt: string;
}

export interface OllamaModel {
  name: string;
  supportsThinking: boolean;
  thinkType: "boolean" | "level";
}

export type RightPanelMode = "empty" | "view" | "create";

export type JobStatus = "pending" | "running" | "completed";
