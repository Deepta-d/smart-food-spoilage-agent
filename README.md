# Spoil planner (vegetarian)

Tonight-first cook planner: fridge/receipt/manual inventory, spoilage urgency scoring, ranked meals, cook-to-deduct, digest cron.

**Stack:** [Next.js](https://nextjs.org/) 16, React 19, Prisma (SQLite), Tailwind CSS 4.

## Clone and run

```bash
git clone https://github.com/YOUR_USERNAME/spoil-planner.git
cd spoil-planner
cp .env.example .env
npm install
npx prisma db push
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Link this repo to GitHub (new empty repository)

1. On GitHub: **New repository** → name it (for example `spoil-planner`) → leave **without** a README (this project already has one) → Create.
2. In the project folder:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/spoil-planner.git
git push -u origin main
```

Replace `YOUR_USERNAME` and the repo name with yours. Use SSH (`git@github.com:...`) instead if you prefer.

## Setup

```bash
cd spoil-planner
cp .env.example .env   # set DATABASE_URL and optional OPENAI_API_KEY
npm install
npx prisma db push
npm run dev
```

- Without `OPENAI_API_KEY`, vision and meal generation use **mock data** so the UI still works.
- Production build uses webpack (`npm run build`) to avoid Turbopack workspace issues when a parent folder has another lockfile.

## API (cookie `spoil_uid`)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/session` | Bootstrap user, rescore inventory, purge old blobs, profile + history |
| PATCH | `/api/profile` | Profile + notification prefs (incl. digest snooze) |
| GET/POST | `/api/inventory` | List / manual add |
| PATCH/DELETE | `/api/inventory/[id]` | Update item (shelf override, frozen, opened, expiry) / delete |
| POST | `/api/ingest` | Multipart `file` + `type` fridge\|receipt |
| GET | `/api/ingest/[id]` | Ingestion status + model output |
| POST | `/api/ingest/[id]/process` | Run vision extraction |
| POST | `/api/ingest/[id]/commit` | Merge reviewed lines into pantry |
| POST | `/api/tonight` | Ranked meals + persisted suggestion |
| POST | `/api/cook` | Body `{ suggestionId, mealRank }` deducts inventory |
| GET | `/api/suggestions/[id]` | Reload a past suggestion |
| GET | `/api/digest/preview` | Build digest payload (no extra suggestion row) |
| POST | `/api/purge` | User-triggered retention purge for uploads |
| POST | `/api/cron/digest` | If `CRON_SECRET` is set, requires `Authorization: Bearer …` |

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
