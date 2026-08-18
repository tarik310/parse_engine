import { ExtractionResult, Primitive } from "./types";

export interface FacetValue {
  value: string;
  count: number;
}

export interface Facet {
  key: string;
  totalResults: number; // number of results that have a non-empty value for this key
  values: FacetValue[]; // sorted by count desc
}

// key → array of selected values (empty array = no filter on this key)
export type FilterState = Record<string, string[]>;

// ── Helpers ────────────────────────────────────────────────────────────────────

function isFlatObjectArray(val: unknown): val is Record<string, unknown>[] {
  return (
    Array.isArray(val) &&
    val.length > 0 &&
    typeof val[0] === "object" &&
    val[0] !== null &&
    !Array.isArray(val[0])
  );
}

function isSingleFlatObject(val: unknown): val is Record<string, unknown> {
  return typeof val === "object" && val !== null && !Array.isArray(val);
}

// Extract [facetKey, facetValue] pairs from one extractedData entry.
//
// Scalar / Primitive[]     → facetKey = fieldKey
// Single FlatObject        → facetKey = "fieldKey.subKey"  (one pair per primitive value)
// FlatObject[]             → facetKey = "fieldKey.subKey"  (one pair per cell across all rows)
//
// The dot-namespaced keys let computeFacets and matchesFilters distinguish which
// sub-key a value belongs to without losing the parent field context.
function toFacetableEntries(fieldKey: string, raw: unknown): Array<[string, string]> {
  if (raw === null || raw === undefined || raw === "") return [];

  // FlatObject[] → expand each row's primitive cells to "fieldKey.subKey" facets
  if (isFlatObjectArray(raw)) {
    const out: Array<[string, string]> = [];
    for (const row of raw) {
      for (const [subKey, val] of Object.entries(row)) {
        if (val === null || val === undefined || val === "" || typeof val === "object") continue;
        out.push([`${fieldKey}.${subKey}`, String(val)]);
      }
    }
    return out;
  }

  // Primitive[] → use fieldKey as-is
  if (Array.isArray(raw)) {
    return (raw as Primitive[])
      .filter((v) => v !== null && v !== undefined && v !== "")
      .map((v) => [fieldKey, String(v)]);
  }

  // Single FlatObject → expand primitive values to "fieldKey.subKey" facets
  if (isSingleFlatObject(raw)) {
    const out: Array<[string, string]> = [];
    for (const [subKey, val] of Object.entries(raw)) {
      if (val === null || val === undefined || val === "" || typeof val === "object") continue;
      out.push([`${fieldKey}.${subKey}`, String(val)]);
    }
    return out;
  }

  // Primitive scalar
  return [[fieldKey, String(raw)]];
}

// ── Facet computation ─────────────────────────────────────────────────────────
// Iterates all successfulResults, expands facetable fields, and returns one Facet per key.
//
// Scalar and Primitive[] fields  → one facet keyed by field name
// FlatObject / FlatObject[]      → one facet per sub-key, keyed "field.subKey"
//
// Facets are sorted by totalResults desc (broadest coverage first).
export function computeFacets(successfulResults: ExtractionResult[]): Facet[] {
  // facetKey → value → count of occurrences
  const valueCountMap: Record<string, Record<string, number>> = {};
  // facetKey → count of results contributing at least one value for that key
  const resultCountMap: Record<string, number> = {};

  for (const result of successfulResults) {
    if (!result.extractedData) continue;

    for (const [fieldKey, raw] of Object.entries(result.extractedData)) {
      const entries = toFacetableEntries(fieldKey, raw);
      if (entries.length === 0) continue;

      // Increment result count once per unique facet key this result contributes to
      const keysInResult = new Set(entries.map(([k]) => k));
      for (const k of keysInResult) {
        if (!valueCountMap[k]) valueCountMap[k] = {};
        resultCountMap[k] = (resultCountMap[k] ?? 0) + 1;
      }

      for (const [facetKey, facetVal] of entries) {
        valueCountMap[facetKey][facetVal] = (valueCountMap[facetKey][facetVal] ?? 0) + 1;
      }
    }
  }

  return Object.entries(valueCountMap)
    .map(([key, valueCounts]) => ({
      key,
      totalResults: resultCountMap[key] ?? 0,
      values: Object.entries(valueCounts)
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count),
    }))
    .sort((a, b) => b.totalResults - a.totalResults);
}

// ── Filter matching ───────────────────────────────────────────────────────────
// AND across keys — every key with an active selection must match.
// OR within a key — at least one selected value must be present in the result.
//
// Dot-namespaced filter keys (e.g. "arr.a") look up the parent field then
// check the specific sub-key; top-level keys match scalars and Primitive[].
// Missing key with active filter: result is excluded.
export function matchesFilters(result: ExtractionResult, filters: FilterState): boolean {
  if (!result.extractedData) return false;

  for (const [filterKey, selectedValues] of Object.entries(filters)) {
    if (selectedValues.length === 0) continue;

    const dotIdx = filterKey.indexOf(".");

    if (dotIdx !== -1) {
      // Sub-key filter: "parentField.subKey"
      const fieldName = filterKey.slice(0, dotIdx);
      const subKey = filterKey.slice(dotIdx + 1);
      const raw = result.extractedData[fieldName];

      if (raw === undefined || raw === null) return false;

      const subValues: string[] = [];

      if (isFlatObjectArray(raw)) {
        for (const row of raw) {
          const v = row[subKey];
          if (v !== null && v !== undefined && v !== "" && typeof v !== "object") {
            subValues.push(String(v));
          }
        }
      } else if (isSingleFlatObject(raw)) {
        const v = raw[subKey];
        if (v !== null && v !== undefined && v !== "" && typeof v !== "object") {
          subValues.push(String(v));
        }
      }

      if (!selectedValues.some((sel) => subValues.includes(sel))) return false;
    } else {
      // Top-level filter: scalars and Primitive[] only
      const raw = result.extractedData[filterKey];
      if (raw === undefined || raw === null || raw === "") return false;

      // Object-shaped fields use dot-namespaced sub-key filters — never top-level
      if (isSingleFlatObject(raw) || isFlatObjectArray(raw)) return false;

      const resultValues: string[] = Array.isArray(raw)
        ? (raw as Primitive[]).filter((v) => v !== null && v !== undefined && v !== "").map(String)
        : [String(raw)];

      if (!selectedValues.some((sel) => resultValues.includes(sel))) return false;
    }
  }

  return true;
}
