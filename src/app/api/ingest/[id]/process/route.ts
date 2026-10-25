import { NextResponse } from "next/server";
import { withUserCookie } from "@/lib/http-user";
import { processIngestionRun } from "@/lib/ingestion";
import { prisma } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Params) {
  const { id } = await params;
  return withUserCookie(async (userId) => {
    try {
      await processIngestionRun(id, userId);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "process failed";
      return NextResponse.json({ error: msg }, { status: 500 });
    }
    const run = await prisma.ingestionRun.findFirst({ where: { id, userId } });
    return { id, status: run?.status, modelOutput: run?.modelOutput ? JSON.parse(run.modelOutput) : {} };
  });
}
