import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runExtractionJob } from "@/lib/extractionJobRunner";
import { checkOllamaHealth } from "@/lib/ollamaClient";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  try {
    const { jobId } = await params;

    if (!jobId?.trim()) {
      return NextResponse.json({ error: "Extraction job ID is required." }, { status: 400 });
    }

    const alreadyRunning = await prisma.extractionJob.findFirst({
      where: { isRunning: true },
    });
    if (alreadyRunning) {
      return NextResponse.json(
        {
          error: "Another extraction job is already running. Stop it before starting a new one.",
          runningJobId: alreadyRunning.id,
        },
        { status: 409 },
      );
    }

    const extractionJob = await prisma.extractionJob.findUnique({ where: { id: jobId } });
    if (!extractionJob) {
      return NextResponse.json({ error: "Extraction job not found." }, { status: 404 });
    }

    const instruction = await prisma.instruction.findUnique({
      where: { id: extractionJob.instructionId },
    });
    if (!instruction) {
      return NextResponse.json(
        { error: "The linked instruction was not found. Select a valid instruction before starting the job." },
        { status: 400 },
      );
    }

    const ollamaHealthy = await checkOllamaHealth();
    if (!ollamaHealthy) {
      return NextResponse.json(
        { error: "Ollama is not running or cannot be reached. Please start Ollama and try again." },
        { status: 503 },
      );
    }

    // Clear finishedAt before returning so the SSE endpoint treats this as an active run.
    await prisma.extractionJob.update({
      where: { id: jobId },
      data: { finishedAt: null },
    });

    runExtractionJob(jobId).catch((error) => {
      console.error("❌ Extraction job runner crashed unexpectedly:", error);
    });

    return NextResponse.json(
      {
        message: "Extraction job started successfully.",
        extractionJobId: jobId,
        title: extractionJob.title,
        modelName: extractionJob.modelName,
        instructionTitle: instruction.title,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("❌ Failed to start extraction job:", error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
