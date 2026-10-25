# Spoil Planner: AI Food Spoilage & Meal Planning Agent

**Business question:** Households throw away food mostly because they forget what's in the fridge or don't know what to cook before it spoils. How can an app track what you have, predict what will spoil first, and turn that into a quick dinner plan for tonight?

**What I built:** A full-stack web app for vegetarian home cooks. You add groceries by photographing your fridge, scanning a receipt or typing items in. The app scores each item by how soon it will spoil, uses AI to suggest meals that use the most at-risk food first, and updates your inventory automatically when you cook.

### Key features

- **Three ways to add food:** A fridge photo or grocery receipt is read by an AI vision model (GPT-4o-mini), which proposes items for you to review before saving. Manual entry is also supported.
- **Spoilage urgency score (0–100):** Each item is scored from its purchase date, opening date, expiry date, whether it's frozen and its food type, across 42 food categories. The score rises sharply as an item nears the end of its shelf life.
- **Ranked meal suggestions:** The AI proposes meals, and each is ranked by how much urgent food it uses, balanced against cooking time and effort.
- **Guardrails on AI output:** Every AI-suggested meal is checked against hard rules before you see it. It must be vegetarian (or vegan when selected), use only ingredients you actually have, stay within available quantities and fit your time and effort limits. Meals that fail are dropped.
- **Cook-to-deduct:** Marking a meal as cooked deducts its ingredients from your inventory in a single all-or-nothing transaction.
- **Daily digest:** An optional scheduled summary of your three most urgent items and a recommended meal, generated at your chosen local time and limited to once a day. In this version, the digest is saved in the app and can be previewed there; email delivery is a planned next step.
- **Privacy by default:** Every query is scoped to the current user, uploaded photos are size-limited, and stored images are deleted automatically after a retention period.

**Tech stack:** Next.js 16, React 19, TypeScript, Prisma (SQLite), OpenAI API (GPT-4o-mini), Tailwind CSS 4

---

## Getting started

Requires Node.js 20 or later.

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy the environment template and fill it in:

   ```bash
   cp .env.example .env
   ```

   | Variable | Purpose |
   |----------|---------|
   | `DATABASE_URL` | SQLite database location (the default works locally) |
   | `OPENAI_API_KEY` | Enables real photo scanning and meal planning. Without it, the app runs in demo mode with clearly labelled sample data. |
   | `CRON_SECRET` | Protects the daily digest endpoint |

3. Create the database and start the app:

   ```bash
   npm run db:push
   npm run dev
   ```

   Then open http://localhost:3000.

### Daily digest

Schedule a `POST` request to `/api/cron/digest` (for example, hourly) with the header `Authorization: Bearer <CRON_SECRET>`. Each user's digest is generated at their chosen local hour.

## Project structure

```
prisma/schema.prisma          Data model: users, inventory, scans, meal suggestions, digest settings
src/app/page.tsx              Main page
src/components/               Spoil Planner user interface
src/app/api/                  API routes: inventory, scans, tonight's meals, cook, digest
src/lib/spoilage.ts           Spoilage urgency scoring
src/lib/meal-planner.ts       Meal validation guardrails and ranking
src/lib/llm.ts                OpenAI vision and meal-generation calls
src/lib/taxonomy.ts           Food categories, shelf lives and vegetarian/vegan rules
src/lib/inventory-actions.ts  Adding stock and re-scoring inventory
src/lib/cook.ts               Deducting ingredients after cooking
src/lib/digest.ts             Scheduled daily digest
```
