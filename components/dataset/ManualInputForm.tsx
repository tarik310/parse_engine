"use client";

import React, { useState } from "react";
import { toast } from "react-toastify";
import { Button } from "@/components/shadcn_ui/button";
import { Input } from "@/components/shadcn_ui/input";
import { Textarea } from "@/components/shadcn_ui/textarea";
import { Loader2, Plus, Trash2, Wand2 } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/shadcn_ui/radio-group";
import { Label } from "@/components/shadcn_ui/label";
import { InputIngestionResult } from "./types";
import { InputIngestionSummary } from "./InputIngestionSummary";

interface InputRow {
  id: string;
  label: string;
  content: string;
}

function makeRow(): InputRow {
  return { id: crypto.randomUUID(), label: "", content: "" };
}

export function ManualInputForm({
  datasetId,
  onAdded,
}: {
  datasetId: string;
  onAdded: () => void;
}) {
  const [rows, setRows] = useState<InputRow[]>([makeRow()]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<InputIngestionResult | null>(null);

  // Auto-label state
  const [autoPrefix, setAutoPrefix] = useState("");
  const [autoStart, setAutoStart] = useState(1);
  const [autoMode, setAutoMode] = useState<"fill" | "overwrite">("fill");

  function addRow() {
    setRows((prev) => [...prev, makeRow()]);
  }

  function updateRow(id: string, field: "label" | "content", value: string) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  }

  function removeRow(id: string) {
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  function applyAutoLabels() {
    const overwrite = autoMode === "overwrite";
    if (!autoPrefix.trim()) {
      toast.error("Enter a prefix before applying auto-labels.");
      return;
    }
    const prefix = autoPrefix.trim();
    setRows((prev) => {
      let serial = autoStart; // reset inside the updater so Strict Mode double-invoke is safe
      return prev.map((r) => {
        if (!overwrite && r.label.trim() !== "") return r; // skip non-empty when not overwriting
        const filled = { ...r, label: `${prefix}${serial}` };
        serial++;
        return filled;
      });
    });
  }

  async function handleSubmit() {
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const num = i + 1;
      if (!row.label.trim()) {
        toast.error(`Row ${num}: Label is required.`);
        return;
      }
      if (!row.content.trim()) {
        toast.error(`Row ${num}: Content is required.`);
        return;
      }
    }

    setLoading(true);
    setResult(null);

    try {
      const res = await fetch("/api/dataset-inputs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          datasetId,
          ingestionMethod: "manual_entry",
          inputs: rows.map((r) => ({
            label: r.label.trim(),
            content: r.content.trim(),
          })),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Failed to add inputs.");
        return;
      }

      setResult(data);

      if (data.added > 0) {
        toast.success(
          data.added === 1
            ? "Input added successfully."
            : `${data.added} inputs added successfully.`,
        );
        setRows([makeRow()]);
        onAdded();
      } else {
        toast.warning("No inputs were added — see summary below.");
      }
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Auto-label helper */}
      <div className="flex items-center gap-3">
        <div>
          <Label className="font-mono text-[10px] text-muted-foreground">
            <Wand2 className="w-3 h-3 text-muted-foreground shrink-0" />
            Auto-label prefix
          </Label>
          <Input
            value={autoPrefix}
            onChange={(e) => setAutoPrefix(e.target.value)}
            placeholder="Prefix, e.g. Input_"
            className="font-mono text-xs rounded-sm w-60"
          />
        </div>
        <div>
          <Label className="font-mono text-[10px] text-muted-foreground">Starting Number</Label>
          <Input
            type="number"
            min={0}
            value={autoStart}
            onChange={(e) => setAutoStart(Number(e.target.value))}
            className="font-mono text-xs rounded-sm w-14 shrink-0"
          />
        </div>

        <div>
          <Label className="font-mono text-[10px] text-muted-foreground">Auto-label Mode</Label>
          <RadioGroup
            value={autoMode}
            onValueChange={(v) => setAutoMode(v as "fill" | "overwrite")}
            className="flex items-center gap-3 shrink-0 h-8"
          >
            <div className="flex items-center gap-1">
              <RadioGroupItem value="fill" id="auto-fill" className="size-4" />
              <Label
                htmlFor="auto-fill"
                className="font-mono text-[10px] text-muted-foreground cursor-pointer"
              >
                Fill Empty Labels Only
              </Label>
            </div>
            <div className="flex items-center gap-1">
              <RadioGroupItem value="overwrite" id="auto-overwrite" className="size-4" />
              <Label
                htmlFor="auto-overwrite"
                className="font-mono text-[10px] text-muted-foreground cursor-pointer"
              >
                Overwrite All Labels
              </Label>
            </div>
          </RadioGroup>
        </div>
        <div className="self-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={applyAutoLabels}
            className="px-2 rounded-sm font-mono text-[10px] shrink-0 text-muted-foreground hover:text-foreground"
          >
            Apply
          </Button>
        </div>
      </div>

      {/* Grid table */}
      <div className="grid grid-cols-[1.5rem_1fr_2fr_1.5rem] gap-x-1.5 gap-y-1.5 items-start">
        {/* Divider */}
        <div className="col-span-4 border-t border-border" />
        {/* Header row */}
        <span className="font-mono text-[10px] text-muted-foreground px-1 text-center">#</span>
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground px-1">
          Label
        </span>
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground px-1">
          Content
        </span>
        <div /> {/* delete column — no header */}
        {/* Divider */}
        <div className="col-span-4 border-t border-border" />
        {/* Data rows */}
        {rows.map((row, index) => (
          <React.Fragment key={row.id}>
            {/* Row number */}
            <span className="font-mono text-[12px] text-muted-foreground/60 text-center pt-1.5">
              {index + 1}
            </span>

            {/* Label input */}
            <Input
              value={row.label}
              onChange={(e) => updateRow(row.id, "label", e.target.value)}
              placeholder={`e.g. Input_${index + 1}`}
              className="font-mono text-xs rounded-sm"
            />

            {/* Content textarea */}
            <Textarea
              value={row.content}
              onChange={(e) => updateRow(row.id, "content", e.target.value)}
              placeholder="Paste or type the raw text here..."
              className="font-mono text-xs rounded-sm resize-y h-25 max-h-50"
            />

            {/* Delete button */}
            <Button
              variant="destructive"
              onClick={() => removeRow(row.id)}
              disabled={rows.length === 1}
              className="rounded-sm hover:text-destructive transition-colors cursor-pointer disabled:opacity-0 disabled:pointer-events-none"
              aria-label={`Remove row ${index + 1}`}
            >
              <Trash2 className="size-3" />
            </Button>
          </React.Fragment>
        ))}
      </div>

      {/* Add row */}
      <Button
        type="button"
        variant="outline"
        onClick={addRow}
        disabled={loading}
        className="rounded-sm w-full font-mono text-xs gap-2 border-dashed text-muted-foreground hover:text-foreground"
      >
        <Plus className="size-3.5" />
        Add Row
      </Button>

      {/* Submit */}
      <Button
        onClick={handleSubmit}
        disabled={loading}
        className="rounded-sm w-full font-mono text-xs gap-2 bg-blue-600 hover:bg-blue-500 text-white"
      >
        {loading ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
        {loading ? "Adding..." : rows.length === 1 ? "Add Input" : `Add ${rows.length} Inputs`}
      </Button>

      {/* Result summary */}
      {result && !loading && <InputIngestionSummary result={result} />}
    </div>
  );
}
