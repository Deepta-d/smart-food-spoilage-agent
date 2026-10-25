import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { withUserCookie } from "@/lib/http-user";
import { prisma } from "@/lib/db";
import { rescoreAllForUser } from "@/lib/inventory-actions";
import { normalizeName } from "@/lib/taxonomy";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params;
  return withUserCookie(async (userId) => {
    const body = (await req.json()) as Record<string, unknown>;
    const data: Prisma.InventoryItemUpdateInput = {};
    if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
    if (typeof body.quantity === "number") data.quantity = Math.max(0, body.quantity);
    if (typeof body.categoryId === "string") data.categoryId = body.categoryId;
    if (typeof body.frozen === "boolean") data.frozen = body.frozen;
    if (typeof body.shelfDaysOverride === "number")
      data.shelfDaysOverride = Math.min(60, Math.max(1, Math.floor(body.shelfDaysOverride)));
    if (body.shelfDaysOverride === null) data.shelfDaysOverride = null;
    if (typeof body.openedAt === "string") data.openedAt = new Date(body.openedAt);
    if (body.openedAt === null) data.openedAt = null;
    if (typeof body.expiresOn === "string") data.expiresOn = new Date(body.expiresOn);
    if (body.expiresOn === null) data.expiresOn = null;

    const row = await prisma.inventoryItem.findFirst({ where: { id, userId } });
    if (!row) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    if (typeof body.name === "string" && body.name.trim()) {
      data.normalizedName = normalizeName(body.name);
    }
    await prisma.inventoryItem.update({ where: { id }, data });
    await rescoreAllForUser(userId);
    const items = await prisma.inventoryItem.findMany({
      where: { userId },
      orderBy: [{ urgencyScore: "desc" }, { name: "asc" }],
    });
    return { items };
  });
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params;
  return withUserCookie(async (userId) => {
    const row = await prisma.inventoryItem.findFirst({ where: { id, userId } });
    if (!row) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    await prisma.inventoryItem.delete({ where: { id } });
    await rescoreAllForUser(userId);
    return { ok: true };
  });
}
