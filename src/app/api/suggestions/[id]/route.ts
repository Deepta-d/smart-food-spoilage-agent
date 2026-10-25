import { NextResponse } from "next/server";
import { withUserCookie } from "@/lib/http-user";
import { prisma } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  return withUserCookie(async (userId) => {
    const s = await prisma.mealSuggestion.findFirst({ where: { id, userId } });
    if (!s) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    let payload: unknown = {};
    try {
      payload = JSON.parse(s.payloadJson);
    } catch {
      payload = {};
    }
    let constraints: unknown = null;
    if (s.constraintsJson) {
      try {
        constraints = JSON.parse(s.constraintsJson);
      } catch {
        constraints = null;
      }
    }
    return { id: s.id, createdAt: s.createdAt, payload, constraints };
  });
}
