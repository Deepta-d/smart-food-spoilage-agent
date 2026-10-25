import { NextResponse } from "next/server";
import { withUserCookie } from "@/lib/http-user";
import { prisma } from "@/lib/db";
import { guessCategoryFromText, normalizeName } from "@/lib/taxonomy";
import { rescoreAllForUser } from "@/lib/inventory-actions";

export async function GET() {
  return withUserCookie(async (userId) => {
    await rescoreAllForUser(userId);
    const items = await prisma.inventoryItem.findMany({
      where: { userId },
      orderBy: [{ urgencyScore: "desc" }, { name: "asc" }],
    });
    return { items };
  });
}

export async function POST(req: Request) {
  return withUserCookie(async (userId) => {
    const body = (await req.json()) as {
      name: string;
      quantity?: number;
      unit?: string;
      categoryId?: string;
      source?: string;
    };
    const name = String(body.name ?? "").trim();
    if (!name) {
      return NextResponse.json({ error: "name required" }, { status: 400 });
    }
    const normalizedName = normalizeName(name);
    const categoryId = body.categoryId || guessCategoryFromText(name);
    const qty = typeof body.quantity === "number" && body.quantity > 0 ? body.quantity : 1;
    const unit = String(body.unit ?? "each");
    const source = body.source === "receipt" || body.source === "photo" ? body.source : "manual";

    const existing = await prisma.inventoryItem.findFirst({
      where: { userId, normalizedName },
    });
    if (existing) {
      await prisma.inventoryItem.update({
        where: { id: existing.id },
        data: { quantity: existing.quantity + qty, categoryId },
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
          confidence: 1,
        },
      });
    }
    await rescoreAllForUser(userId);
    const items = await prisma.inventoryItem.findMany({
      where: { userId },
      orderBy: [{ urgencyScore: "desc" }, { name: "asc" }],
    });
    return { items };
  });
}
