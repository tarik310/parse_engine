"use client";

import { useState, useEffect } from "react";
import { Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/shadcn_ui/button";
import { DatasetInput, PaginationInfo } from "./types";
import { InputCard } from "./InputCard";

// refreshKey / datasetSlug changes are handled by the parent via the `key` prop,
// which remounts this component fresh — so no reset logic is needed here.
export function InputList({ datasetSlug }: { datasetSlug: string }) {
  const [inputs, setInputs] = useState<DatasetInput[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [loading, setLoading] = useState(true); // true on fresh mount

  const page = pagination?.page ?? 1;

  // Runs once on mount. All setState calls are inside .then() — never synchronous
  // in the effect body — so the lint rule is satisfied.
  useEffect(() => {
    const controller = new AbortController();

    fetch(`/api/datasets/${datasetSlug}/inputs?page=1&limit=20`, {
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed");
        return res.json();
      })
      .then((data) => {
        setInputs(data.inputs ?? []);
        setPagination(data.pagination ?? null);
        setLoading(false);
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          console.error("Failed to fetch inputs");
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handlePageChange(newPage: number) {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/datasets/${datasetSlug}/inputs?page=${newPage}&limit=20`,
      );
      const data = await res.json();
      if (!res.ok) return;
      setInputs(data.inputs ?? []);
      setPagination(data.pagination ?? null);
    } catch {
      console.error("Failed to fetch inputs");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (inputs.length === 0) {
    return (
      <p className="text-xs text-muted-foreground font-mono py-4">
        No inputs yet. Open Add and choose Manual, Upload, or API to add inputs.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        {inputs.map((input) => (
          <InputCard key={input.id} input={input} />
        ))}
      </div>

      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center gap-2 pt-2">
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => handlePageChange(page - 1)}
              className="size-9 p-0"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= pagination.totalPages}
              onClick={() => handlePageChange(page + 1)}
              className="size-9 p-0"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
          <span className="font-mono text-[11px] text-muted-foreground">
            {pagination.total} inputs · page {pagination.page} of {pagination.totalPages}
          </span>
        </div>
      )}
    </div>
  );
}
