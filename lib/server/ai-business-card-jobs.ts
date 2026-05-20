import "server-only";

import { randomUUID } from "crypto";
import type { PoolClient, QueryResultRow } from "pg";
import { generateAiBusinessCardMockups, type AiBusinessCardMockup } from "@/lib/ai-business-card/mockups";
import { generateAiBusinessCardPdf } from "@/lib/ai-business-card/pdf";
import { readAiBusinessCardInput } from "@/lib/ai-business-card/request";
import { validateAiBusinessCardDesign } from "@/lib/ai-business-card/schema";
import { isPublishedBusinessCardTemplate } from "@/lib/business-card-templates";
import { queryDb, withDbClient } from "@/lib/server/db";
import { getAdminBusinessCardTemplate } from "@/lib/server/business-card-template-store";
import type { PrintTemplate } from "@/lib/types";

type AiBusinessCardJobKind = "mockups" | "pdf";
type AiBusinessCardJobStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled";

type AiBusinessCardJobRow = QueryResultRow & {
  id: string;
  kind: AiBusinessCardJobKind;
  status: AiBusinessCardJobStatus;
  request_payload: unknown;
  result_payload: unknown;
  failure_reason: string | null;
  attempt_count?: string | number;
};

type ClaimedAiBusinessCardJob = {
  id: string;
  kind: AiBusinessCardJobKind;
  requestPayload: Record<string, unknown>;
  attemptCount: number;
};

export type AiBusinessCardJobResponse =
  | { jobId: string; kind: AiBusinessCardJobKind; status: "queued" | "running" }
  | { jobId: string; kind: "mockups"; status: "succeeded"; mockups: AiBusinessCardMockup[] }
  | { jobId: string; kind: "pdf"; status: "succeeded"; fileName: string; contentType: "application/pdf"; base64: string }
  | { jobId: string; kind: AiBusinessCardJobKind; status: "failed" | "cancelled"; reason: string };

const maxQueuedJobsPerClientWindow = 8;
const clientRateLimitWindowMs = 10 * 60 * 1000;
const maxAttempts = 2;
const runningJobTimeoutMs = 10 * 60 * 1000;
const processorBatchSize = 2;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readCount(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 1;
}

function readMockups(value: unknown): AiBusinessCardMockup[] {
  if (!isRecord(value) || !Array.isArray(value.mockups)) {
    return [];
  }

  return value.mockups.filter((item): item is AiBusinessCardMockup => isRecord(item) && typeof item.id === "string" && typeof item.imageUrl === "string" && typeof item.cleanImageUrl === "string" && typeof item.title === "string");
}

function readPdfResult(value: unknown) {
  if (!isRecord(value) || typeof value.fileName !== "string" || typeof value.base64 !== "string") {
    return undefined;
  }

  return { fileName: value.fileName, contentType: "application/pdf" as const, base64: value.base64 };
}

export function getAiBusinessCardClientKey(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();

  return forwardedFor || realIp || "local-dev-client";
}

async function isClientRateLimited(clientKey: string) {
  const cutoffDate = new Date(Date.now() - clientRateLimitWindowMs);
  const result = await queryDb<{ count: string }>(
    `
      select count(*)::text as count
      from ai_business_card_jobs
      where client_key = $1
        and created_at >= $2
        and status <> 'cancelled'
    `,
    [clientKey, cutoffDate],
  );

  return Number(result.rows[0]?.count ?? 0) >= maxQueuedJobsPerClientWindow;
}

export async function createAiBusinessCardJob(kind: AiBusinessCardJobKind, requestPayload: unknown, clientKey: string, dedupeKey: string) {
  if (!isRecord(requestPayload) || !readAiBusinessCardInput(requestPayload)) {
    throw new Error(kind === "pdf" ? "명함 PDF에 넣을 브랜드와 구성원 정보를 확인해 주세요." : "명함에 넣을 브랜드와 구성원 정보를 확인해 주세요.");
  }

  if (kind === "pdf" && !validateAiBusinessCardDesign(requestPayload.design)) {
    throw new Error("선택 목업으로 만든 인쇄용 레이아웃을 확인해 주세요.");
  }

  if (await isClientRateLimited(clientKey)) {
    throw new Error("AI 명함 생성 요청이 너무 많아요. 잠시 후 다시 시도해 주세요.");
  }

  const reusable = await findLatestAiBusinessCardJob(kind, dedupeKey);

  if (reusable && reusable.status !== "failed" && reusable.status !== "cancelled") {
    return reusable;
  }

  const jobId = `ai-business-card-${kind}-job-${randomUUID()}`;
  await queryDb(
    `
      insert into ai_business_card_jobs (id, kind, dedupe_key, client_key, status, request_payload)
      values ($1, $2, $3, $4, 'queued', $5::jsonb)
    `,
    [jobId, kind, dedupeKey, clientKey, JSON.stringify(requestPayload)],
  );

  return { jobId, status: "queued" as const };
}

export async function readAiBusinessCardJob(jobId: string): Promise<AiBusinessCardJobResponse | undefined> {
  const result = await queryDb<AiBusinessCardJobRow>(
    `select id, kind, status, request_payload, result_payload, failure_reason from ai_business_card_jobs where id = $1`,
    [jobId],
  );
  const row = result.rows[0];

  if (!row) {
    return undefined;
  }

  return jobResponseFromRow(row);
}

export async function findLatestAiBusinessCardJob(kind: AiBusinessCardJobKind, dedupeKey: string): Promise<AiBusinessCardJobResponse | undefined> {
  const result = await queryDb<AiBusinessCardJobRow>(
    `
      select id, kind, status, request_payload, result_payload, failure_reason
      from ai_business_card_jobs
      where kind = $1 and dedupe_key = $2
      order by created_at desc
      limit 1
    `,
    [kind, dedupeKey],
  );
  const row = result.rows[0];

  return row ? jobResponseFromRow(row) : undefined;
}

function jobResponseFromRow(row: AiBusinessCardJobRow): AiBusinessCardJobResponse {
  if (row.status === "succeeded" && row.kind === "mockups") {
    return { jobId: row.id, kind: "mockups", status: "succeeded", mockups: readMockups(row.result_payload) };
  }

  if (row.status === "succeeded" && row.kind === "pdf") {
    const pdf = readPdfResult(row.result_payload);

    return pdf ? { jobId: row.id, kind: "pdf", status: "succeeded", ...pdf } : { jobId: row.id, kind: row.kind, status: "failed", reason: "PDF 생성 결과가 올바르지 않아요." };
  }

  if (row.status === "failed" || row.status === "cancelled") {
    return { jobId: row.id, kind: row.kind, status: row.status, reason: row.failure_reason ?? "AI 명함 작업을 완료하지 못했어요. 잠시 후 다시 시도해 주세요." };
  }

  if (row.status === "succeeded") {
    return { jobId: row.id, kind: row.kind, status: "failed", reason: "AI 명함 작업 결과가 올바르지 않아요." };
  }

  return { jobId: row.id, kind: row.kind, status: row.status };
}

async function resetTimedOutRunningJobs() {
  const cutoffDate = new Date(Date.now() - runningJobTimeoutMs);
  await queryDb(
    `
      update ai_business_card_jobs
      set status = case when attempt_count < $2 then 'queued' else 'failed' end,
          failure_reason = case when attempt_count < $2 then failure_reason else 'AI 명함 작업 시간이 너무 오래 걸렸어요. 잠시 후 다시 시도해 주세요.' end,
          failure_kind = case when attempt_count < $2 then failure_kind else 'timeout_network' end,
          locked_at = null,
          updated_at = now(),
          completed_at = case when attempt_count < $2 then null else now() end
      where status = 'running'
        and locked_at < $1
    `,
    [cutoffDate, maxAttempts],
  );
}

async function claimNextAiBusinessCardJob(client: PoolClient): Promise<ClaimedAiBusinessCardJob | undefined> {
  await client.query("select pg_advisory_xact_lock(hashtext('printy_ai_business_card_jobs'))");

  const runningResult = await client.query<{ count: string }>("select count(*)::text as count from ai_business_card_jobs where status = 'running'");
  if (Number(runningResult.rows[0]?.count ?? 0) >= processorBatchSize) {
    return undefined;
  }

  const result = await client.query<AiBusinessCardJobRow>(
    `
      select id, kind, status, request_payload, result_payload, failure_reason, attempt_count
      from ai_business_card_jobs
      where status = 'queued'
      order by created_at asc
      limit 1
      for update skip locked
    `,
  );
  const row = result.rows[0];

  if (!row || !isRecord(row.request_payload)) {
    return undefined;
  }

  const attemptCount = Number(row.attempt_count ?? 0) + 1;

  await client.query(
    `
      update ai_business_card_jobs
      set status = 'running',
          attempt_count = $2,
          locked_at = now(),
          started_at = coalesce(started_at, now()),
          updated_at = now()
      where id = $1
    `,
    [row.id, attemptCount],
  );

  return { id: row.id, kind: row.kind, requestPayload: row.request_payload, attemptCount };
}

async function claimAiBusinessCardJob(): Promise<ClaimedAiBusinessCardJob | undefined> {
  return withDbClient(async (client) => {
    await client.query("begin");

    try {
      const job = await claimNextAiBusinessCardJob(client);
      await client.query("commit");

      return job;
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
  });
}

async function markAiBusinessCardJobSucceeded(jobId: string, resultPayload: unknown) {
  await queryDb(
    `
      update ai_business_card_jobs
      set status = 'succeeded',
          result_payload = $2::jsonb,
          failure_reason = null,
          failure_kind = null,
          locked_at = null,
          completed_at = now(),
          updated_at = now()
      where id = $1
    `,
    [jobId, JSON.stringify(resultPayload)],
  );
}

async function markAiBusinessCardJobFailed(jobId: string, reason: string, attemptCount: number) {
  const shouldRetry = attemptCount < maxAttempts;
  await queryDb(
    `
      update ai_business_card_jobs
      set status = $2,
          failure_reason = $3,
          failure_kind = 'ai_business_card_generation_failed',
          locked_at = null,
          completed_at = case when $2 = 'failed' then now() else null end,
          updated_at = now()
      where id = $1
    `,
    [jobId, shouldRetry ? "queued" : "failed", reason],
  );
}

async function processClaimedAiBusinessCardJob(job: ClaimedAiBusinessCardJob) {
  try {
    const input = readAiBusinessCardInput(job.requestPayload);

    if (!input) {
      throw new Error("명함에 넣을 브랜드와 구성원 정보를 확인해 주세요.");
    }

    if (job.kind === "mockups") {
      const template = input.templateId ? await getAdminBusinessCardTemplate(input.templateId) : undefined;

      if (template && !isPublishedBusinessCardTemplate(template)) {
        throw new Error("선택한 관리자 명함 템플릿을 찾지 못했어요. 명함 탭에서 다시 제작해 주세요.");
      }

      const layoutTemplate: PrintTemplate | undefined = template ?? (input.productionOptions?.layout ? { id: "system-business-card-layout", productId: "business-card", title: "시스템 생성 명함 레이아웃", summary: "사용자 선택 요소로 만든 레이아웃", tags: ["명함"], orientation: "horizontal", status: "published", source: "admin", layout: input.productionOptions.layout, createdAt: new Date().toISOString() } : undefined);
      const mockups = await generateAiBusinessCardMockups(input, readCount(job.requestPayload.count), layoutTemplate);
      await markAiBusinessCardJobSucceeded(job.id, { mockups });
      return;
    }

    const design = validateAiBusinessCardDesign(job.requestPayload.design);

    if (!design) {
      throw new Error("선택 목업으로 만든 인쇄용 레이아웃을 확인해 주세요.");
    }

    const pdf = await generateAiBusinessCardPdf(design, input, {
      origin: readString(job.requestPayload.origin) || undefined,
      includeProductionMarks: false,
      mockupImageUrl: readString(job.requestPayload.mockupImageUrl) || undefined,
      cleanMockupImageUrl: readString(job.requestPayload.cleanMockupImageUrl) || undefined,
    });

    await markAiBusinessCardJobSucceeded(job.id, { fileName: pdf.fileName, base64: Buffer.from(pdf.bytes).toString("base64") });
  } catch (error) {
    await markAiBusinessCardJobFailed(job.id, error instanceof Error ? error.message : "AI 명함 작업을 완료하지 못했어요. 잠시 후 다시 시도해 주세요.", job.attemptCount);
  }
}

export async function processAiBusinessCardJobs() {
  await resetTimedOutRunningJobs();
  const tasks: Promise<void>[] = [];

  for (let index = 0; index < processorBatchSize; index += 1) {
    const job = await claimAiBusinessCardJob();

    if (!job) {
      break;
    }

    tasks.push(processClaimedAiBusinessCardJob(job));
  }

  await Promise.all(tasks);

  return { processedCount: tasks.length };
}

export function wakeAiBusinessCardProcessor() {
  processAiBusinessCardJobs().catch((error: unknown) => {
    console.error("AI business card processor failed", { errorName: error instanceof Error ? error.name : "UnknownError" });
  });
}
