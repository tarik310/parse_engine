"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/shadcn_ui/button";
import { ScrollArea } from "@/components/shadcn_ui/scroll-area";
import { Plus, Loader2 } from "lucide-react";
import { Dataset, RightPanelMode } from "./dataset/types";
import { DatasetCard } from "./dataset/DatasetCard";
import { CreateDatasetForm } from "./dataset/CreateDatasetForm";
import { ViewDataset } from "./dataset/ViewDataset";

function EmptyState() {
  return (
    <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm font-mono">
      ← Select a dataset to view details
    </div>
  );
}

export function DatasetPanel() {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<RightPanelMode>("empty");
  const [loading, setLoading] = useState(true);

  const fetchDatasets = useCallback(async () => {
    try {
      const res = await fetch("/api/datasets");
      const data = await res.json();
      setDatasets(Array.isArray(data) ? data : []);
    } catch {
      console.error("Failed to fetch datasets");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initFetch = async () => {
      await fetchDatasets();
    };
    initFetch();
  }, [fetchDatasets]);

  function handleSelectDataset(id: string) {
    setSelectedId(id);
    setMode("view");
  }

  function handleOpenCreate() {
    setSelectedId(null);
    setMode("create");
  }

  function handleCancelCreate() {
    setMode(selectedId ? "view" : "empty");
  }

  function handleCreated(newDataset: Dataset) {
    setDatasets((prev) => [newDataset, ...prev]);
    setSelectedId(newDataset.id);
    setMode("view");
  }

  // Called after any inputs are added so the input count updates in the card
  function handleInputsChanged() {
    fetchDatasets();
  }

  const selectedDataset = datasets.find((dataset) => dataset.id === selectedId) ?? null;

  return (
    <div className="flex gap-3 h-full">
      {/* ── Left Panel ──────────────────────────────────────────────────────── */}
      <div className="w-1/5 flex flex-col gap-2 min-w-0">
        <div className="flex items-center justify-between shrink-0">
          <Button
            size="sm"
            onClick={handleOpenCreate}
            className="font-mono text-xs gap-1.5 bg-green-600 hover:bg-green-500 text-white"
          >
            <Plus className="w-3.5 h-3.5" />
            New
          </Button>
          <span className="font-mono text-xs text-muted-foreground uppercase tracking-wider">
            {datasets.length} {datasets.length === 1 ? "Dataset" : "Datasets"}
          </span>
        </div>

        <ScrollArea className="flex-1">
          <div className="space-y-2">
            {loading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              </div>
            )}
            {!loading && datasets.length === 0 && (
              <p className="text-center text-xs text-muted-foreground font-mono py-8">
                No datasets yet.
                <br />
                Create your first one.
              </p>
            )}
            {!loading &&
              datasets.map((dataset) => (
                <DatasetCard
                  key={dataset.id}
                  dataset={dataset}
                  isSelected={selectedId === dataset.id}
                  onClick={() => handleSelectDataset(dataset.id)}
                />
              ))}
          </div>
        </ScrollArea>
      </div>

      {/* ── Right Panel ─────────────────────────────────────────────────────── */}
      <div className="flex-1 border border-border rounded-sm bg-card flex flex-col overflow-hidden min-w-0">
        {mode === "empty" && <EmptyState />}

        {mode === "view" && selectedDataset && (
          <ViewDataset dataset={selectedDataset} onInputsChanged={handleInputsChanged} />
        )}

        {mode === "create" && (
          <CreateDatasetForm onCreated={handleCreated} onCancel={handleCancelCreate} />
        )}
      </div>
    </div>
  );
}
