"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/shadcn_ui/input";
import { ScrollArea } from "@/components/shadcn_ui/scroll-area";
import { Separator } from "@/components/shadcn_ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/shadcn_ui/sheet";
import { Facet, FilterState } from "./filterUtils";

export function FilterSheet({
  open,
  onOpenChange,
  facets,
  activeFilters,
  onToggleValue,
  onClearAll,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  facets: Facet[];
  activeFilters: FilterState;
  onToggleValue: (key: string, value: string) => void;
  onClearAll: () => void;
}) {
  const [keySearchQueries, setKeySearchQueries] = useState<Record<string, string>>({});

  function displayKey(key: string): string {
    const parts = key.split(".");
    return parts.map((p) => p.replace(/_/g, " ")).join(" › ");
  }

  function displayValue(val: string): string {
    try {
      const u = new URL(val);
      if (u.protocol === "http:" || u.protocol === "https:") {
        return u.hostname.replace(/^www\./, "");
      }
    } catch {}
    return val;
  }

  const activeFilterCount = Object.values(activeFilters).filter((v) => v.length > 0).length;

  function handleSearchChange(key: string, value: string) {
    setKeySearchQueries((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" aria-describedby={undefined} className="w-full sm:max-w-full p-0 flex flex-col gap-0">
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <SheetHeader className="px-4 pt-4 pb-3 shrink-0">
          <SheetTitle className="font-mono text-sm uppercase tracking-wider">
            Filter Results
          </SheetTitle>
          {activeFilterCount > 0 ? (
            <div className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
              <span className="text-blue-400 font-semibold">
                {activeFilterCount} {activeFilterCount === 1 ? "filter" : "filters"} active
              </span>
              <span>·</span>
              <button
                onClick={onClearAll}
                className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer underline underline-offset-2"
              >
                Clear all
              </button>
            </div>
          ) : (
            <p className="font-mono text-[11px] text-muted-foreground">No filters active</p>
          )}
        </SheetHeader>

        <Separator />

        {/* ── Facet list ───────────────────────────────────────────────────── */}
        {facets.length === 0 ? (
          <div className="flex-1 flex items-center justify-center px-4">
            <p className="font-mono text-xs text-muted-foreground text-center">
              No filterable result data yet.
              <br />
              Run the extraction job to generate filterable results.
            </p>
          </div>
        ) : (
          <ScrollArea className="flex-1 min-h-0">
            <div className="px-4 py-3 space-y-5">
              {facets.map((facet, i) => {
                const selectedValues = activeFilters[facet.key] ?? [];
                const rawQuery = keySearchQueries[facet.key] ?? "";
                const query = rawQuery.trim().toLowerCase();

                // Search filters ALL values — checked and unchecked alike
                const visibleValues = query
                  ? facet.values.filter(({ value }) => value.toLowerCase().includes(query))
                  : facet.values;

                return (
                  <div key={facet.key}>
                    {/* ── Key header ───────────────────────────────────── */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {selectedValues.length > 0 && (
                          <span className="w-0.5 h-3 rounded-full bg-blue-500 shrink-0" />
                        )}
                        <span
                          className={`font-mono text-[10px] font-semibold uppercase tracking-widest ${
                            selectedValues.length > 0 ? "text-blue-400" : "text-muted-foreground"
                          }`}
                        >
                          {displayKey(facet.key)}
                        </span>
                      </div>
                      <span
                        className={`font-mono text-[10px] shrink-0 ${
                          selectedValues.length > 0
                            ? "text-blue-400/70"
                            : "text-muted-foreground/60"
                        }`}
                      >
                        {selectedValues.length > 0
                          ? `${selectedValues.length}/${facet.totalResults}`
                          : facet.totalResults}
                      </span>
                    </div>

                    {/* ── Search input + value count ────────────────────── */}
                    <div className="relative flex items-center gap-2 mb-2">
                      <div className="relative flex-1">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
                        <Input
                          value={rawQuery}
                          onChange={(e) => handleSearchChange(facet.key, e.target.value)}
                          placeholder="Search values..."
                          className="pl-6 pr-16 text-[10px] placeholder:text-[10px] font-mono rounded-sm border-muted-foreground/20"
                        />
                      </div>
                      <span className="absolute right-2 font-mono text-[10px] text-muted-foreground/60 shrink-0">
                        {`${visibleValues.length} ${visibleValues.length === 1 ? "value" : "values"}`}
                      </span>
                    </div>

                    {/* ── Value rows ───────────────────────────────────── */}
                    <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                      {visibleValues.length === 0 ? (
                        <p className="font-mono text-[10px] text-muted-foreground/60 px-2 py-1">
                          No matches
                        </p>
                      ) : (
                        visibleValues.map(({ value, count }) => {
                          const isChecked = selectedValues.includes(value);
                          return (
                            <button
                              key={value}
                              onClick={() => onToggleValue(facet.key, value)}
                              className={`w-full flex items-center gap-2 overflow-hidden px-2 py-1 rounded-sm text-left transition-colors cursor-pointer ${
                                isChecked
                                  ? "bg-blue-500/10 text-foreground"
                                  : "hover:bg-muted/60 text-muted-foreground hover:text-foreground"
                              }`}
                            >
                              <div className="flex items-start gap-2 flex-1 min-w-0">
                                {/* Checkbox indicator */}
                                <span
                                  className={`size-3 shrink-0 rounded-xs border flex items-center justify-center transition-colors ${
                                    isChecked
                                      ? "bg-blue-500 border-blue-500"
                                      : "border-muted-foreground/40"
                                  }`}
                                >
                                  {isChecked && (
                                    <svg
                                      className="size-2 text-white"
                                      viewBox="0 0 8 8"
                                      fill="none"
                                    >
                                      <path
                                        d="M1 4l2 2 4-4"
                                        stroke="currentColor"
                                        strokeWidth="1.5"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                      />
                                    </svg>
                                  )}
                                </span>
                                <span className="font-mono text-[11px] break-all">{displayValue(value)}</span>
                              </div>
                              <span className="font-mono text-[10px] text-muted-foreground/60 shrink-0">
                                {count}
                              </span>
                            </button>
                          );
                        })
                      )}
                    </div>

                    {i < facets.length - 1 && <Separator className="mt-4" />}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </SheetContent>
    </Sheet>
  );
}
