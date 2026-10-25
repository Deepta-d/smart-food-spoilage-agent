import { NextResponse } from "next/server";
import { withUserCookie } from "@/lib/http-user";
import { prisma } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  return withUserCookie(async (userId) => {
    const run = await prisma.ingestionRun.findFirst({ where: { id, userId } });
    if (!run) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    let parsed: unknown = {};
    try {
      parsed = JSON.parse(run.modelOutput || "{}");
    } catch {
      parsed = {};
    }
    return {
      id: run.id,
      type: run.type,
      status: run.status,
      errorMessage: run.errorMessage,
      modelOutput: parsed,
      createdAt: run.createdAt,
    };
  });
}
