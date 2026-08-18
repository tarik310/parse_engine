export interface Instruction {
  id: string;
  title: string;
  prompt: string;
  outputSchema: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export type RightPanelMode = "empty" | "view" | "create";
