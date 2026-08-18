import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toUsageMetrics } from "@/lib/prismaHelpers";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  try {
    const { jobId } = await params;

    const extractionJob = await prisma.extractionJob.findUnique({ where: { id: jobId } });
    if (!extractionJob) {
      return NextResponse.json({ error: "Extraction job not found." }, { status: 404 });
    }

    const [rawSuccessfulResults, rawFailedResults] = await Promise.all([
      prisma.extractionResult.findMany({
        where: { extractionJobId: jobId, status: "success" },
        orderBy: { createdAt: "desc" },
      }),
      prisma.extractionResult.findMany({
        where: { extractionJobId: jobId, status: "failed" },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const shapeResult = (result: (typeof rawSuccessfulResults)[number]) => {
      const {
        totalDuration,
        loadDuration,
        promptEvalCount,
        promptEvalDuration,
        evalCount,
        evalDuration,
        ...rest
      } = result;

      return {
        ...rest,
        usageMetrics: toUsageMetrics({
          totalDuration,
          loadDuration,
          promptEvalCount,
          promptEvalDuration,
          evalCount,
          evalDuration,
        }),
      };
    };

    const successfulResults = rawSuccessfulResults.map(shapeResult);
    const failedResults = rawFailedResults.map(shapeResult);

    return NextResponse.json(
      {
        extractionJobId: jobId,
        successfulResultCount: successfulResults.length,
        failedResultCount: failedResults.length,
        successfulResults,
        failedResults,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("❌ Failed to fetch extraction results:", error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
