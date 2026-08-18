import { useState } from "react";
import { ScrollArea } from "@/components/shadcn_ui/scroll-area";
import { Separator } from "@/components/shadcn_ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/shadcn_ui/tabs";
import { Button } from "@/components/shadcn_ui/button";
import { List, PlusCircle, PenLine, Upload, Code2 } from "lucide-react";
import { Dataset } from "./types";
import { InputList } from "./InputList";
import { UploadInputsForm } from "./UploadInputsForm";
import { ManualInputForm } from "./ManualInputForm";

type InputMethod = "manual" | "upload" | "api";

export function ViewDataset({
  dataset,
  onInputsChanged,
}: {
  dataset: Dataset;
  onInputsChanged: () => void;
}) {
  const [refreshKey, setRefreshKey] = useState(0);
  const [inputMethod, setInputMethod] = useState<InputMethod>("manual");

  function handleInputsAdded() {
    setRefreshKey((k) => k + 1);
    onInputsChanged();
  }

  return (
    <ScrollArea className="flex-1">
      <div className="px-3 py-5 space-y-5">
        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="space-y-1">
          <div className="flex items-baseline gap-2 flex-wrap">
            <h2 className="font-mono text-base font-semibold text-foreground">{dataset.name}</h2>
            <span className="font-mono text-xs text-muted-foreground">
              {dataset.inputCount} {dataset.inputCount === 1 ? "input" : "inputs"}
            </span>
          </div>
          {dataset.description && (
            <p className="font-mono text-xs text-muted-foreground mt-1">{dataset.description}</p>
          )}
        </div>

        <Separator />

        {/* ── Tabs ────────────────────────────────────────────────────── */}
        <Tabs defaultValue="inputs">
          <TabsList className="w-full">
            <TabsTrigger value="inputs" className="flex-1 font-mono text-xs gap-1.5">
              <List className="w-3.5 h-3.5" />
              Inputs ({dataset.inputCount})
            </TabsTrigger>
            <TabsTrigger value="add" className="flex-1 font-mono text-xs gap-1.5">
              <PlusCircle className="w-3.5 h-3.5" />
              Add Inputs
            </TabsTrigger>
          </TabsList>

          {/* ── Inputs tab ──────────────────────────────────────────── */}
          <TabsContent value="inputs" className="mt-3">
            <InputList key={`${dataset.slug}-${refreshKey}`} datasetSlug={dataset.slug} />
          </TabsContent>

          {/* ── Add tab ─────────────────────────────────────────────── */}
          <TabsContent value="add" className="mt-3 space-y-3">
            {/* Method selector */}
            <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
              SELECT INPUT METHOD
            </p>
            <div className="flex gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setInputMethod("manual")}
                className={`rounded-sm flex-1 font-mono text-xs gap-1.5 hover:text-blue-400 hover:bg-blue-400/10 ${
                  inputMethod === "manual"
                    ? "bg-blue-400/10 text-blue-400 border-blue-400"
                    : "text-muted-foreground"
                }`}
              >
                <PenLine className="size-4" />
                Manual
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setInputMethod("upload")}
                className={`rounded-sm flex-1 font-mono text-xs gap-1.5 hover:text-blue-400 hover:bg-blue-400/10 ${
                  inputMethod === "upload"
                    ? "bg-blue-400/10 text-blue-400 border-blue-400"
                    : "text-muted-foreground"
                }`}
              >
                <Upload className="size-4" />
                Upload
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setInputMethod("api")}
                className={`rounded-sm flex-1 font-mono text-xs gap-1.5 hover:text-blue-400 hover:bg-blue-400/10 ${
                  inputMethod === "api"
                    ? "bg-blue-400/10 text-blue-400 border-blue-400"
                    : "text-muted-foreground"
                }`}
              >
                <Code2 className="size-4" />
                API
              </Button>
            </div>

            <Separator />

            {/* Method content */}
            {inputMethod === "manual" && (
              <ManualInputForm datasetId={dataset.id} onAdded={handleInputsAdded} />
            )}

            {inputMethod === "upload" && (
              <UploadInputsForm datasetId={dataset.id} onUploaded={handleInputsAdded} />
            )}

            {inputMethod === "api" && (
              <div className="space-y-1.5">
                <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
                  Programmatic API Endpoint
                </p>
                <code className="block font-mono text-xs text-foreground bg-muted/40 border border-border rounded-sm px-3 py-2 break-all">
                  POST /api/datasets/{dataset.slug}/inputs
                </code>
                <p className="font-mono text-[10px] text-muted-foreground">
                  Body:{" "}
                  <span className="text-foreground">
                    {`{ "inputs": [{ "label": "...", "content": "..." }] }`}
                  </span>
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </ScrollArea>
  );
}
