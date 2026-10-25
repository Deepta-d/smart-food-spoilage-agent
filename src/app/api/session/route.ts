import { NextResponse } from "next/server";
import { withUserCookie } from "@/lib/http-user";
import { prisma } from "@/lib/db";
import { rescoreAllForUser, purgeIngestionArtifacts } from "@/lib/inventory-actions";
import { FOOD_CATEGORIES } from "@/lib/taxonomy";

export async function GET() {
  return withUserCookie(async (userId) => {
    await rescoreAllForUser(userId);
    await purgeIngestionArtifacts(userId);
    const [profile, pref, inventory, suggestions] = await Promise.all([
      prisma.userProfile.findUnique({ where: { userId } }),
      prisma.notificationPref.findUnique({ where: { userId } }),
      prisma.inventoryItem.findMany({
        where: { userId },
        orderBy: [{ urgencyScore: "desc" }, { name: "asc" }],
      }),
      prisma.mealSuggestion.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
    ]);
    return {
      userId,
      profile,
      notificationPref: pref,
      inventory,
      suggestionHistory: suggestions.map((s) => ({
        id: s.id,
        createdAt: s.createdAt,
        constraints: s.constraintsJson ? JSON.parse(s.constraintsJson) : null,
        mealCount: (() => {
          try {
            return (JSON.parse(s.payloadJson) as { meals?: unknown[] }).meals?.length ?? 0;
          } catch {
            return 0;
          }
        })(),
      })),
      categories: FOOD_CATEGORIES,
    };
  });
}
