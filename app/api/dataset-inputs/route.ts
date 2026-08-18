import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";

export interface InputItem {
  label: string;
  content: string;
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

function computeContentHash(content: string): string {
  return crypto.createHash("sha1").update(content, "utf8").digest("hex");
}

/**
 * Core input ingestion handler.
 * Called directly by the UI (file_upload, manual_entry) and internally
 * by the slug-based programmatic route (api).
 *
 * Uses two bulk queries upfront to load all existing hashes and labels
 * into memory, then checks duplicates in-memory per input, and finally
 * creates all valid, non-duplicate inputs in one createMany call.
 * Total DB calls: 3 regardless of input count.
 *
 * Body:
 * {
 *   datasetId: string,
 *   ingestionMethod: "file_upload" | "manual_entry" | "api",
 *   inputs: [{ label: string, content: string }]
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { datasetId, ingestionMethod, inputs } = body;

    // ── Validate required fields ───────────────────────────────────────────
    if (!datasetId?.trim()) {
      return NextResponse.json({ error: "datasetId is required." }, { status: 400 });
    }

    if (!ingestionMethod || !["file_upload", "manual_entry", "api"].includes(ingestionMethod)) {
      return NextResponse.json(
        { error: "ingestionMethod must be one of: file_upload, manual_entry, api." },
        { status: 400 },
      );
    }

    if (!Array.isArray(inputs) || inputs.length === 0) {
      return NextResponse.json({ error: "inputs must be a non-empty array." }, { status: 400 });
    }

    // ── Verify dataset exists ──────────────────────────────────────────────
    const dataset = await prisma.dataset.findUnique({ where: { id: datasetId } });
    if (!dataset) {
      return NextResponse.json({ error: "Dataset not found." }, { status: 404 });
    }

    // ── BULK QUERY: Load all existing hashes and labels upfront ───────────
    // Replaces N×2 individual queries with 1 query total.
    // All duplicate checks happen in-memory via Map lookups — O(1) each.
    const existingRecords = await prisma.datasetInput.findMany({
      where: { datasetId },
      select: { contentHash: true, label: true },
    });

    const existingContentHashMap = new Map<string, string>(existingRecords.map((r) => [r.contentHash, r.label]));
    const existingLabelMap = new Map<string, string>(
      existingRecords.map((r) => [r.label, r.label]),
    );

    const result: InputIngestionResult = {
      added: 0,
      skipped: 0,
      duplicates: [],
    };

    const inputsToCreate: {
      datasetId: string;
      label: string;
      content: string;
      contentHash: string;
      ingestionMethod: string;
    }[] = [];

    // ── Check each input in memory ─────────────────────────────────────────
    for (const input of inputs) {
      const { label, content } = input as InputItem;

      if (!label?.trim() || !content?.trim()) {
        result.skipped++;
        continue;
      }

      const trimmedLabel = label.trim();
      const trimmedContent = content.trim();
      const contentHash = computeContentHash(trimmedContent);

      // ── Content duplicate check ────────────────────────────────────────
      if (existingContentHashMap.has(contentHash)) {
        result.skipped++;
        result.duplicates.push({
          submittedLabel: trimmedLabel,
          existingLabel: existingContentHashMap.get(contentHash)!,
          reason: "duplicate_content",
        });
        continue;
      }

      // ── Label duplicate check ──────────────────────────────────────────
      if (existingLabelMap.has(trimmedLabel)) {
        result.skipped++;
        result.duplicates.push({
          submittedLabel: trimmedLabel,
          existingLabel: existingLabelMap.get(trimmedLabel)!,
          reason: "duplicate_label",
        });
        continue;
      }

      // ── Queue for creation ────────────────────────────────────────────
      // Update in-memory maps to catch duplicates within the same batch
      existingContentHashMap.set(contentHash, trimmedLabel);
      existingLabelMap.set(trimmedLabel, trimmedLabel);

      inputsToCreate.push({
        datasetId,
        label: trimmedLabel,
        content: trimmedContent,
        contentHash,
        ingestionMethod,
      });
    }

    // ── BULK CREATE: one createMany for all valid inputs ─────────────────────
    if (inputsToCreate.length > 0) {
      await prisma.datasetInput.createMany({ data: inputsToCreate });
      result.added = inputsToCreate.length;
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("❌ Failed to add dataset inputs:", error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
