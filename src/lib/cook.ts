import { prisma } from "./db";
import type { RankedMeal } from "./meal-planner";
import { rescoreAllForUser } from "./inventory-actions";

export async function applyCook(userId: string, suggestionId: string, mealRank: number) {
  const s = await prisma.mealSuggestion.findFirst({ where: { id: suggestionId, userId } });
  if (!s) throw new Error("Suggestion not found");
  const payload = JSON.parse(s.payloadJson) as { meals: RankedMeal[] };
  const meal = payload.meals.find((m) => m.rank === mealRank);
  if (!meal) throw new Error("Meal not found");

  for (const u of meal.ingredients_used) {
    const row = await prisma.inventoryItem.findFirst({
      where: { id: u.inventory_item_id, userId },
    });
    if (!row) continue;
    const next = Math.max(0, row.quantity - u.qty);
    if (next <= 0.0001) {
      await prisma.inventoryItem.delete({ where: { id: row.id } });
    } else {
      await prisma.inventoryItem.update({
        where: { id: row.id },
        data: { quantity: next },
      });
    }
  }
  await rescoreAllForUser(userId);
  return { ok: true, mealTitle: meal.title };
}
