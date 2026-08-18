/**
 * Extracted Data Sanitizer — lib/sanitizeExtractedData.ts
 *
 * Cleans parsed model output before it is stored
 * as `extractedData` in an ExtractionResult record.
 *
 * Rules applied (in order, at every level):
 *  1. Trim whitespace from all string values
 *  2. Drop keys whose value is null, undefined, or an empty string (post-trim)
 *  3. In arrays: remove null / undefined / empty-string entries; trim strings
 *  4. In FlatObject[] arrays: apply the same rules to each sub-object,
 *     then drop sub-objects that are empty after cleaning
 *  5. Drop keys whose array value is empty after the above filtering
 *
 */

import { ParsedModelOutput } from "./ollamaClient";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Returns true for values that carry no useful information. */
function isBlank(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string" && value.trim() === "") return true;
  return false;
}

/** Cleans a single primitive-or-array value from a flat object's field. */
function cleanPrimitiveOrArray(
  value: unknown,
): string | number | boolean | (string | number | boolean)[] | null {
  // Scalar primitives
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  // Arrays of primitives
  if (Array.isArray(value)) {
    const cleaned = value
      .map((item) => {
        if (typeof item === "string") {
          const t = item.trim();
          return t === "" ? null : t;
        }
        if (typeof item === "number" || typeof item === "boolean") return item;
        return null; // null / unexpected types → treated as blank
      })
      .filter((item): item is string | number | boolean => item !== null);

    return cleaned; // may be empty — caller decides whether to drop the key
  }

  return null; // unexpected type → treat as blank
}

/**
 * Cleans a flat sub-object (one item inside an object[] array).
 * Applies trim, drops null/empty values, returns null if the result is empty.
 */
function cleanFlatObject(
  obj: Record<string, unknown>,
): Record<string, string | number | boolean | (string | number | boolean)[]> | null {
  const cleaned: Record<string, string | number | boolean | (string | number | boolean)[]> = {};

  for (const [key, raw] of Object.entries(obj)) {
    if (isBlank(raw) && !Array.isArray(raw)) continue;

    const value = cleanPrimitiveOrArray(raw);

    if (value === null) continue;
    if (Array.isArray(value) && value.length === 0) continue;

    cleaned[key] = value;
  }

  return Object.keys(cleaned).length === 0 ? null : cleaned;
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Sanitizes the top-level parsed model output.
 *
 * @param raw - The parsed JSON object returned by callOllamaModel()
 * @returns   - A cleaned copy ready for storage as extractedData
 */
export function sanitizeExtractedData(raw: ParsedModelOutput): ParsedModelOutput {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    // Unexpected shape — return as-is so the audit trail (rawResponse) still
    // captures what the model returned; the record will show empty extractedData.
    return {};
  }

  const cleaned: ParsedModelOutput = {};

  for (const [key, value] of Object.entries(raw)) {
    // ── null / undefined / blank scalar ──────────────────────────────────────
    if (isBlank(value) && !Array.isArray(value)) continue;

    // ── Array ─────────────────────────────────────────────────────────────────
    if (Array.isArray(value)) {
      // Detect FlatObject[] — first non-null element is a plain object
      const firstReal = value.find((v) => v !== null && v !== undefined);
      const isFlatObjectArray =
        firstReal !== undefined &&
        typeof firstReal === "object" &&
        !Array.isArray(firstReal);

      if (isFlatObjectArray) {
        // Clean each sub-object, drop empty ones
        const cleanedItems = value
          .filter((item) => item !== null && item !== undefined && typeof item === "object" && !Array.isArray(item))
          .map((item) => cleanFlatObject(item as Record<string, unknown>))
          .filter((item): item is NonNullable<typeof item> => item !== null);

        if (cleanedItems.length > 0) {
          cleaned[key] = cleanedItems;
        }
        // else: drop key — entire array became empty after cleaning
      } else {
        // Primitive array — filter nulls and empty strings, trim strings
        const cleanedArray = value
          .map((item) => {
            if (typeof item === "string") {
              const t = item.trim();
              return t === "" ? null : t;
            }
            if (typeof item === "number" || typeof item === "boolean") return item;
            return null;
          })
          .filter((item): item is string | number | boolean => item !== null);

        if (cleanedArray.length > 0) {
          cleaned[key] = cleanedArray;
        }
        // else: drop key — e.g. [null, null] becomes []
      }

      continue;
    }

    // ── Scalar string ─────────────────────────────────────────────────────────
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed !== "") cleaned[key] = trimmed;
      continue;
    }

    // ── number / boolean ─────────────────────────────────────────────────────
    if (typeof value === "number" || typeof value === "boolean") {
      cleaned[key] = value;
      continue;
    }

    // ── Unexpected nested object (not in schema but model returned it) ────────
    // Attempt a best-effort clean rather than silently dropping it
    if (typeof value === "object") {
      const cleanedNested = cleanFlatObject(value as Record<string, unknown>);
      if (cleanedNested !== null) {
        cleaned[key] = cleanedNested as unknown as ParsedModelOutput[string];
      }
    }
  }

  return cleaned;
}
