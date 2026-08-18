export interface Dataset {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  inputCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface DatasetInput {
  id: string;
  datasetId: string;
  label: string;
  contentHash: string;
  ingestionMethod: "file_upload" | "manual_entry" | "api";
  createdAt: string;
  updatedAt: string;
  // content is excluded from list responses — only fetched individually
}

export interface DuplicateRecord {
  submittedLabel: string;
  existingLabel: string;
  reason: "duplicate_content" | "duplicate_label";
}

export interface InputIngestionResult {
  added: number;
  skipped: number;
  duplicates: DuplicateRecord[];
}

export interface PaginationInfo {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export type RightPanelMode = "empty" | "view" | "create";
