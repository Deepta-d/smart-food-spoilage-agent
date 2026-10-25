import { prisma } from "./db";
import { scoreItem } from "./inventory-score";

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
