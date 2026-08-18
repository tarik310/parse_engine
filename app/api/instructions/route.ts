import { NextRequest, NextResponse } from "next/server";
import { prisma, Prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const instructions = await prisma.instruction.findMany({
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(instructions, { status: 200 });
  } catch (error) {
    console.error("❌ Failed to fetch instructions:", error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, prompt, outputSchema } = body;

    if (!title?.trim()) {
      return NextResponse.json({ error: "Instruction title is required." }, { status: 400 });
    }

    if (!prompt?.trim()) {
      return NextResponse.json({ error: "Prompt template is required." }, { status: 400 });
    }

    if (
      outputSchema !== undefined &&
      outputSchema !== null &&
      (typeof outputSchema !== "object" || Array.isArray(outputSchema))
    ) {
      return NextResponse.json(
        { error: "outputSchema must be a JSON object." },
        { status: 400 },
      );
    }

    const created = await prisma.instruction.create({
      data: {
        title: title.trim(),
        prompt: prompt.trim(),
        outputSchema:
          outputSchema != null
            ? (outputSchema as unknown as Prisma.InputJsonObject)
            : Prisma.DbNull,
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("❌ Failed to create instruction:", error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
