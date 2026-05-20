import { NextResponse } from "next/server";
import { findLatestAiBusinessCardJob, processAiBusinessCardJobs } from "@/lib/server/ai-business-card-jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const kind = url.searchParams.get("kind");
  const signature = url.searchParams.get("signature")?.trim() ?? "";

  if ((kind !== "mockups" && kind !== "pdf") || !signature) {
    return NextResponse.json({ reason: "작업 조회 요청이 올바르지 않아요." }, { status: 400 });
  }

  const job = await findLatestAiBusinessCardJob(kind, signature);

  if (!job) {
    return NextResponse.json({ reason: "작업을 찾지 못했어요." }, { status: 404 });
  }

  if (job.status === "queued") {
    await processAiBusinessCardJobs();

    const refreshedJob = await findLatestAiBusinessCardJob(kind, signature);

    if (refreshedJob) {
      return NextResponse.json(refreshedJob, { headers: { "Cache-Control": "no-store" } });
    }
  }

  return NextResponse.json(job, { headers: { "Cache-Control": "no-store" } });
}
