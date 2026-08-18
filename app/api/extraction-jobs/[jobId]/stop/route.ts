import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requestExtractionJobStop } from "@/lib/extractionJobRunner";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  try {
    const { jobId } = await params;

    if (!jobId?.trim()) {
      return NextResponse.json({ error: "Extraction job ID is required." }, { status: 400 });
    }

    const extractionJob = await prisma.extractionJob.findUnique({ where: { id: jobId } });
    if (!extractionJob) {
      return NextResponse.json({ error: "Extraction job not found." }, { status: 404 });
    }

    if (!extractionJob.isRunning) {
      return NextResponse.json(
        { error: "Extraction job is not currently running." },
        { status: 400 },
      );
    }

    requestExtractionJobStop(jobId);

    await prisma.extractionJob.update({
      where: { id: jobId },
      data: { isRunning: false },
    });

    return NextResponse.json(
      {
        message: "Stop requested. The current extraction will be canceled.",
        extractionJobId: jobId,
        title: extractionJob.title,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("❌ Failed to stop extraction job:", error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
