import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;

    const dataset = await prisma.dataset.findUnique({ where: { slug } });

    if (!dataset) {
      return NextResponse.json({ error: "Dataset not found." }, { status: 404 });
    }

    const inputCount = await prisma.datasetInput.count({
      where: { datasetId: dataset.id },
    });

    return NextResponse.json({ ...dataset, inputCount }, { status: 200 });
  } catch (error) {
    console.error("❌ Failed to fetch dataset:", error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
