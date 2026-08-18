import { Badge } from "@/components/shadcn_ui/badge";
import { Loader2, CheckCircle2, Circle } from "lucide-react";
import { JobStatus } from "./types";

export function StatusBadge({ status }: { status: JobStatus }) {
  switch (status) {
    case "running":
      return (
        <Badge className="gap-1.5 font-mono text-xs bg-blue-500/10 text-blue-400 border-blue-500/30">
          <Loader2 className="size-3 animate-spin" />
          Running
        </Badge>
      );
    case "completed":
      return (
        <Badge className="gap-1.5 font-mono text-xs bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
          <CheckCircle2 className="size-3" />
          Completed
        </Badge>
      );
    default: // pending
      return (
        <Badge
          variant="outline"
          className="gap-1.5 font-mono text-xs text-amber-400 border-amber-500/30"
        >
          <Circle className="size-3" />
          Pending
        </Badge>
      );
  }
}
