import "server-only";

import { randomUUID } from "crypto";
import type { PoolClient, QueryResultRow } from "pg";
import { generateBrandMockup, parseBrandMockupRequest, type BrandMockupRequest } from "@/lib/server/brand-mockups";
import { queryDb, withDbClient } from "@/lib/server/db";
import type { BrandAsset } from "@/lib/types";

const maxQueuedJobsPerClientWindow = 5;
const clientRateLimitWindowMs = 10 * 60 * 1000;
const maxBrandMockupAttempts = 2;
const runningJobTimeoutMs = 6 * 60 * 1000;
const processorBatchSize = 2;

type BrandMockupJobStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled";

type BrandMockupJobRow = QueryResultRow & {
  id: string;
  status: BrandMockupJobStatus;
  request_payload: unknown;
  result_payload: unknown;
  failure_reason: string | null;
  attempt_count?: string | number;
};

type ClaimedBrandMockupJob = {
  id: string;
  request: BrandMockupRequest;
  attemptCount: number;
};

export type BrandMockupJobCreateResponse = {
  jobId: string;
  status: "queued";
};

export type BrandMockupJobResponse =
  | { jobId: string; status: "queued" | "running" }
  | { jobId: string; status: "succeeded"; asset: BrandAsset }
  | { jobId: string; status: "failed" | "cancelled"; reason: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isBrandAsset(value: unknown): value is BrandAsset {
  return isRecord(value) && typeof value.id === "string" && typeof value.brandId === "string" && typeof value.sectionId === "string" && typeof value.productId === "string" && typeof value.title === "string" && typeof value.description === "string" && typeof value.createdAt === "string" && (value.imageUrl === undefined || typeof value.imageUrl === "string") && (value.logoId === undefined || typeof value.logoId === "string");
}

export function getBrandMockupClientKey(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();

  return forwardedFor || realIp || "local-dev-client";
}

async function isClientRateLimited(clientKey: string) {
  const cutoffDate = new Date(Date.now() - clientRateLimitWindowMs);
  const result = await queryDb<{ count: string }>(
    `
      select count(*)::text as count
      from brand_mockup_jobs
      where client_key = $1
        and created_at >= $2
        and status <> 'cancelled'
    `,
    [clientKey, cutoffDate],
  );

  return Number(result.rows[0]?.count ?? 0) >= maxQueuedJobsPerClientWindow;
}

export async function createBrandMockupJob(requestPayload: unknown, clientKey: string): Promise<BrandMockupJobCreateResponse> {
  const parsed = parseBrandMockupRequest(requestPayload);

  if (await isClientRateLimited(clientKey)) {
    throw new Error("목업 생성 요청이 너무 많아요. 잠시 후 다시 시도해 주세요.");
  }

  const jobId = `brand-mockup-job-${randomUUID()}`;
  await queryDb(
    `
      insert into brand_mockup_jobs (id, client_key, status, request_payload)
      values ($1, $2, 'queued', $3::jsonb)
    `,
    [jobId, clientKey, JSON.stringify(parsed)],
  );

  return { jobId, status: "queued" };
}

export async function readBrandMockupJob(jobId: string): Promise<BrandMockupJobResponse | undefined> {
  const result = await queryDb<BrandMockupJobRow>(
    `
      select id, status, request_payload, result_payload, failure_reason
      from brand_mockup_jobs
      where id = $1
    `,
    [jobId],
  );
  const row = result.rows[0];

  if (!row) {
    return undefined;
  }

  if (row.status === "succeeded") {
    return isBrandAsset(row.result_payload) ? { jobId: row.id, status: "succeeded", asset: row.result_payload } : { jobId: row.id, status: "failed", reason: "목업 생성 결과가 올바르지 않아요." };
  }

  if (row.status === "failed" || row.status === "cancelled") {
    return { jobId: row.id, status: row.status, reason: row.failure_reason ?? "브랜드 목업을 만들지 못했어요. 잠시 후 다시 시도해 주세요." };
  }

  return { jobId: row.id, status: row.status };
}

async function resetTimedOutRunningJobs() {
  const cutoffDate = new Date(Date.now() - runningJobTimeoutMs);
  await queryDb(
    `
      update brand_mockup_jobs
      set status = case when attempt_count < $2 then 'queued' else 'failed' end,
          failure_reason = case when attempt_count < $2 then failure_reason else '목업 생성 시간이 너무 오래 걸렸어요. 잠시 후 다시 시도해 주세요.' end,
          failure_kind = case when attempt_count < $2 then failure_kind else 'timeout_network' end,
          locked_at = null,
          updated_at = now(),
          completed_at = case when attempt_count < $2 then null else now() end
      where status = 'running'
        and locked_at < $1
    `,
    [cutoffDate, maxBrandMockupAttempts],
  );
}

async function claimNextBrandMockupJob(client: PoolClient): Promise<ClaimedBrandMockupJob | undefined> {
  await client.query("select pg_advisory_xact_lock(hashtext('printy_brand_mockup_jobs'))");

  const runningResult = await client.query<{ count: string }>("select count(*)::text as count from brand_mockup_jobs where status = 'running'");
  if (Number(runningResult.rows[0]?.count ?? 0) >= processorBatchSize) {
    return undefined;
  }

  const result = await client.query<BrandMockupJobRow>(
    `
      select id, status, request_payload, result_payload, failure_reason, attempt_count
      from brand_mockup_jobs
      where status = 'queued'
      order by created_at asc
      limit 1
      for update skip locked
    `,
  );
  const row = result.rows[0];

  if (!row) {
    return undefined;
  }

  const request = parseBrandMockupRequest(row.request_payload);
  const attemptCount = Number(row.attempt_count ?? 0) + 1;

  await client.query(
    `
      update brand_mockup_jobs
      set status = 'running',
          attempt_count = $2,
          locked_at = now(),
          started_at = coalesce(started_at, now()),
          updated_at = now()
      where id = $1
    `,
    [row.id, attemptCount],
  );

  return { id: row.id, request, attemptCount };
}

async function claimBrandMockupJob(): Promise<ClaimedBrandMockupJob | undefined> {
  return withDbClient(async (client) => {
    await client.query("begin");

    try {
      const job = await claimNextBrandMockupJob(client);
      await client.query("commit");

      return job;
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
  });
}

async function markBrandMockupJobSucceeded(jobId: string, asset: BrandAsset) {
  await queryDb(
    `
      update brand_mockup_jobs
      set status = 'succeeded',
          result_payload = $2::jsonb,
          failure_reason = null,
          failure_kind = null,
          locked_at = null,
          completed_at = now(),
          updated_at = now()
      where id = $1
    `,
    [jobId, JSON.stringify(asset)],
  );
}

async function markBrandMockupJobFailed(jobId: string, reason: string, attemptCount: number) {
  const shouldRetry = attemptCount < maxBrandMockupAttempts;
  await queryDb(
    `
      update brand_mockup_jobs
      set status = $2,
          failure_reason = $3,
          failure_kind = 'mockup_generation_failed',
          locked_at = null,
          completed_at = case when $2 = 'failed' then now() else null end,
          updated_at = now()
      where id = $1
    `,
    [jobId, shouldRetry ? "queued" : "failed", reason],
  );
}

async function processClaimedBrandMockupJob(job: ClaimedBrandMockupJob) {
  try {
    const asset = await generateBrandMockup(job.request);
    await markBrandMockupJobSucceeded(job.id, asset);
  } catch {
    await markBrandMockupJobFailed(job.id, "브랜드 목업을 만들지 못했어요. 잠시 후 다시 시도해 주세요.", job.attemptCount);
  }
}

export async function processBrandMockupJobs() {
  await resetTimedOutRunningJobs();
  const tasks: Promise<void>[] = [];

  for (let index = 0; index < processorBatchSize; index += 1) {
    const job = await claimBrandMockupJob();

    if (!job) {
      break;
    }

    tasks.push(processClaimedBrandMockupJob(job));
  }

  await Promise.all(tasks);

  return { processedCount: tasks.length };
}

export function wakeBrandMockupProcessor() {
  processBrandMockupJobs().catch((error: unknown) => {
    console.error("Brand mockup processor failed", { errorName: error instanceof Error ? error.name : "UnknownError" });
  });
}
