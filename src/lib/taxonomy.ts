/**
 * Controlled taxonomy: vegetarian modes + food categories with spoilage heuristics.
 * These are food-waste reduction estimates, not food-safety guarantees.
 */

export const VEGETARIAN_MODES = ["vegan", "lacto_ovo"] as const;
export type VegetarianMode = (typeof VEGETARIAN_MODES)[number];

export const INVENTORY_SOURCES = ["photo", "receipt", "manual"] as const;
export type InventorySource = (typeof INVENTORY_SOURCES)[number];

export type FoodCategory = {
  id: string;
  label: string;
  /** Typical shelf life when sealed/unopened in fridge (days) */
  freshDaysTypical: number;
  /** After opened, remaining fridge life (days) — if not applicable, same as fresh */
  openedDaysTypical: number;
  /** When frozen, urgency is minimal until thawed */
  freezesWell: boolean;
  /** UI hint for extra care (still not a safety claim) */
  highPerishability: boolean;
};

/** ~40 vegetarian-heavy categories with heuristic shelf windows */
export const FOOD_CATEGORIES: FoodCategory[] = [
  { id: "leafy_greens", label: "Leafy greens", freshDaysTypical: 4, openedDaysTypical: 2, freezesWell: false, highPerishability: true },
  { id: "herbs_fresh", label: "Fresh herbs", freshDaysTypical: 5, openedDaysTypical: 3, freezesWell: true, highPerishability: true },
  { id: "salad_mix", label: "Salad mix / lettuce", freshDaysTypical: 4, openedDaysTypical: 2, freezesWell: false, highPerishability: true },
  { id: "spinach", label: "Spinach / tender greens", freshDaysTypical: 4, openedDaysTypical: 2, freezesWell: true, highPerishability: true },
  { id: "broccoli", label: "Broccoli / cauliflower", freshDaysTypical: 5, openedDaysTypical: 3, freezesWell: true, highPerishability: false },
  { id: "cabbage", label: "Cabbage / kale (hard)", freshDaysTypical: 10, openedDaysTypical: 5, freezesWell: true, highPerishability: false },
  { id: "tomatoes", label: "Tomatoes", freshDaysTypical: 5, openedDaysTypical: 3, freezesWell: false, highPerishability: true },
  { id: "cucumber", label: "Cucumber / zucchini", freshDaysTypical: 7, openedDaysTypical: 4, freezesWell: false, highPerishability: false },
  { id: "peppers", label: "Bell peppers / chilies", freshDaysTypical: 10, openedDaysTypical: 5, freezesWell: true, highPerishability: false },
  { id: "mushrooms", label: "Mushrooms", freshDaysTypical: 5, openedDaysTypical: 3, freezesWell: true, highPerishability: true },
  { id: "root_veg", label: "Root vegetables (carrot, beet)", freshDaysTypical: 21, openedDaysTypical: 10, freezesWell: true, highPerishability: false },
  { id: "potato", label: "Potatoes / sweet potato", freshDaysTypical: 21, openedDaysTypical: 14, freezesWell: false, highPerishability: false },
  { id: "onion_garlic", label: "Onion / garlic / ginger", freshDaysTypical: 30, openedDaysTypical: 14, freezesWell: true, highPerishability: false },
  { id: "beans_fresh", label: "Fresh beans / peas", freshDaysTypical: 5, openedDaysTypical: 3, freezesWell: true, highPerishability: false },
  { id: "corn_fresh", label: "Fresh corn", freshDaysTypical: 3, openedDaysTypical: 2, freezesWell: true, highPerishability: true },
  { id: "asparagus", label: "Asparagus", freshDaysTypical: 4, openedDaysTypical: 2, freezesWell: true, highPerishability: true },
  { id: "berries", label: "Berries", freshDaysTypical: 4, openedDaysTypical: 2, freezesWell: true, highPerishability: true },
  { id: "citrus", label: "Citrus fruit", freshDaysTypical: 14, openedDaysTypical: 7, freezesWell: true, highPerishability: false },
  { id: "stone_fruit", label: "Stone fruit", freshDaysTypical: 5, openedDaysTypical: 3, freezesWell: true, highPerishability: true },
  { id: "apple_pear", label: "Apple / pear", freshDaysTypical: 21, openedDaysTypical: 7, freezesWell: false, highPerishability: false },
  { id: "cut_fruit", label: "Cut / prepared fruit", freshDaysTypical: 3, openedDaysTypical: 2, freezesWell: false, highPerishability: true },
  { id: "avocado", label: "Avocado", freshDaysTypical: 5, openedDaysTypical: 1, freezesWell: false, highPerishability: true },
  { id: "tofu_tempeh", label: "Tofu / tempeh (unopened)", freshDaysTypical: 7, openedDaysTypical: 3, freezesWell: true, highPerishability: true },
  { id: "seitan", label: "Seitan / mock meats", freshDaysTypical: 7, openedDaysTypical: 4, freezesWell: true, highPerishability: false },
  { id: "paneer", label: "Paneer / fresh cheese", freshDaysTypical: 5, openedDaysTypical: 3, freezesWell: false, highPerishability: true },
  { id: "milk_dairy", label: "Milk / cream", freshDaysTypical: 7, openedDaysTypical: 5, freezesWell: false, highPerishability: true },
  { id: "yogurt", label: "Yogurt", freshDaysTypical: 14, openedDaysTypical: 7, freezesWell: false, highPerishability: false },
  { id: "hard_cheese", label: "Hard cheese", freshDaysTypical: 30, openedDaysTypical: 14, freezesWell: true, highPerishability: false },
  { id: "soft_cheese", label: "Soft cheese", freshDaysTypical: 10, openedDaysTypical: 5, freezesWell: false, highPerishability: true },
  { id: "butter", label: "Butter / ghee", freshDaysTypical: 30, openedDaysTypical: 21, freezesWell: true, highPerishability: false },
  { id: "eggs", label: "Eggs", freshDaysTypical: 28, openedDaysTypical: 2, freezesWell: false, highPerishability: true },
  { id: "cooked_grains", label: "Cooked rice / grains", freshDaysTypical: 4, openedDaysTypical: 3, freezesWell: true, highPerishability: true },
  { id: "dry_grains", label: "Dry grains / pulses (dry)", freshDaysTypical: 365, openedDaysTypical: 180, freezesWell: true, highPerishability: false },
  { id: "cooked_legumes", label: "Cooked beans / lentils", freshDaysTypical: 4, openedDaysTypical: 3, freezesWell: true, highPerishability: true },
  { id: "canned_opened", label: "Canned goods (opened)", freshDaysTypical: 4, openedDaysTypical: 3, freezesWell: true, highPerishability: false },
  { id: "bread", label: "Bread / buns", freshDaysTypical: 5, openedDaysTypical: 3, freezesWell: true, highPerishability: false },
  { id: "tortillas", label: "Tortillas / wraps", freshDaysTypical: 10, openedDaysTypical: 5, freezesWell: true, highPerishability: false },
  { id: "pasta_sauce", label: "Pasta sauce (opened jar)", freshDaysTypical: 5, openedDaysTypical: 4, freezesWell: true, highPerishability: false },
  { id: "plant_milk", label: "Plant milk (opened)", freshDaysTypical: 7, openedDaysTypical: 5, freezesWell: false, highPerishability: false },
  { id: "hummus_dips", label: "Hummus / dips", freshDaysTypical: 7, openedDaysTypical: 5, freezesWell: false, highPerishability: true },
  { id: "prepared_salad", label: "Prepared salad / slaw", freshDaysTypical: 3, openedDaysTypical: 2, freezesWell: false, highPerishability: true },
  { id: "other", label: "Other / unknown", freshDaysTypical: 7, openedDaysTypical: 4, freezesWell: false, highPerishability: false },
];

const CATEGORY_BY_ID = new Map(FOOD_CATEGORIES.map((c) => [c.id, c]));

export function getCategory(id: string): FoodCategory {
  return CATEGORY_BY_ID.get(id) ?? CATEGORY_BY_ID.get("other")!;
}

/** Non-veg proteins to block in meal verifier */
export const NON_VEG_KEYWORDS = [
  "chicken", "beef", "pork", "fish", "salmon", "tuna", "shrimp", "prawn", "lamb", "mutton",
  "turkey", "duck", "bacon", "ham", "anchovy", "sardine", "cod", "tilapia", "seafood",
  "gelatin", "lard", "suet",
];

export const VEGAN_FORBIDDEN = [
  "cream",
  "butter",
  "ghee",
  "cheese",
  "yogurt",
  "paneer",
  "honey",
  "egg",
  "eggs",
  "mayo",
];

export function normalizeName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^\p{L}\p{N}\s-]/gu, "");
}

/** Map free text / receipt line to best category id (heuristic) */
export function guessCategoryFromText(text: string): string {
  const t = normalizeName(text);
  const rules: [RegExp, string][] = [
    [/spinach|arugula|rocket|chard/, "spinach"],
    [/lettuce|salad mix|mesclun/, "salad_mix"],
    [/kale|cabbage|collard/, "cabbage"],
    [/cilantro|coriander leaf|parsley|basil|mint|dill|herb/, "herbs_fresh"],
    [/broccoli|cauliflower/, "broccoli"],
    [/tomato/, "tomatoes"],
    [/cucumber|zucchini|courgette/, "cucumber"],
    [/pepper|chili|chilli|jalapeno/, "peppers"],
    [/mushroom/, "mushrooms"],
    [/carrot|beet|turnip|radish/, "root_veg"],
    [/potato|sweet potato|yam/, "potato"],
    [/onion|garlic|ginger|shallot/, "onion_garlic"],
    [/bean sprout|snap pea|snow pea|green bean/, "beans_fresh"],
    [/corn/, "corn_fresh"],
    [/asparagus/, "asparagus"],
    [/strawberr|blueberr|raspberr|blackberr|berry/, "berries"],
    [/orange|lemon|lime|grapefruit|citrus/, "citrus"],
    [/peach|plum|apricot|cherry|nectarine/, "stone_fruit"],
    [/apple|pear/, "apple_pear"],
    [/avocado/, "avocado"],
    [/tofu|tempeh/, "tofu_tempeh"],
    [/seitan|mock meat|veggie burger|plant.based meat/i, "seitan"],
    [/paneer/, "paneer"],
    [/milk(?!.?almond)|cream(?!\s+cheese)|half.and|heavy cream/i, "milk_dairy"],
    [/yogurt|yoghurt/, "yogurt"],
    [/cheddar|parmesan|mozzarella|feta|brie|camembert|swiss cheese|hard cheese/i, "hard_cheese"],
    [/cream cheese|cottage|ricotta|goat cheese|soft cheese/i, "soft_cheese"],
    [/butter|ghee/, "butter"],
    [/egg(?!plant)|eggs\b/, "eggs"],
    [/cooked rice|leftover rice|steamed rice/, "cooked_grains"],
    [/rice\b|quinoa|oats\b|barley|bulgur|couscous|dry lentil|dry bean|chickpea flour/i, "dry_grains"],
    [/cooked lentil|cooked bean|refried/, "cooked_legumes"],
    [/hummus|dip\b|tzatziki/, "hummus_dips"],
    [/bread|bun|bagel|roll\b/, "bread"],
    [/tortilla|wrap\b|naan|roti|pita/, "tortillas"],
    [/pasta sauce|marinara|tomato sauce/, "pasta_sauce"],
    [/oat milk|almond milk|soy milk|plant milk|coconut milk carton/i, "plant_milk"],
    [/leaf|greens|spring mix/, "leafy_greens"],
  ];
  for (const [re, id] of rules) {
    if (re.test(t)) return id;
  }
  return "other";
}
