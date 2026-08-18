"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/shadcn_ui/button";
import { ScrollArea } from "@/components/shadcn_ui/scroll-area";
import { Plus, Loader2 } from "lucide-react";
import { Instruction, RightPanelMode } from "./instruction/types";
import { InstructionCard } from "./instruction/InstructionCard";
import { ViewInstruction } from "./instruction/ViewInstruction";
import { CreateInstructionForm } from "./instruction/CreateInstructionForm";

// ── Right Panel: Empty State ──────────────────────────────────────────────────
function EmptyState() {
  return (
    <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm font-mono">
      ← Select an instruction to view details
    </div>
  );
}

// ── Main InstructionPanel ─────────────────────────────────────────────────────
export function InstructionPanel() {
  const [instructions, setInstructions] = useState<Instruction[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<RightPanelMode>("empty");
  const [loading, setLoading] = useState(true);

  const fetchInstructions = useCallback(async () => {
    try {
      const res = await fetch("/api/instructions");
      const data = await res.json();
      setInstructions(data);
    } catch {
      console.error("Failed to fetch instructions");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initFetchInstructions = async () => {
      await fetchInstructions();
    };
    initFetchInstructions();
  }, [fetchInstructions]);

  function handleSelectInstruction(id: string) {
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

  function handleCreated(newInstruction: Instruction) {
    setInstructions((prev) => [newInstruction, ...prev]);
    setSelectedId(newInstruction.id);
    setMode("view");
  }

  const selectedInstruction = instructions.find((instruction) => instruction.id === selectedId) ?? null;

  return (
    <div className="flex gap-3 h-full">
      {/* ── Left Panel — 20% ────────────────────────────────────────────────── */}
      <div className="w-1/5 flex flex-col gap-2 min-w-0">
        {/* Header row */}
        <div className="flex items-center justify-between shrink-0">
          <Button
            size="sm"
            onClick={handleOpenCreate}
            className="font-mono text-xs gap-1.5 bg-green-600 hover:bg-green-500 text-white"
          >
            <Plus className="w-3.5 h-3.5" />
            New Instruction
          </Button>
          <span className="font-mono text-xs text-muted-foreground uppercase tracking-wider">
            {instructions.length} {instructions.length === 1 ? "Instruction" : "Instructions"}
          </span>
        </div>

        {/* Instruction list */}
        <ScrollArea className="flex-1">
          <div className="space-y-2">
            {loading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              </div>
            )}
            {!loading && instructions.length === 0 && (
              <p className="text-center text-xs text-muted-foreground font-mono py-8">
                No instructions yet.
                <br />
                Create your first one.
              </p>
            )}
            {!loading &&
              instructions.map((instruction) => (
                <InstructionCard
                  key={instruction.id}
                  instruction={instruction}
                  isSelected={selectedId === instruction.id}
                  onClick={() => handleSelectInstruction(instruction.id)}
                />
              ))}
          </div>
        </ScrollArea>
      </div>

      {/* ── Right Panel — 75% ───────────────────────────────────────────────── */}
      <div className="flex-1 border border-border rounded-sm bg-card flex flex-col overflow-hidden min-w-0">
        {mode === "empty" && <EmptyState />}
        {mode === "view" && selectedInstruction && (
          <ViewInstruction instruction={selectedInstruction} />
        )}
        {mode === "create" && (
          <CreateInstructionForm onCreated={handleCreated} onCancel={handleCancelCreate} />
        )}
      </div>
    </div>
  );
}
