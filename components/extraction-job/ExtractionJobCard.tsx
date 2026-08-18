import { Cpu, ChevronRight } from "lucide-react";
import { ExtractionJob } from "./types";
import { getJobStatus } from "./utils";
import { StatusBadge } from "./StatusBadge";

export function ExtractionJobCard({
  job,
  isSelected,
  onClick,
}: {
  job: ExtractionJob;
  isSelected: boolean;
  onClick: () => void;
}) {
  const instructionTitle = job.instruction.title;
  const status = getJobStatus(job);
  const total = job.totalInputCount;
  const successPercent =
    total > 0 ? Math.min(100, Math.round((job.successfulResultCount / total) * 100)) : 0;
  const failurePercent = total > 0 ? Math.min(100, Math.round((job.failedResultCount / total) * 100)) : 0;

  return (
    <button
      onClick={isSelected ? undefined : onClick}
      className={`w-full text-left p-3 border rounded-sm transition-all cursor-pointer ${
        isSelected
          ? "border-blue-500/40 bg-blue-500/5"
          : "border-border bg-card hover:border-blue-500/30"
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <Cpu className="size-4 text-muted-foreground shrink-0 mt-0.5" />
          <span className="font-mono text-sm text-foreground line-clamp-2 leading-tight">
            {job.title}
          </span>
        </div>
        {isSelected && <ChevronRight className="size-4 text-blue-400 shrink-0 mt-0.5" />}
      </div>
      <div className="pl-5 space-y-1.5">
        <div className="text-[11px] text-muted-foreground font-mono flex gap-2 items-center">
          <StatusBadge status={status} />
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">{successPercent + failurePercent}%</span>
            <span className="text-muted-foreground">
              ({job.failedResultCount + job.successfulResultCount}/{total})
            </span>
          </div>
        </div>

        <div className="text-[11px] text-muted-foreground font-mono space-y-0.5 mt-1">
          <div>
            Model: <span className="text-foreground">{job.modelName}</span>
          </div>
          <div>
            Instruction: <span className="text-foreground">{instructionTitle}</span>
          </div>
        </div>
      </div>
    </button>
  );
}
