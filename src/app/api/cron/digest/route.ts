import { NextResponse } from "next/server";
import { runDigestCron } from "@/lib/digest";

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }
  const out = await runDigestCron();
  return NextResponse.json(out);
}
