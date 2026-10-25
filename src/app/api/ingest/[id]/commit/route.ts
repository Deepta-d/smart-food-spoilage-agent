import { NextResponse } from "next/server";
import { withUserCookie } from "@/lib/http-user";
import { prisma } from "@/lib/db";
import { normalizeName, guessCategoryFromText } from "@/lib/taxonomy";
import { rescoreAllForUser } from "@/lib/inventory-actions";
import type { InventorySource } from "@/lib/taxonomy";

type Params = { params: Promise<{ id: string }> };

type CommitItem = {
  name: string;
  categoryId?: string;
  quantity?: number;
  unit?: string;
  source?: InventorySource;
};

export async function POST(req: Request, { params }: Params) {
  const { id } = await params;
  return withUserCookie(async (userId) => {
    const run = await prisma.ingestionRun.findFirst({ where: { id, userId } });
    if (!run) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    const body = (await req.json()) as { items?: CommitItem[] };
    const items = Array.isArray(body.items) ? body.items : [];
    if (items.length === 0) {
      return NextResponse.json({ error: "items required" }, { status: 400 });
    }
    const source: InventorySource =
      run.type === "receipt" ? "receipt" : run.type === "fridge" ? "photo" : "manual";

    for (const it of items) {
      const name = String(it.name ?? "").trim();
      if (!name) continue;
      const normalizedName = normalizeName(name);
      const categoryId = it.categoryId || guessCategoryFromText(name);
      const qty = typeof it.quantity === "number" && it.quantity > 0 ? it.quantity : 1;
      const unit = String(it.unit ?? "each");
      const existing = await prisma.inventoryItem.findFirst({
        where: { userId, normalizedName },
      });
      if (existing) {
        await prisma.inventoryItem.update({
          where: { id: existing.id },
          data: { quantity: existing.quantity + qty, categoryId, source },
        });
      } else {
        await prisma.inventoryItem.create({
          data: {
            userId,
            name,
            normalizedName,
            categoryId,
            quantity: qty,
            unit,
            source,
            confidence: 0.85,
          },
        });
      }
    }

    await prisma.ingestionRun.update({
      where: { id },
      data: { status: "completed", imageBase64: null },
    });
    await rescoreAllForUser(userId);
    const inv = await prisma.inventoryItem.findMany({
      where: { userId },
      orderBy: [{ urgencyScore: "desc" }, { name: "asc" }],
    });
    return { ok: true, items: inv };
  });
}
