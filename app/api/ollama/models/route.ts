import { NextResponse } from "next/server";

export interface OllamaModel {
  name: string;
  supportsThinking: boolean;
  // gpt-oss uses string levels instead of boolean for think
  thinkType: "boolean" | "level";
}

export async function GET() {
  try {
    // ── STEP 1: Get list of installed models ──────────────────────────────────
    const tagsRes = await fetch(  process.env.OLLAMA_URL + "/api/tags", {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!tagsRes.ok) {
      return NextResponse.json(
        { error: "Failed to reach Ollama. Make sure Ollama is running." },
        { status: 503 },
      );
    }

    const tagsData = await tagsRes.json();
    const modelList: { name: string }[] = tagsData.models ?? [];

    // ── STEP 2: For each model, fetch capabilities via /api/show ──────────────
    // We check if the model's capabilities array includes "thinking"
    const models: OllamaModel[] = await Promise.all(
      modelList.map(async (m) => {
        try {
          const showRes = await fetch( process.env.OLLAMA_URL + "/api/show", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ model: m.name }),
            signal: AbortSignal.timeout(5_000),
          });

          if (!showRes.ok) {
            return {
              name: m.name,
              supportsThinking: false,
              thinkType: "boolean" as const,
            };
          }

          const showData = await showRes.json();
          const capabilities: string[] = showData.capabilities ?? [];
          const supportsThinking = capabilities.includes("thinking");

          // gpt-oss requires string levels ("low"/"medium"/"high") not boolean
          const thinkType = m.name.startsWith("gpt-oss") ? "level" : "boolean";

          return {
            name: m.name,
            supportsThinking,
            thinkType: thinkType as "boolean" | "level",
          };
        } catch {
          // If /api/show fails for a model, return it without thinking support
          return {
            name: m.name,
            supportsThinking: false,
            thinkType: "boolean" as const,
          };
        }
      }),
    );

    return NextResponse.json({ models }, { status: 200 });
  } catch {
    return NextResponse.json(
      {
        error: "Could not connect to Ollama.",
      },
      { status: 503 },
    );
  }
}
