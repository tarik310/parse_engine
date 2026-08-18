"use client";

import { Plus, X } from "lucide-react";
import { Button } from "@/components/shadcn_ui/button";
import { Input } from "@/components/shadcn_ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/shadcn_ui/select";

// ─── Types ────────────────────────────────────────────────────────────────────

type PrimitiveType = "string" | "number" | "boolean";
type SubFieldType = PrimitiveType | `${PrimitiveType}[]`;
type TopLevelFieldType = SubFieldType | "object[]";

export interface SubField {
  id: string; // crypto.randomUUID() — React key only, never sent to API
  name: string;
  type: SubFieldType;
}

export interface SchemaField {
  id: string; // crypto.randomUUID() — React key only
  name: string;
  type: TopLevelFieldType;
  subFields: SubField[]; // only populated when type === "object[]"
}

// ─── Schema generation (sent to Ollama) ──────────────────────────────────────

function primitiveToSchema(type: PrimitiveType) {
  return { type };
}

function subFieldTypeToSchema(type: SubFieldType): Record<string, unknown> {
  if (type === "string" || type === "number" || type === "boolean") {
    return primitiveToSchema(type);
  }
  const base = type.replace("[]", "") as PrimitiveType;
  return { type: "array", items: { type: base } };
}

export function schemaToSimplePreview(
  schema: Record<string, unknown>,
): Record<string, unknown> | null {
  const props = (schema?.properties ?? {}) as Record<string, Record<string, unknown>>;
  const result: Record<string, unknown> = {};

  for (const [key, prop] of Object.entries(props)) {
    if (prop.type === "array") {
      const items = prop.items as Record<string, unknown>;
      if (items?.type === "object") {
        const subProps = (items.properties ?? {}) as Record<string, Record<string, unknown>>;
        const subObj: Record<string, unknown> = {};
        for (const [sk, sv] of Object.entries(subProps)) {
          subObj[sk] =
            sv.type === "array" ? [(sv.items as Record<string, unknown>)?.type] : sv.type;
        }
        result[key] = [subObj];
      } else {
        result[key] = [items?.type];
      }
    } else {
      result[key] = prop.type;
    }
  }

  return Object.keys(result).length === 0 ? null : result;
}

// ─── Schema validation (call before submission) ───────────────────────────────
// Returns the first error message found, or null if the fields are valid.

export function validateSchemaFields(fields: SchemaField[]): string | null {
  const seenFieldNames = new Set<string>();

  for (const field of fields) {
    const name = field.name.trim();
    if (!name) continue; // unnamed top-level fields are silently skipped — not an error

    // Bug 4: duplicate top-level field name
    if (seenFieldNames.has(name)) {
      return `Duplicate field name: "${name}". Each field name must be unique.`;
    }
    seenFieldNames.add(name);

    if (field.type === "object[]") {
      // Bug 1 & 2: object[] must have at least one named sub-field
      const validSubFields = field.subFields.filter((s) => s.name.trim() !== "");
      if (validSubFields.length === 0) {
        return `Field "${name}" uses type object[] but has no sub-fields. Add at least one sub-field or choose another type.`;
      }

      // Bug 5: duplicate sub-field names within the same object[]
      const seenSubNames = new Set<string>();
      for (const sub of validSubFields) {
        const subName = sub.name.trim();
        if (seenSubNames.has(subName)) {
          return `Duplicate sub-field name "${subName}" inside field "${name}". Each sub-field name must be unique.`;
        }
        seenSubNames.add(subName);
      }
    }
  }

  return null;
}

export function buildOutputSchema(fields: SchemaField[]): Record<string, unknown> | null {
  const properties: Record<string, unknown> = {};

  for (const field of fields) {
    const name = field.name.trim();
    if (!name) continue;

    if (field.type === "object[]") {
      const subProperties: Record<string, unknown> = {};
      for (const sub of field.subFields) {
        const subName = sub.name.trim();
        if (!subName) continue;
        subProperties[subName] = subFieldTypeToSchema(sub.type);
      }
      // Skip object[] fields with no valid sub-fields — they produce an empty schema
      if (Object.keys(subProperties).length === 0) continue;
      properties[name] = {
        type: "array",
        items: { type: "object", properties: subProperties },
      };
    } else {
      properties[name] = subFieldTypeToSchema(field.type);
    }
  }

  if (Object.keys(properties).length === 0) return null;
  return { type: "object", properties };
}

// ─── Simplified preview (human-readable) ─────────────────────────────────────
// Renders the schema as a flat, readable shape — not full JSON Schema syntax.
// e.g. { "name": "string", "tags": ["string"], "items": [{ "price": "number" }] }

function buildPreview(fields: SchemaField[]): Record<string, unknown> | null {
  const result: Record<string, unknown> = {};

  for (const field of fields) {
    const name = field.name.trim();
    if (!name) continue;

    if (field.type === "object[]") {
      const subObj: Record<string, string> = {};
      for (const sub of field.subFields) {
        const subName = sub.name.trim();
        if (!subName) continue;
        subObj[subName] = sub.type; // e.g. "number" or "string[]"
      }
      // Skip if no valid sub-fields — avoids rendering [{}] in preview
      if (Object.keys(subObj).length === 0) continue;
      result[name] = [subObj];
    } else if (field.type.endsWith("[]")) {
      const base = field.type.replace("[]", ""); // e.g. "string"
      result[name] = [base];
    } else {
      result[name] = field.type; // e.g. "string"
    }
  }

  if (Object.keys(result).length === 0) return null;
  return result;
}

// ─── Dropdown options ─────────────────────────────────────────────────────────

const TOP_LEVEL_OPTIONS: { value: TopLevelFieldType; label: string }[] = [
  { value: "string", label: "string" },
  { value: "number", label: "number" },
  { value: "boolean", label: "boolean" },
  { value: "string[]", label: "string[]" },
  { value: "number[]", label: "number[]" },
  { value: "boolean[]", label: "boolean[]" },
  { value: "object[]", label: "object[]" },
];

const SUB_FIELD_OPTIONS: { value: SubFieldType; label: string }[] = [
  { value: "string", label: "string" },
  { value: "number", label: "number" },
  { value: "boolean", label: "boolean" },
  { value: "string[]", label: "string[]" },
  { value: "number[]", label: "number[]" },
  { value: "boolean[]", label: "boolean[]" },
];

// ─── Type color map ──────────────────────────────────────────────────────────

const TYPE_COLOR: Record<string, string> = {
  string: "text-green-400",
  number: "text-amber-400",
  boolean: "text-blue-400",
  "string[]": "text-green-400",
  "number[]": "text-amber-400",
  "boolean[]": "text-blue-400",
  "object[]": "text-purple-400",
};

// ─── TypeSelect ───────────────────────────────────────────────────────────────

function TypeSelect<T extends string>({
  value,
  options,
  size = "default",
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  size?: "default" | "sm";
  onChange: (v: T) => void;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as T)}>
      <SelectTrigger
        size={size}
        className={`rounded-sm font-mono text-[11px] w-27 shrink-0 ${TYPE_COLOR[value] ?? ""}`}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="p-1">
        {options.map((opt) => (
          <SelectItem
            key={opt.value}
            value={opt.value}
            className={`font-mono text-xs ${TYPE_COLOR[opt.value] ?? ""}`}
          >
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ─── SchemaBuilder ────────────────────────────────────────────────────────────

interface SchemaBuilderProps {
  value: SchemaField[];
  onChange: (fields: SchemaField[]) => void;
}

export function SchemaBuilder({ value, onChange }: SchemaBuilderProps) {
  // ── field handlers ──

  function addField() {
    onChange([...value, { id: crypto.randomUUID(), name: "", type: "string", subFields: [] }]);
  }

  function removeField(id: string) {
    onChange(value.filter((f) => f.id !== id));
  }

  function updateField(id: string, patch: Partial<Omit<SchemaField, "id">>) {
    onChange(
      value.map((f) => {
        if (f.id !== id) return f;
        const next = { ...f, ...patch };
        if (patch.type !== undefined && patch.type !== "object[]") {
          next.subFields = [];
        }
        return next;
      }),
    );
  }

  // ── sub-field handlers ──

  function addSubField(fieldId: string) {
    onChange(
      value.map((f) =>
        f.id !== fieldId
          ? f
          : {
              ...f,
              subFields: [...f.subFields, { id: crypto.randomUUID(), name: "", type: "string" }],
            },
      ),
    );
  }

  function removeSubField(fieldId: string, subId: string) {
    onChange(
      value.map((f) =>
        f.id !== fieldId ? f : { ...f, subFields: f.subFields.filter((s) => s.id !== subId) },
      ),
    );
  }

  function updateSubField(fieldId: string, subId: string, patch: Partial<Omit<SubField, "id">>) {
    onChange(
      value.map((f) =>
        f.id !== fieldId
          ? f
          : {
              ...f,
              subFields: f.subFields.map((s) => (s.id !== subId ? s : { ...s, ...patch })),
            },
      ),
    );
  }

  // ── preview ──
  const preview = buildPreview(value);

  // ── render ──
  return (
    <div className="flex gap-2">
      <div className="space-y-2 w-[50%]">
        {/* Field rows */}
        {value.length > 0 && (
          <div className="space-y-1.5 rounded-md border border-border bg-muted/20 p-3">
            {value.map((field) => (
              <div key={field.id}>
                {/* Top-level row */}
                <div className="flex items-center gap-2">
                  <Input
                    value={field.name}
                    onChange={(e) => updateField(field.id, { name: e.target.value })}
                    placeholder="field_name"
                    className="font-mono text-xs flex-1 min-w-0 rounded-sm"
                  />

                  <TypeSelect
                    value={field.type}
                    options={TOP_LEVEL_OPTIONS}
                    onChange={(t) => updateField(field.id, { type: t })}
                  />

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeField(field.id)}
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                  >
                    <X className="size-3.5" />
                  </Button>
                </div>

                {/* Sub-fields (object[] only) */}
                {field.type === "object[]" && (
                  <div className="ml-2 mt-1.5 space-y-1.5 border-l-2 border-purple-500/60 pl-3">
                    {field.subFields.map((sub) => (
                      <div key={sub.id} className="flex items-center gap-2">
                        <Input
                          value={sub.name}
                          onChange={(e) =>
                            updateSubField(field.id, sub.id, { name: e.target.value })
                          }
                          placeholder="sub_field"
                          className="font-mono text-[11px] flex-1 min-w-0 rounded-sm"
                        />

                        <TypeSelect
                          value={sub.type}
                          options={SUB_FIELD_OPTIONS}
                          onChange={(t) => updateSubField(field.id, sub.id, { type: t })}
                        />

                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeSubField(field.id, sub.id)}
                          className="shrink-0 text-muted-foreground hover:text-destructive"
                        >
                          <X className="size-3.5" />
                        </Button>
                      </div>
                    ))}

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => addSubField(field.id)}
                      className="h-7 px-2 font-mono text-[10px] text-purple-400 hover:text-purple-300 gap-1"
                    >
                      <Plus className="w-3 h-3" />
                      Add sub-field
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Add field */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addField}
          className="font-mono text-xs gap-1.5 text-muted-foreground hover:text-foreground w-full border-dashed"
        >
          <Plus className="size-3.5" />
          Add field
        </Button>
      </div>

      {/* Simplified preview — code-window style */}
      {preview && (
        <div className="flex-1 rounded-md border border-border overflow-hidden flex flex-col">
          {/* Title bar */}
          <div className="bg-muted/60 border-b border-border px-3 py-2 flex items-center gap-2 shrink-0">
            <span className="size-2.5 rounded-full bg-red-400/70" />
            <span className="size-2.5 rounded-full bg-yellow-400/70" />
            <span className="size-2.5 rounded-full bg-green-400/70" />
            <span className="ml-2 font-mono text-[10px] text-muted-foreground/50 uppercase tracking-wider">
              Preview
            </span>
          </div>
          {/* Code body */}
          <pre className="bg-preview-window flex-1 font-mono text-[11px] p-3 text-muted-foreground overflow-auto whitespace-pre leading-relaxed">
            {JSON.stringify(preview, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
