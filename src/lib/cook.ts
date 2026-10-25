import { prisma } from "./db";
import type { RankedMeal } from "./meal-planner";
import { rescoreAllForUser } from "./inventory-actions";

export async function applyCook(userId: string, suggestionId: string, mealRank: number) {
  const s = await prisma.mealSuggestion.findFirst({ where: { id: suggestionId, userId } });
  if (!s) throw new Error("Suggestion not found");
  const payload = JSON.parse(s.payloadJson) as { meals: RankedMeal[] };
  const meal = payload.meals.find((m) => m.rank === mealRank);
  if (!meal) throw new Error("Meal not found");

  // Combine repeated uses of the same item so it is deducted once, in total.
  const totals = new Map<string, number>();
  for (const u of meal.ingredients_used) {
    totals.set(u.inventory_item_id, (totals.get(u.inventory_item_id) ?? 0) + u.qty);
  }

  // Deduct every ingredient in one transaction: either the whole meal is
  // applied to the inventory, or (if anything fails) nothing changes.
  await prisma.$transaction(async (tx) => {
    for (const [itemId, qty] of totals) {
      const row = await tx.inventoryItem.findFirst({ where: { id: itemId, userId } });
      if (!row) continue; // already used up or removed since the meal was suggested
      const next = Math.max(0, row.quantity - qty);
      if (next <= 0.0001) {
        await tx.inventoryItem.delete({ where: { id: row.id } });
      } else {
        await tx.inventoryItem.update({ where: { id: row.id }, data: { quantity: next } });
      }
    }
  });

  await rescoreAllForUser(userId);
  return { ok: true, mealTitle: meal.title };
}
