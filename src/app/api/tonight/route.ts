import { NextResponse } from "next/server";
import { withUserCookie } from "@/lib/http-user";
import { planTonight } from "@/lib/meal-planner";
import type { VegetarianMode } from "@/lib/taxonomy";

export async function POST(req: Request) {
  return withUserCookie(async (userId) => {
    const body = (await req.json().catch(() => ({}))) as {
      maxMinutes?: number;
      energy?: number;
      vegetarianMode?: VegetarianMode;
    };
    const out = await planTonight({
      userId,
      maxMinutes: body.maxMinutes,
      energy: body.energy,
      vegetarianMode: body.vegetarianMode,
      persistSuggestion: true,
    });
    return out;
  });
}
