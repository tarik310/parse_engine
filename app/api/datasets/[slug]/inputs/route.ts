import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const DEFAULT_PAGE_SIZE = 20;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    const dataset = await prisma.dataset.findUnique({ where: { slug } });

    if (!dataset) {
      return NextResponse.json({ error: "Dataset not found." }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("limit") ?? String(DEFAULT_PAGE_SIZE), 10)),
    );
    const skip = (page - 1) * limit;

    const [inputs, total] = await Promise.all([
      prisma.datasetInput.findMany({
        where: { datasetId: dataset.id },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        select: {
          id: true,
          datasetId: true,
          label: true,
          contentHash: true,
          ingestionMethod: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.datasetInput.count({ where: { datasetId: dataset.id } }),
    ]);

    return NextResponse.json(
      {
        inputs: inputs,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("❌ Failed to fetch dataset inputs:", error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

/**
 * Programmatic endpoint for adding inputs through a dataset slug.
 * The ingestion method is always "api" for this route.
 *
 * Body:
 * {
 *   inputs: [{ label: string, content: string }]
 * }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    const body = await req.json();
    const { inputs } = body;

    if (!Array.isArray(inputs) || inputs.length === 0) {
      return NextResponse.json({ error: "inputs must be a non-empty array." }, { status: 400 });
    }

    const dataset = await prisma.dataset.findUnique({ where: { slug } });
    if (!dataset) {
      return NextResponse.json(
        { error: `Dataset with slug "${slug}" not found.` },
        { status: 404 },
      );
    }

    const ingestionResponse = await fetch(new URL("/api/dataset-inputs", req.url).toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        datasetId: dataset.id,
        ingestionMethod: "api",
        inputs,
      }),
    });

    const result = await ingestionResponse.json();
    return NextResponse.json(result, { status: ingestionResponse.status });
  } catch (error) {
    console.error("❌ Failed to add inputs through dataset slug:", error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
