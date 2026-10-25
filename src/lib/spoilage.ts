import { getCategory } from "./taxonomy";

export type SpoilageInput = {
  categoryId: string;
  acquiredAt: Date;
  openedAt: Date | null;
  expiresOn: Date | null;
  frozen: boolean;
  /** User override for total fresh window (days) */
  shelfDaysOverride: number | null;
};

/**
 * Heuristic urgency 0–100. Higher = use sooner (waste-avoidance signal, not safety).
 */
export function computeUrgencyScore(input: SpoilageInput, now: Date = new Date()): number {
  const cat = getCategory(input.categoryId);
  if (input.frozen && cat.freezesWell) {
    return 5;
  }

  const freshDays = input.shelfDaysOverride ?? cat.freshDaysTypical;
  const openedDays = input.shelfDaysOverride
    ? Math.min(input.shelfDaysOverride, cat.openedDaysTypical)
    : cat.openedDaysTypical;

  let end: Date;
  if (input.expiresOn) {
    end = new Date(input.expiresOn);
  } else if (input.openedAt) {
    const start = new Date(input.openedAt);
    end = new Date(start);
    end.setDate(end.getDate() + openedDays);
  } else {
    const start = new Date(input.acquiredAt);
    end = new Date(start);
    end.setDate(end.getDate() + freshDays);
  }

  const msTotal = Math.max(
    24 * 60 * 60 * 1000,
    end.getTime() - new Date(input.openedAt ?? input.acquiredAt).getTime(),
  );
  const msLeft = end.getTime() - now.getTime();
  const ratioUsed = 1 - msLeft / msTotal;
  const clamped = Math.min(1, Math.max(0, ratioUsed));

  // Logistic bump near end of window
  const steep = 8;
  const logistic = 1 / (1 + Math.exp(-steep * (clamped - 0.55)));
  let score = 100 * logistic;

  if (cat.highPerishability) {
    score = Math.min(100, score * 1.08);
  }
  if (msLeft < 0) {
    score = 100;
  }
  return Math.round(score * 10) / 10;
}

export function effectiveUseByHint(input: SpoilageInput): Date {
  const cat = getCategory(input.categoryId);
  if (input.expiresOn) return new Date(input.expiresOn);
  const freshDays = input.shelfDaysOverride ?? cat.freshDaysTypical;
  const openedDays = input.shelfDaysOverride
    ? Math.min(input.shelfDaysOverride, cat.openedDaysTypical)
    : cat.openedDaysTypical;
  const base = input.openedAt ? new Date(input.openedAt) : new Date(input.acquiredAt);
  const end = new Date(base);
  end.setDate(end.getDate() + (input.openedAt ? openedDays : freshDays));
  return end;
}
