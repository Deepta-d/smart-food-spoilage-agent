import { cookies } from "next/headers";
import { prisma } from "./db";

const COOKIE = "spoil_uid";

export async function getUserIdFromCookie(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(COOKIE)?.value ?? null;
}

export async function ensureUserBootstrap(): Promise<{ userId: string; setCookie: string }> {
  const jar = await cookies();
  let userId = jar.get(COOKIE)?.value ?? null;
  if (userId) {
    const exists = await prisma.user.findUnique({ where: { id: userId } });
    if (exists) {
      await ensureProfileRows(userId);
      return { userId, setCookie: "" };
    }
  }
  const user = await prisma.user.create({ data: {} });
  userId = user.id;
  await ensureProfileRows(userId);
  const setCookie = `${COOKIE}=${userId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 400}`;
  return { userId, setCookie };
}

async function ensureProfileRows(userId: string) {
  await prisma.userProfile.upsert({
    where: { userId },
    create: { userId },
    update: {},
  });
  await prisma.notificationPref.upsert({
    where: { userId },
    create: { userId },
    update: {},
  });
}

export async function requireUserId(): Promise<string> {
  const id = await getUserIdFromCookie();
  if (!id) {
    throw new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }
  const u = await prisma.user.findUnique({ where: { id } });
  if (!u) {
    throw new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }
  return id;
}
