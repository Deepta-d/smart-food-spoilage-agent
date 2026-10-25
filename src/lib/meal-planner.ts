import type { InventoryItem } from "@prisma/client";
import type { MealDraft } from "./llm";
import { NON_VEG_KEYWORDS, VEGAN_FORBIDDEN, VegetarianMode } from "./taxonomy";
import { generateMealDrafts } from "./llm";
import { prisma } from "./db";

const W_SPOIL = 1;
const W_TIME = 0.35;
const W_ENERGY = 0.25;
const MULTI_URGENT_BONUS = 4;

export type RankedMeal = {
  rank: number;
  title: string;
  minutes: number;
  energy: number;
  ingredients_used: { inventory_item_id: string; qty: number; name: string }[];
  steps: string[];
  optional_adds: string[];
  score: number;
  spoilage_value: number;
  rationale: string;
};

function containsNonVeg(text: string) {
  const t = text.toLowerCase();
  return NON_VEG_KEYWORDS.some((k) => t.includes(k));
}

function violatesVegan(text: string) {
  const t = text.toLowerCase();
  return VEGAN_FORBIDDEN.some((k) => new RegExp(`\\b${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(t));
}

export function verifyMeal(
  meal: MealDraft,
  invById: Map<string, InventoryItem>,
  mode: VegetarianMode,
  maxMinutes: number,
  maxEnergy: number,
): { ok: true } | { ok: false; reason: string } {
  const blob = [meal.title, ...meal.steps, ...(meal.optional_adds ?? [])].join(" ");
  if (containsNonVeg(blob)) return { ok: false, reason: "non_veg_keyword" };
  if (mode === "vegan" && violatesVegan(blob)) return { ok: false, reason: "vegan_forbidden" };

  if (meal.minutes > maxMinutes) return { ok: false, reason: "time" };
  if (meal.energy > maxEnergy) return { ok: false, reason: "energy" };

  if (invById.size > 0 && meal.ingredients_used.length === 0) {
    return { ok: false, reason: "no_inventory_use" };
  }

  for (const u of meal.ingredients_used) {
    const row = invById.get(u.inventory_item_id);
    if (!row) return { ok: false, reason: "unknown_item" };
    if (mode === "vegan") {
      const animalish = new Set([
        "milk_dairy",
        "eggs",
        "soft_cheese",
        "hard_cheese",
        "butter",
        "yogurt",
        "paneer",
      ]);
      if (animalish.has(row.categoryId)) return { ok: false, reason: "vegan_dairy" };
    }
    const rowBlob = `${row.name} ${row.normalizedName}`;
    if (containsNonVeg(rowBlob)) return { ok: false, reason: "non_veg_item" };
    if (mode === "vegan" && violatesVegan(rowBlob)) return { ok: false, reason: "vegan_item" };
    if (u.qty > row.quantity + 1e-6) return { ok: false, reason: "qty" };
  }
  return { ok: true };
}

export function scoreMeal(
  meal: MealDraft,
  invById: Map<string, InventoryItem>,
  maxMinutes: number,
  maxEnergy: number,
): { score: number; spoilage_value: number; rationale: string } {
  const urgencies = meal.ingredients_used.map((u) => invById.get(u.inventory_item_id)?.urgencyScore ?? 0);
  const sumU = urgencies.reduce((a, b) => a + b, 0);
  const urgentCount = urgencies.filter((u) => u >= 55).length;
  const spoilageValue = sumU + MULTI_URGENT_BONUS * urgentCount;
  const timePenalty = meal.minutes / Math.max(1, maxMinutes);
  const energyPenalty = meal.energy / Math.max(1, maxEnergy);
  const score = W_SPOIL * spoilageValue - W_TIME * 100 * timePenalty - W_ENERGY * 100 * energyPenalty;
  const topNames = meal.ingredients_used
    .map((u) => invById.get(u.inventory_item_id)?.name)
    .filter(Boolean)
    .slice(0, 3);
  const rationale = `Uses ${topNames.join(", ") || "staples"} (urgency-weighted ${spoilageValue.toFixed(1)}).`;
  return { score, spoilage_value: spoilageValue, rationale };
}

export async function planTonight(args: {
  userId: string;
  maxMinutes?: number;
  energy?: number;
  vegetarianMode?: VegetarianMode;
  /** When false, do not write MealSuggestion (e.g. digest preview) */
  persistSuggestion?: boolean;
}) {
  const profile = await prisma.userProfile.findUnique({ where: { userId: args.userId } });
  const maxMinutes = args.maxMinutes ?? profile?.defaultMinutes ?? 45;
  const energy = args.energy ?? profile?.defaultEnergy ?? 2;
  const mode = (args.vegetarianMode ?? profile?.vegetarianMode ?? "lacto_ovo") as VegetarianMode;
  let staples: string[] = [];
  try {
    staples = JSON.parse(profile?.stapleItemsJson ?? "[]") as string[];
  } catch {
    staples = [];
  }

  const items = await prisma.inventoryItem.findMany({
    where: { userId: args.userId },
    orderBy: [{ urgencyScore: "desc" }, { acquiredAt: "asc" }],
  });
  const invById = new Map(items.map((i) => [i.id, i]));
  const top = items.filter((i) => !i.frozen).slice(0, 14);
  const inventoryLines = top.map((i) => ({
    id: i.id,
    name: i.name,
    urgency: i.urgencyScore,
    categoryId: i.categoryId,
  }));

  const drafts = await generateMealDrafts({
    inventoryLines,
    staples,
    vegetarianMode: mode,
    maxMinutes,
    targetEnergy: energy,
  });

  const ranked: RankedMeal[] = [];
  let r = 1;
  for (const d of drafts) {
    const v = verifyMeal(d, invById, mode, maxMinutes, energy);
    if (!v.ok) continue;
    const { score, spoilage_value, rationale } = scoreMeal(d, invById, maxMinutes, energy);
    ranked.push({
      rank: r++,
      title: d.title,
      minutes: d.minutes,
      energy: d.energy,
      ingredients_used: d.ingredients_used.map((u) => ({
        inventory_item_id: u.inventory_item_id,
        qty: u.qty,
        name: invById.get(u.inventory_item_id)?.name ?? "",
      })),
      steps: d.steps,
      optional_adds: d.optional_adds ?? [],
      score,
      spoilage_value,
      rationale,
    });
  }

  ranked.sort((a, b) => b.score - a.score);
  const topMeals = ranked.slice(0, 5).map((m, i) => ({ ...m, rank: i + 1 }));

  if (args.persistSuggestion === false) {
    return { suggestionId: "", meals: topMeals };
  }

  const suggestion = await prisma.mealSuggestion.create({
    data: {
      userId: args.userId,
      payloadJson: JSON.stringify({ meals: topMeals }),
      constraintsJson: JSON.stringify({ maxMinutes, energy, vegetarianMode: mode }),
    },
  });

  return { suggestionId: suggestion.id, meals: topMeals };
}
