import { NextResponse } from "next/server";
import { withUserCookie } from "@/lib/http-user";
import { applyCook } from "@/lib/cook";

export async function POST(req: Request) {
  return withUserCookie(async (userId) => {
    const body = (await req.json()) as { suggestionId?: string; mealRank?: number };
    const suggestionId = String(body.suggestionId ?? "");
    const mealRank = typeof body.mealRank === "number" ? body.mealRank : NaN;
    if (!suggestionId || !Number.isFinite(mealRank)) {
      return NextResponse.json({ error: "suggestionId and mealRank required" }, { status: 400 });
    }
    try {
      const result = await applyCook(userId, suggestionId, mealRank);
      return result;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "cook failed";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
  });
}
