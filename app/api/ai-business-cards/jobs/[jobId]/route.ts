import { NextResponse } from "next/server";
import { readAiBusinessCardJob } from "@/lib/server/ai-business-card-jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AiBusinessCardJobRouteContext = {
  params: Promise<{ jobId: string }>;
};

export async function GET(_request: Request, context: AiBusinessCardJobRouteContext) {
  const { jobId } = await context.params;
  const job = await readAiBusinessCardJob(jobId);

  if (!job) {
    return NextResponse.json({ reason: "작업을 찾지 못했어요." }, { status: 404 });
  }

  return NextResponse.json(job, { headers: { "Cache-Control": "no-store" } });
}
