import { withUserCookie } from "@/lib/http-user";
import { prisma } from "@/lib/db";
import { buildDigestPayload } from "@/lib/digest";

export async function GET() {
  return withUserCookie(async (userId) => {
    const digest = await buildDigestPayload(userId);
    const pref = await prisma.notificationPref.findUnique({ where: { userId } });
    let stored = null;
    if (pref?.lastDigestContent) {
      try {
        stored = JSON.parse(pref.lastDigestContent);
      } catch {
        stored = null;
      }
    }
    return { digest, lastSent: pref?.lastDigestSentAt, stored };
  });
}
