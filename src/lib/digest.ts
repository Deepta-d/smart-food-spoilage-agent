import { prisma } from "./db";
import { rescoreAllForUser } from "./inventory-actions";
import { planTonight } from "./meal-planner";

function hourInTimeZone(now: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "numeric",
    hour12: false,
  }).formatToParts(now);
  const h = parts.find((p) => p.type === "hour")?.value ?? "0";
  return parseInt(h, 10);
}

export async function buildDigestPayload(userId: string) {
  await rescoreAllForUser(userId);
  const items = await prisma.inventoryItem.findMany({
    where: { userId },
    orderBy: { urgencyScore: "desc" },
    take: 8,
  });
  const top3 = items.slice(0, 3).map((i) => ({
    name: i.name,
    urgency: i.urgencyScore,
    categoryId: i.categoryId,
  }));
  let recommended = null as null | { title: string; minutes: number };
  let oneMinuteAction = "Open the app and confirm what is left in the fridge.";
  try {
    const plan = await planTonight({ userId, maxMinutes: 35, energy: 2, persistSuggestion: false });
    const first = plan.meals[0];
    if (first) {
      recommended = { title: first.title, minutes: first.minutes };
      oneMinuteAction = `Prep ${top3[0]?.name ?? "your most urgent produce"}: wash, chop, and store for tomorrow’s cook.`;
    }
  } catch {
    // ignore plan errors in digest
  }
  return { top3, recommended, oneMinuteAction, generatedAt: new Date().toISOString() };
}

export async function runDigestCron(now = new Date()) {
  const users = await prisma.notificationPref.findMany({
    where: { digestEnabled: true },
    include: { user: { include: { profile: true } } },
  });
  const results: { userId: string; sent: boolean; reason?: string }[] = [];
  for (const pref of users) {
    const tz = pref.user.profile?.timezone ?? "America/Toronto";
    const hour = hourInTimeZone(now, tz);
    if (hour !== pref.digestHourLocal) {
      results.push({ userId: pref.userId, sent: false, reason: "hour_mismatch" });
      continue;
    }
    if (pref.digestSnoozeUntil && pref.digestSnoozeUntil > now) {
      results.push({ userId: pref.userId, sent: false, reason: "snoozed" });
      continue;
    }
    if (pref.lastDigestSentAt) {
      const diff = now.getTime() - pref.lastDigestSentAt.getTime();
      if (diff < 20 * 60 * 60 * 1000) {
        results.push({ userId: pref.userId, sent: false, reason: "rate_limited" });
        continue;
      }
    }
    const payload = await buildDigestPayload(pref.userId);
    await prisma.notificationPref.update({
      where: { userId: pref.userId },
      data: {
        lastDigestSentAt: now,
        lastDigestContent: JSON.stringify(payload),
      },
    });
    results.push({ userId: pref.userId, sent: true });
  }
  return { results };
}
