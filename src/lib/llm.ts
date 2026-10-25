import OpenAI from "openai";
import { guessCategoryFromText, normalizeName } from "./taxonomy";

const MAX_B64 = 2_400_000; // ~1.8MB binary as base64 guard

export type FridgeCandidate = {
  name: string;
  confidence: number;
  estimated_category_id: string;
};

export type ReceiptLine = {
  raw_line: string;
  name: string;
  quantity: number;
  unit: string;
  estimated_category_id: string;
  confidence: number;
};

/**
 * Results from the AI helpers. `sample` is true when no OPENAI_API_KEY is set
 * and built-in demo data was returned instead of a real AI response, so the
 * UI can label it clearly rather than presenting it as real.
 */
export type AiResult<T> = { data: T; sample: boolean };

/** Thrown when the AI responds but its output cannot be used. */
export class AiOutputError extends Error {
  constructor(what: string) {
    super(`The AI returned an unreadable ${what}. Please try again.`);
    this.name = "AiOutputError";
  }
}

function parseJsonObject(text: string, what: string): Record<string, unknown> {
  const cleaned = text.replace(/```json\n?|```/g, "").trim();
  try {
    const parsed: unknown = JSON.parse(cleaned);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // fall through
  }
  throw new AiOutputError(what);
}

function client() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  return new OpenAI({ apiKey: key });
}

export function assertImageSize(base64: string) {
  if (base64.length > MAX_B64) {
    throw new Error("Image too large; try a smaller photo (under ~1.8MB).");
  }
}

export async function visionExtractFridge(
  imageBase64: string,
  mimeType: string,
): Promise<AiResult<FridgeCandidate[]>> {
  const openai = client();
  if (!openai) {
    return { data: mockFridge(), sample: true };
  }
  const res = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `List visible food ingredients in this fridge/pantry photo. Return JSON only: {"items":[{"name":string,"confidence":0-1,"estimated_category_id":string}]}. 
Use one of these category ids when possible: leafy_greens, herbs_fresh, salad_mix, spinach, broccoli, cabbage, tomatoes, cucumber, peppers, mushrooms, root_veg, potato, onion_garlic, beans_fresh, corn_fresh, asparagus, berries, citrus, stone_fruit, apple_pear, cut_fruit, avocado, tofu_tempeh, seitan, paneer, milk_dairy, yogurt, hard_cheese, soft_cheese, butter, eggs, cooked_grains, dry_grains, cooked_legumes, canned_opened, bread, tortillas, pasta_sauce, plant_milk, hummus_dips, prepared_salad, other.
Vegetarian only; do not list meat/fish.`,
          },
          { type: "image_url", image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
        ],
      },
    ],
    max_tokens: 1200,
    response_format: { type: "json_object" },
  });
  const text = res.choices[0]?.message?.content ?? "";
  return { data: parseFridgeJson(text), sample: false };
}

export async function visionExtractReceipt(
  imageBase64: string,
  mimeType: string,
): Promise<AiResult<ReceiptLine[]>> {
  const openai = client();
  if (!openai) {
    return { data: mockReceipt(), sample: true };
  }
  const res = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Read this grocery receipt. Return JSON only: {"lines":[{"raw_line":string,"name":string,"quantity":number,"unit":string,"confidence":0-1,"estimated_category_id":string}]}
Use same category ids as fridge prompt; guess category from product name. Skip non-food lines like tax, total, payment.`,
          },
          { type: "image_url", image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
        ],
      },
    ],
    max_tokens: 2000,
    response_format: { type: "json_object" },
  });
  const text = res.choices[0]?.message?.content ?? "";
  return { data: parseReceiptJson(text), sample: false };
}

function parseFridgeJson(text: string): FridgeCandidate[] {
  const j = parseJsonObject(text, "fridge scan");
  if (!Array.isArray(j.items)) throw new AiOutputError("fridge scan");
  return (j.items as Partial<FridgeCandidate>[]).map((i) => ({
    name: String(i.name ?? "").trim() || "Unknown",
    confidence: typeof i.confidence === "number" ? i.confidence : 0.5,
    estimated_category_id: guessCategoryFromText(String(i.name)),
  }));
}

function parseReceiptJson(text: string): ReceiptLine[] {
  const j = parseJsonObject(text, "receipt scan");
  if (!Array.isArray(j.lines)) throw new AiOutputError("receipt scan");
  return (j.lines as Partial<ReceiptLine>[]).map((l) => {
      const name = String(l.name ?? "").trim() || "Item";
      return {
        raw_line: String(l.raw_line ?? name),
        name,
        quantity: typeof l.quantity === "number" && l.quantity > 0 ? l.quantity : 1,
        unit: String(l.unit ?? "each"),
        confidence: typeof l.confidence === "number" ? l.confidence : 0.5,
        estimated_category_id: guessCategoryFromText(name),
      };
    });
}

function mockFridge(): FridgeCandidate[] {
  return [
    { name: "Baby spinach", confidence: 0.7, estimated_category_id: "spinach" },
    { name: "Cherry tomatoes", confidence: 0.65, estimated_category_id: "tomatoes" },
    { name: "Firm tofu", confidence: 0.6, estimated_category_id: "tofu_tempeh" },
  ];
}

function mockReceipt(): ReceiptLine[] {
  return [
    {
      raw_line: "ORG SPINACH 5OZ",
      name: "Organic spinach",
      quantity: 1,
      unit: "each",
      confidence: 0.7,
      estimated_category_id: "spinach",
    },
    {
      raw_line: "MILK 2L",
      name: "Milk 2L",
      quantity: 1,
      unit: "each",
      confidence: 0.6,
      estimated_category_id: "milk_dairy",
    },
  ];
}

export type MealDraft = {
  title: string;
  minutes: number;
  energy: number;
  ingredients_used: { inventory_item_id: string; qty: number }[];
  steps: string[];
  optional_adds?: string[];
};

export async function generateMealDrafts(args: {
  inventoryLines: { id: string; name: string; urgency: number; categoryId: string }[];
  staples: string[];
  vegetarianMode: string;
  maxMinutes: number;
  targetEnergy: number;
}): Promise<AiResult<MealDraft[]>> {
  const openai = client();
  const sys = `You are a vegetarian home-cook assistant. Propose meals that USE UP perishable inventory first.
Rules:
- Only use inventory_item_id values from the provided list.
- Respect vegetarianMode: if vegan, no dairy/eggs/honey/paneer.
- minutes <= maxMinutes. energy 1=easy 3=more effort.
- Return JSON only: {"meals":[...]} each meal: {title, minutes, energy, ingredients_used:[{inventory_item_id,qty}], steps:string[], optional_adds?:string[]}
- qty is reasonable fractional cups etc; keep <= plausible stock.
- Provide 6-8 meals.`;

  const payload = JSON.stringify(args, null, 2);
  if (!openai) {
    return { data: mockMeals(args.inventoryLines), sample: true };
  }
  const res = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: sys },
      { role: "user", content: payload },
    ],
    max_tokens: 2500,
    response_format: { type: "json_object" },
  });
  const text = res.choices[0]?.message?.content ?? "";
  const j = parseJsonObject(text, "meal plan");
  if (!Array.isArray(j.meals)) throw new AiOutputError("meal plan");
  // Drop malformed meals instead of letting them crash validation later.
  const meals = (j.meals as Partial<MealDraft>[])
    .filter(
      (m) =>
        typeof m.title === "string" &&
        typeof m.minutes === "number" &&
        typeof m.energy === "number" &&
        Array.isArray(m.ingredients_used) &&
        Array.isArray(m.steps),
    )
    .map((m) => ({
      title: m.title as string,
      minutes: m.minutes as number,
      energy: m.energy as number,
      ingredients_used: (m.ingredients_used ?? []).filter(
        (u) => typeof u?.inventory_item_id === "string" && typeof u?.qty === "number",
      ),
      steps: (m.steps ?? []).map(String),
      optional_adds: Array.isArray(m.optional_adds) ? m.optional_adds.map(String) : [],
    }));
  return { data: meals, sample: false };
}

function mockMeals(
  inv: { id: string; name: string; urgency: number; categoryId: string }[],
): MealDraft[] {
  const top = inv.slice(0, 3);
  if (top.length === 0) {
    return [
      {
        title: "Pantry pasta with jar sauce",
        minutes: 25,
        energy: 1,
        ingredients_used: [],
        steps: ["Boil pasta", "Warm sauce", "Combine"],
        optional_adds: ["pasta", "jarred sauce"],
      },
    ];
  }
  return [
    {
      title: `Clear-the-fridge stir-fry`,
      minutes: 30,
      energy: 2,
      ingredients_used: top.map((t) => ({ inventory_item_id: t.id, qty: 0.5 })),
      steps: ["Chop veg", "High heat pan", "Sauce and serve over rice if you have it"],
      optional_adds: [],
    },
    {
      title: `Simple salad bowl`,
      minutes: 15,
      energy: 1,
      ingredients_used: top.slice(0, 2).map((t) => ({ inventory_item_id: t.id, qty: 0.4 })),
      steps: ["Wash greens", "Chop veg", "Dress with lemon/oil"],
      optional_adds: [],
    },
  ];
}

export { normalizeName };
