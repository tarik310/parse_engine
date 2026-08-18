"use client";

import { useState } from "react";
import { toast } from "react-toastify";
import { Button } from "@/components/shadcn_ui/button";
import { Input } from "@/components/shadcn_ui/input";
import { Label } from "@/components/shadcn_ui/label";
import { Textarea } from "@/components/shadcn_ui/textarea";
import { ScrollArea } from "@/components/shadcn_ui/scroll-area";
import { Plus, Loader2, X } from "lucide-react";
import { Dataset } from "./types";

export function CreateDatasetForm({
  onCreated,
  onCancel,
}: {
  onCreated: (dataset: Dataset) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleCreate() {
    if (!name.trim()) {
      toast.error("Dataset name is required.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/datasets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Failed to create dataset.");
        return;
      }

      toast.success("Dataset created successfully.");
      onCreated(data);
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Header */}
      <div className="px-3 py-4 border-b border-border shrink-0 flex items-center justify-between">
        <h2 className="font-mono text-base font-semibold text-foreground">New Dataset</h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
          className="font-mono text-xs gap-1.5 text-muted-foreground"
        >
          <X className="size-3.5" />
          Cancel
        </Button>
      </div>

      {/* Form */}
      <ScrollArea className="flex-1">
        <div className="p-5 space-y-5">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="dataset-name" className="font-mono text-xs uppercase tracking-wider">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="dataset-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Invoices 2025"
              className="font-mono text-sm"
            />
            {name.trim() && (
              <p className="font-mono text-[11px] text-muted-foreground">
                Slug will be:{" "}
                <span className="text-foreground">
                  {name
                    .trim()
                    .toLowerCase()
                    .replace(/[^a-z0-9\s-]/g, "")
                    .replace(/\s+/g, "-")
                    .replace(/-+/g, "-")
                    .replace(/^-|-$/g, "")}
                </span>
              </p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label
              htmlFor="dataset-description"
              className="font-mono text-xs uppercase tracking-wider"
            >
              Description{" "}
              <span className="text-muted-foreground normal-case tracking-normal">(optional)</span>
            </Label>
            <Textarea
              id="dataset-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Invoices from 2025"
              className="font-mono text-xs h-24"
            />
          </div>

          <Button
            onClick={handleCreate}
            disabled={loading}
            className="w-full font-mono text-xs gap-2 bg-blue-600 hover:bg-blue-500 text-white"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {loading ? "Creating..." : "Create Dataset"}
          </Button>
        </div>
      </ScrollArea>
    </>
  );
}
