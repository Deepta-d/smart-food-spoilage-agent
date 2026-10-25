import { NextResponse } from "next/server";
import { withUserCookie } from "@/lib/http-user";
import { prisma } from "@/lib/db";

const MAX_BYTES = 1_800_000;

export async function POST(req: Request) {
  return withUserCookie(async (userId) => {
    const form = await req.formData();
    const file = form.get("file");
    const type = String(form.get("type") ?? "fridge");
    if (!(file instanceof Blob)) {
      return NextResponse.json({ error: "file required" }, { status: 400 });
    }
    if (type !== "fridge" && type !== "receipt") {
      return NextResponse.json({ error: "type must be fridge or receipt" }, { status: 400 });
    }
    const buf = Buffer.from(await file.arrayBuffer());
    if (buf.length > MAX_BYTES) {
      return NextResponse.json({ error: "file too large" }, { status: 400 });
    }
    const mimeType = file.type || "image/jpeg";
    const imageBase64 = buf.toString("base64");

    const run = await prisma.ingestionRun.create({
      data: {
        userId,
        type,
        status: "pending",
        imageBase64,
        mimeType,
      },
    });
    return { id: run.id, status: run.status };
  });
}
