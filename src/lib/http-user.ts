import { NextResponse } from "next/server";
import { ensureUserBootstrap } from "./auth";

/** Attach spoil_uid cookie when a new user is created */
export async function withUserCookie(
  handler: (userId: string) => Promise<Record<string, unknown> | NextResponse>,
): Promise<NextResponse> {
  const { userId, setCookie } = await ensureUserBootstrap();
  const out = await handler(userId);
  const res = out instanceof NextResponse ? out : NextResponse.json(out);
  if (setCookie) {
    res.headers.append("Set-Cookie", setCookie);
  }
  return res;
}
