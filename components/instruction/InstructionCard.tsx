import { FileText, ChevronRight } from "lucide-react";
import { Instruction } from "./types";

export function InstructionCard({
  instruction,
  isSelected,
  onClick,
}: {
  instruction: Instruction;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-4 border rounded-sm transition-all cursor-pointer ${
        isSelected
          ? "border-blue-500/40 bg-blue-500/5"
          : "border-border bg-card hover:border-blue-500/30"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <span className="font-mono text-sm text-foreground truncate">{instruction.title}</span>
        </div>
        {isSelected && <ChevronRight className="w-4 h-4 text-blue-400 shrink-0" />}
      </div>
      <p className="text-xs text-muted-foreground font-mono mt-1.5 pl-5 line-clamp-2 break-all">
        {instruction.prompt}
      </p>
      <p className="text-[10px] text-muted-foreground/50 font-mono mt-1.5 pl-5">
        {new Date(instruction.createdAt).toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        })}
      </p>
    </button>
  );
}
