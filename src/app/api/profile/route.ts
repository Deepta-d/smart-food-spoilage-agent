import { NextResponse } from "next/server";
import { withUserCookie } from "@/lib/http-user";
import { prisma } from "@/lib/db";
import { VEGETARIAN_MODES } from "@/lib/taxonomy";

export async function PATCH(req: Request) {
  return withUserCookie(async (userId) => {
    const body = (await req.json()) as Record<string, unknown>;
    const vegetarianMode =
      typeof body.vegetarianMode === "string" && VEGETARIAN_MODES.includes(body.vegetarianMode as "vegan" | "lacto_ovo")
        ? body.vegetarianMode
        : undefined;
    const defaultMinutes = typeof body.defaultMinutes === "number" ? body.defaultMinutes : undefined;
    const defaultEnergy = typeof body.defaultEnergy === "number" ? body.defaultEnergy : undefined;
    const timezone = typeof body.timezone === "string" ? body.timezone : undefined;
    const stapleItems = Array.isArray(body.stapleItems) ? (body.stapleItems as string[]) : undefined;
    const retentionDays = typeof body.retentionDays === "number" ? body.retentionDays : undefined;

    const profile = await prisma.userProfile.update({
      where: { userId },
      data: {
        ...(vegetarianMode ? { vegetarianMode } : {}),
        ...(defaultMinutes !== undefined ? { defaultMinutes: Math.min(180, Math.max(10, defaultMinutes)) } : {}),
        ...(defaultEnergy !== undefined ? { defaultEnergy: Math.min(3, Math.max(1, defaultEnergy)) } : {}),
        ...(timezone ? { timezone } : {}),
        ...(stapleItems ? { stapleItemsJson: JSON.stringify(stapleItems.slice(0, 40)) } : {}),
        ...(retentionDays !== undefined
          ? { retentionDays: Math.min(365, Math.max(1, Math.floor(retentionDays))) }
          : {}),
      },
    });

    const digestEnabled = typeof body.digestEnabled === "boolean" ? body.digestEnabled : undefined;
    const digestHourLocal = typeof body.digestHourLocal === "number" ? body.digestHourLocal : undefined;
    const digestSnoozeUntil =
      body.digestSnoozeUntil === null
        ? null
        : typeof body.digestSnoozeUntil === "string"
          ? new Date(body.digestSnoozeUntil)
          : undefined;

    const pref = await prisma.notificationPref.update({
      where: { userId },
      data: {
        ...(digestEnabled !== undefined ? { digestEnabled } : {}),
        ...(digestHourLocal !== undefined
          ? { digestHourLocal: Math.min(23, Math.max(0, Math.floor(digestHourLocal))) }
          : {}),
        ...(digestSnoozeUntil !== undefined ? { digestSnoozeUntil } : {}),
      },
    });

    return { profile, notificationPref: pref };
  });
}
