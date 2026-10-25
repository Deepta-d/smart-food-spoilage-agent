import type { InventoryItem } from "@prisma/client";
import { computeUrgencyScore } from "./spoilage";

export function itemToSpoilageInput(item: InventoryItem) {
  return {
    categoryId: item.categoryId,
    acquiredAt: item.acquiredAt,
    openedAt: item.openedAt,
    expiresOn: item.expiresOn,
    frozen: item.frozen,
    shelfDaysOverride: item.shelfDaysOverride,
  };
}

export function scoreItem(item: InventoryItem, now = new Date()) {
  return computeUrgencyScore(itemToSpoilageInput(item), now);
}
