import { prisma } from "./db";
import { scoreItem } from "./inventory-score";
import type { InventorySource } from "./taxonomy";

function startOfToday(now: Date = new Date()): Date {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Add purchased or scanned stock to a user's inventory.
 *
 * Each purchase is tracked as its own batch so freshly bought food keeps its
 * own acquired date and urgency score. Previously, restocking merged the new
 * quantity into an older row, so new groceries inherited the old purchase date
 * and were wrongly flagged as close to spoiling.
 *
 * Quantities are only merged into an existing row when it is the same batch:
 * same item and unit, added today, not opened, not frozen and with no explicit
 * expiry date (for example, two cartons of milk from one receipt).
 */
export async function addStock(args: {
  userId: string;
  name: string;
  normalizedName: string;
  categoryId: string;
  quantity: number;
  unit: string;
  source: InventorySource;
  confidence: number;
}) {
  const sameBatch = await prisma.inventoryItem.findFirst({
    where: {
      userId: args.userId,
      normalizedName: args.normalizedName,
      unit: args.unit,
      acquiredAt: { gte: startOfToday() },
      openedAt: null,
      expiresOn: null,
      frozen: false,
    },
  });
  if (sameBatch) {
    return prisma.inventoryItem.update({
      where: { id: sameBatch.id },
      data: { quantity: sameBatch.quantity + args.quantity },
    });
  }
  return prisma.inventoryItem.create({
    data: {
      userId: args.userId,
      name: args.name,
      normalizedName: args.normalizedName,
      categoryId: args.categoryId,
      quantity: args.quantity,
      unit: args.unit,
      source: args.source,
      confidence: args.confidence,
    },
  });
}

export async function rescoreAllForUser(userId: string) {
  const items = await prisma.inventoryItem.findMany({ where: { userId } });
  const now = new Date();
  await Promise.all(
    items.map((item) =>
      prisma.inventoryItem.update({
        where: { id: item.id },
        data: { urgencyScore: scoreItem(item, now), lastScoredAt: now },
      }),
    ),
  );
}

/** Clear image payloads on old ingestion runs per user retention preference */
export async function purgeIngestionArtifacts(userId: string) {
  const profile = await prisma.userProfile.findUnique({ where: { userId } });
  const days = profile?.retentionDays ?? 30;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  await prisma.ingestionRun.updateMany({
    where: { userId, createdAt: { lt: cutoff }, imageBase64: { not: null } },
    data: { imageBase64: null },
  });
}
