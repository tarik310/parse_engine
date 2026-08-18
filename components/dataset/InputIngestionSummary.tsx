import { CheckCircle2, SkipForward } from "lucide-react";
import { Separator } from "@/components/shadcn_ui/separator";
import { InputIngestionResult } from "./types";

export function InputIngestionSummary({ result }: { result: InputIngestionResult }) {
  return (
    <div className="space-y-3">
      {/* ── Counts row ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4">
        <span className="flex items-center gap-1.5 font-mono text-xs text-emerald-400">
          <CheckCircle2 className="w-3.5 h-3.5" />
          {result.added} added
        </span>
        {result.skipped > 0 && (
          <span className="flex items-center gap-1.5 font-mono text-xs text-amber-400">
            <SkipForward className="w-3.5 h-3.5" />
            {result.skipped} skipped
          </span>
        )}
      </div>

      {/* ── Duplicates detail ────────────────────────────────────────────── */}
      {result.duplicates.length > 0 && (
        <>
          <Separator />
          <div className="space-y-2">
            <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
              Skipped — duplicates
            </p>
            <div className="space-y-1.5">
              {result.duplicates.map((d, i) => (
                <div
                  key={i}
                  className="border border-amber-500/20 bg-amber-500/5 rounded-sm p-2 space-y-0.5"
                >
                  <div className="flex items-baseline gap-1.5 min-w-0">
                    <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider shrink-0">
                      Submitted:
                    </span>
                    <span className="font-mono text-xs text-foreground truncate">
                      {d.submittedLabel}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-1.5 min-w-0">
                    <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider shrink-0">
                      Existing:
                    </span>
                    <span className="font-mono text-xs text-foreground truncate">
                      {d.existingLabel}
                    </span>
                  </div>
                  <p className="font-mono text-[10px] text-amber-400/80">
                    {d.reason === "duplicate_content"
                      ? "Same content already exists in this dataset"
                      : "Same label already exists in this dataset"}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
