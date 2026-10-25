import { withUserCookie } from "@/lib/http-user";
import { purgeIngestionArtifacts } from "@/lib/inventory-actions";

/** Clear old ingestion images for current user per retentionDays */
export async function POST() {
  return withUserCookie(async (userId) => {
    await purgeIngestionArtifacts(userId);
    return { ok: true };
  });
}
