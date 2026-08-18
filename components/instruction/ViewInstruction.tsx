import { ScrollArea } from "@/components/shadcn_ui/scroll-area";
import { schemaToSimplePreview } from "./SchemaBuilder";
import { Instruction } from "./types";

export function ViewInstruction({ instruction }: { instruction: Instruction }) {
  return (
    <>
      <div className="px-3 py-5 border-b border-border shrink-0">
        <h2 className="font-mono text-base font-semibold text-foreground">{instruction.title}</h2>
        <p className="text-xs text-muted-foreground font-mono mt-1">
          Created:{" "}
          {new Date(instruction.createdAt).toLocaleString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>

      <ScrollArea className="flex-1 p-5">
        <div className="space-y-5">
          {/* Prompt template */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                PROMPT TEMPLATE
              </span>
            </div>
            <pre className="h-150 overflow-auto font-mono text-xs text-foreground whitespace-pre-wrap leading-relaxed bg-muted/30 rounded-sm p-3 border border-border">
              {instruction.prompt}
            </pre>
            <p className="text-[10px] text-muted-foreground/60 font-mono">
              <code className="text-blue-400">{"{INPUT_TEXT}"}</code> specifies where the input content
              should be inserted. If omitted, the input is appended to the end of the prompt automatically.
            </p>
          </div>

          {/* Output Schema */}
          {instruction.outputSchema && (
            <div className="flex-1 rounded-md border border-border overflow-hidden flex flex-col">
              {/* Title bar */}
              <div className="bg-muted/60 border-b border-border px-3 py-2 flex items-center gap-2 shrink-0">
                <span className="size-2.5 rounded-full bg-red-400/70" />
                <span className="size-2.5 rounded-full bg-yellow-400/70" />
                <span className="size-2.5 rounded-full bg-green-400/70" />
                <span className="ml-2 font-mono text-[10px] text-muted-foreground/50 uppercase tracking-wider">
                  Output Schema
                </span>
              </div>
              {/* Code body */}
              <pre className="bg-preview-window flex-1 font-mono text-[11px] p-3 text-muted-foreground overflow-auto whitespace-pre leading-relaxed">
                {JSON.stringify(schemaToSimplePreview(instruction.outputSchema!), null, 2)}
              </pre>
            </div>
          )}
        </div>
      </ScrollArea>
    </>
  );
}
