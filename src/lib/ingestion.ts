import { prisma } from "./db";
import { visionExtractFridge, visionExtractReceipt, assertImageSize } from "./llm";

export async function processIngestionRun(runId: string, userId: string) {
  const run = await prisma.ingestionRun.findFirst({ where: { id: runId, userId } });
  if (!run || !run.imageBase64 || !run.mimeType) {
    throw new Error("Run not found or missing image");
  }
  assertImageSize(run.imageBase64);
  await prisma.ingestionRun.update({
    where: { id: runId },
    data: { status: "processing", errorMessage: null },
  });
  try {
    if (run.type === "fridge") {
      const items = await visionExtractFridge(run.imageBase64, run.mimeType);
      await prisma.ingestionRun.update({
        where: { id: runId },
        data: {
          status: "awaiting_review",
          modelOutput: JSON.stringify({ kind: "fridge", items }),
        },
      });
    } else {
      const lines = await visionExtractReceipt(run.imageBase64, run.mimeType);
      await prisma.ingestionRun.update({
        where: { id: runId },
        data: {
          status: "awaiting_review",
          modelOutput: JSON.stringify({ kind: "receipt", lines }),
        },
      });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "failed";
    await prisma.ingestionRun.update({
      where: { id: runId },
      data: { status: "failed", errorMessage: msg },
    });
    throw e;
  }
}
