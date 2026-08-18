"use client";

import { useState, useRef, useCallback } from "react";
import { toast } from "react-toastify";
import { Button } from "@/components/shadcn_ui/button";
import { Loader2, Upload, FolderOpen, FileText } from "lucide-react";
import { InputIngestionResult } from "./types";
import { InputIngestionSummary } from "./InputIngestionSummary";

export function UploadInputsForm({
  datasetId,
  onUploaded,
}: {
  datasetId: string;
  onUploaded: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<InputIngestionResult | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // ── Read and submit files ──────────────────────────────────────────────────
  async function processFiles(files: FileList | File[]) {
    const fileArray = Array.from(files).filter((f) => f.name.endsWith(".txt"));

    if (fileArray.length === 0) {
      toast.error("No .txt files found in the selection.");
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      // Read all file contents client-side
      const inputs = await Promise.all(
        fileArray.map(
          (file) =>
            new Promise<{ label: string; content: string }>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = (e) =>
                resolve({
                  label: file.name,
                  content: (e.target?.result as string) ?? "",
                });
              reader.onerror = reject;
              reader.readAsText(file, "utf-8");
            }),
        ),
      );

      const res = await fetch("/api/dataset-inputs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          datasetId,
          ingestionMethod: "file_upload",
          inputs,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Upload failed.");
        return;
      }

      setResult(data);
      if (data.added > 0) {
        toast.success(`${data.added} file${data.added === 1 ? "" : "s"} added.`);
        onUploaded();
      } else {
        toast.warning("No new files were added.");
      }
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setLoading(false);
      // Reset file inputs so same files can be re-selected after clearing
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (folderInputRef.current) folderInputRef.current.value = "";
    }
  }

  // ── Drag and drop handlers ─────────────────────────────────────────────────
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files.length > 0) {
        processFiles(e.dataTransfer.files);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [datasetId],
  );

  return (
    <div className="space-y-4">
      <p className="font-mono text-xs text-muted-foreground">
        File names are used as input labels. Only .txt files are supported.
      </p>
      {/* ── Drop zone ───────────────────────────────────────────────────── */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-sm p-8 flex flex-col items-center justify-center gap-3 transition-colors ${
          isDragging
            ? "border-blue-500/60 bg-blue-500/5"
            : "border-border bg-muted/20 hover:border-blue-500/30"
        }`}
      >
        <Upload className={`size-8 ${isDragging ? "text-blue-400" : "text-muted-foreground"}`} />
        <div className="text-center space-y-1">
          <p className="font-mono text-sm text-foreground">Drop .txt files here</p>
          <p className="font-mono text-xs text-muted-foreground">or use the buttons below</p>
        </div>
      </div>

      {/* ── Buttons ─────────────────────────────────────────────────────── */}
      <div className="flex gap-2">
        {/* Multi-select files */}
        <Button
          variant="outline"
          size="sm"
          disabled={loading}
          onClick={() => fileInputRef.current?.click()}
          className="flex-1 font-mono text-xs gap-1.5 cursor-pointer"
        >
          <FileText className="size-3.5" />
          Select Files
        </Button>

        {/* Folder select */}
        <Button
          variant="outline"
          size="sm"
          disabled={loading}
          onClick={() => folderInputRef.current?.click()}
          className="flex-1 font-mono text-xs gap-1.5 cursor-pointer"
        >
          <FolderOpen className="size-3.5" />
          Select Folder
        </Button>
      </div>

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".txt"
        multiple
        className="hidden"
        onChange={(e) => e.target.files && processFiles(e.target.files)}
      />
      {/* webkitdirectory is not in React's types — using data attribute workaround */}
      <input
        ref={folderInputRef}
        type="file"
        accept=".txt"
        className="hidden"
        {...{ webkitdirectory: "", mozdirectory: "" }}
        onChange={(e) => e.target.files && processFiles(e.target.files)}
      />

      {/* Loading indicator */}
      {loading && (
        <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Reading files...
        </div>
      )}

      {/* Result summary */}
      {result && !loading && <InputIngestionSummary result={result} />}
    </div>
  );
}
