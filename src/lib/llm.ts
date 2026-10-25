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

export async function visionExtractFridge(imageBase64: string, mimeType: string): Promise<FridgeCandidate[]> {
  const openai = client();
  if (!openai) {
    return mockFridge();
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
  });
  const text = res.choices[0]?.message?.content ?? "{}";
  return parseFridgeJson(text);
}

export async function visionExtractReceipt(imageBase64: string, mimeType: string): Promise<ReceiptLine[]> {
  const openai = client();
  if (!openai) {
    return mockReceipt();
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
  });
  const text = res.choices[0]?.message?.content ?? "{}";
  return parseReceiptJson(text);
}

function parseFridgeJson(text: string): FridgeCandidate[] {
  const cleaned = text.replace(/```json\n?|```/g, "").trim();
  try {
    const j = JSON.parse(cleaned) as { items?: FridgeCandidate[] };
    const items = j.items ?? [];
    return items.map((i) => ({
      name: String(i.name ?? "").trim() || "Unknown",
      confidence: typeof i.confidence === "number" ? i.confidence : 0.5,
      estimated_category_id: guessCategoryFromText(String(i.name)),
    }));
  } catch {
    return mockFridge();
  }
}

function parseReceiptJson(text: string): ReceiptLine[] {
  const cleaned = text.replace(/```json\n?|```/g, "").trim();
  try {
    const j = JSON.parse(cleaned) as { lines?: ReceiptLine[] };
    const lines = j.lines ?? [];
    return lines.map((l) => {
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
  } catch {
    return mockReceipt();
  }
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
}): Promise<MealDraft[]> {
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
    return mockMeals(args.inventoryLines);
  }
  const res = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: sys },
      { role: "user", content: payload },
    ],
    max_tokens: 2500,
  });
  const text = res.choices[0]?.message?.content ?? "{}";
  const cleaned = text.replace(/```json\n?|```/g, "").trim();
  try {
    const j = JSON.parse(cleaned) as { meals?: MealDraft[] };
    return j.meals ?? [];
  } catch {
    return mockMeals(args.inventoryLines);
  }
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
