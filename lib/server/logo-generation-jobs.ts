import "server-only";

import { randomUUID } from "crypto";
import type { PoolClient, QueryResultRow } from "pg";
import { executeLogoGeneration, invalidLogoGenerationRequestReason, LogoGenerationExecutionError, parseLogoGenerationRequest, type BrandLogoRequest } from "@/lib/server/logo-generation-executor";
import { queryDb, withDbClient } from "@/lib/server/db";
import type { LogoGenerationJobResponse, LogoGenerationJobStatus, LogoGenerationResponse } from "@/lib/types";

const maxQueuedJobsPerClientWindow = 5;
const clientRateLimitWindowMs = 10 * 60 * 1000;
const maxLogoGenerationAttempts = 2;
const runningJobTimeoutMs = 4 * 60 * 1000;
const processorBatchSize = 3;

function readPositiveIntegerEnv(name: string, fallback: number) {
  const value = Number(process.env[name]?.trim());

  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function readMaxRunningLogoGenerationJobs() {
  return readPositiveIntegerEnv("PRINTY_LOGO_GENERATION_MAX_RUNNING", 3);
}

type LogoGenerationJobRow = QueryResultRow & {
  id: string;
  status: LogoGenerationJobStatus;
  request_payload: unknown;
  result_payload: unknown;
  failure_reason: string | null;
  attempt_count?: string | number;
};

type ClaimedLogoGenerationJob = {
  id: string;
  request: BrandLogoRequest;
  attemptCount: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function getLogoGenerationClientKey(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();

  return forwardedFor || realIp || "local-dev-client";
}

async function isClientRateLimited(clientKey: string) {
  const cutoffDate = new Date(Date.now() - clientRateLimitWindowMs);
  const result = await queryDb<{ count: string }>(
    `
      select count(*)::text as count
      from logo_generation_jobs
      where client_key = $1
        and created_at >= $2
        and status <> 'cancelled'
    `,
    [clientKey, cutoffDate],
  );

  return Number(result.rows[0]?.count ?? 0) >= maxQueuedJobsPerClientWindow;
}

export async function createLogoGenerationJob(requestPayload: unknown, clientKey: string): Promise<{ jobId: string; status: "queued" }> {
  const parsed = parseLogoGenerationRequest(requestPayload);

  if (await isClientRateLimited(clientKey)) {
    throw new LogoGenerationExecutionError({ failureKind: "rate_limit", reason: "요청이 너무 많아요. 10분 정도 기다린 뒤 다시 시도해 주세요.", status: 429, retryable: true }, { failureKind: "rate_limit", errorName: "LogoGenerationClientRateLimited" });
  }

  const jobId = `logo-generation-job-${randomUUID()}`;
  await queryDb(
    `
      insert into logo_generation_jobs (id, client_key, status, mode, generation_mode, request_payload)
      values ($1, $2, 'queued', $3, $4, $5::jsonb)
    `,
    [jobId, clientKey, parsed.mode, parsed.mode === "initial" ? parsed.generationMode : null, JSON.stringify(parsed)],
  );

  return { jobId, status: "queued" };
}

function parseStoredLogoGenerationRequest(value: unknown) {
  return parseLogoGenerationRequest(value);
}

function parseStoredLogoGenerationResult(value: unknown): LogoGenerationResponse | undefined {
  if (!isRecord(value) || value.status !== "success" || !Array.isArray(value.logos)) {
    return undefined;
  }

  return {
    status: "success",
    reason: typeof value.reason === "string" ? value.reason : undefined,
    logos: value.logos.filter((logo): logo is LogoGenerationResponse["logos"][number] => isRecord(logo) && typeof logo.id === "string" && typeof logo.name === "string" && typeof logo.label === "string" && typeof logo.description === "string" && typeof logo.imageUrl === "string" && logo.source === "openai"),
  };
}

export async function readLogoGenerationJob(jobId: string): Promise<LogoGenerationJobResponse | undefined> {
  const result = await queryDb<LogoGenerationJobRow>(
    `
      select id, status, request_payload, result_payload, failure_reason
      from logo_generation_jobs
      where id = $1
    `,
    [jobId],
  );
  const row = result.rows[0];

  if (!row) {
    return undefined;
  }

  if (row.status === "succeeded") {
    const resultPayload = parseStoredLogoGenerationResult(row.result_payload);

    if (resultPayload) {
      return { jobId: row.id, status: "succeeded", result: resultPayload };
    }

    return { jobId: row.id, status: "failed", reason: invalidLogoGenerationRequestReason };
  }

  if (row.status === "failed" || row.status === "cancelled") {
    return { jobId: row.id, status: row.status, reason: row.failure_reason ?? "이미지 생성 중 원인을 알 수 없는 오류가 발생했어요. 잠시 후 다시 시도해 주세요." };
  }

  return { jobId: row.id, status: row.status };
}

async function resetTimedOutRunningJobs() {
  const cutoffDate = new Date(Date.now() - runningJobTimeoutMs);
  await queryDb(
    `
      update logo_generation_jobs
      set status = case when attempt_count < $2 then 'queued' else 'failed' end,
          failure_reason = case when attempt_count < $2 then failure_reason else '이미지 생성 시간이 너무 오래 걸렸어요. 잠시 후 다시 시도해 주세요.' end,
          failure_kind = case when attempt_count < $2 then failure_kind else 'timeout_network' end,
          locked_at = null,
          updated_at = now(),
          completed_at = case when attempt_count < $2 then null else now() end
      where status = 'running'
        and locked_at < $1
    `,
    [cutoffDate, maxLogoGenerationAttempts],
  );
}

async function claimNextLogoGenerationJob(client: PoolClient): Promise<ClaimedLogoGenerationJob | undefined> {
  await client.query("select pg_advisory_xact_lock(hashtext('printy_logo_generation_jobs'))");

  const runningResult = await client.query<{ count: string }>("select count(*)::text as count from logo_generation_jobs where status = 'running'");
  const runningCount = Number(runningResult.rows[0]?.count ?? 0);

  if (runningCount >= readMaxRunningLogoGenerationJobs()) {
    return undefined;
  }

  const result = await client.query<LogoGenerationJobRow>(
    `
      select id, status, request_payload, result_payload, failure_reason, attempt_count
      from logo_generation_jobs
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

  const request = parseStoredLogoGenerationRequest(row.request_payload);
  const attemptCount = Number(row.attempt_count ?? 0) + 1;

  await client.query(
    `
      update logo_generation_jobs
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

async function claimLogoGenerationJob(): Promise<ClaimedLogoGenerationJob | undefined> {
  return withDbClient(async (client) => {
    await client.query("begin");

    try {
      const job = await claimNextLogoGenerationJob(client);
      await client.query("commit");

      return job;
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
  });
}

async function markLogoGenerationJobSucceeded(jobId: string, result: LogoGenerationResponse) {
  await queryDb(
    `
      update logo_generation_jobs
      set status = 'succeeded',
          result_payload = $2::jsonb,
          failure_reason = null,
          failure_kind = null,
          locked_at = null,
          completed_at = now(),
          updated_at = now()
      where id = $1
    `,
    [jobId, JSON.stringify(result)],
  );
}

async function markLogoGenerationJobFailed(jobId: string, error: LogoGenerationExecutionError, attemptCount: number) {
  const shouldRetry = error.classification.retryable && attemptCount < maxLogoGenerationAttempts;
  await queryDb(
    `
      update logo_generation_jobs
      set status = $2,
          failure_reason = $3,
          failure_kind = $4,
          locked_at = null,
          completed_at = case when $2 = 'failed' then now() else null end,
          updated_at = now()
      where id = $1
    `,
    [jobId, shouldRetry ? "queued" : "failed", error.classification.reason, error.classification.failureKind],
  );
}

async function processClaimedLogoGenerationJob(job: ClaimedLogoGenerationJob) {
  const startedAt = Date.now();

  try {
    const result = await executeLogoGeneration(job.request);
    await markLogoGenerationJobSucceeded(job.id, result);
    console.info("Logo generation job succeeded", { jobId: job.id, elapsedMs: Date.now() - startedAt });
  } catch (error) {
    const executionError = error instanceof LogoGenerationExecutionError ? error : new LogoGenerationExecutionError({ failureKind: "unknown", reason: "이미지 생성 중 원인을 알 수 없는 오류가 발생했어요. 잠시 후 다시 시도해 주세요.", status: 502, retryable: false }, { failureKind: "unknown", errorName: error instanceof Error ? error.name : "UnknownError" });
    await markLogoGenerationJobFailed(job.id, executionError, job.attemptCount);
    console.error("Logo generation job failed", { jobId: job.id, elapsedMs: Date.now() - startedAt, ...executionError.log });
  }
}

export async function processLogoGenerationJobs() {
  await resetTimedOutRunningJobs();
  const tasks: Promise<void>[] = [];

  for (let index = 0; index < processorBatchSize; index += 1) {
    const job = await claimLogoGenerationJob();

    if (!job) {
      break;
    }

    tasks.push(processClaimedLogoGenerationJob(job));
  }

  await Promise.all(tasks);

  return { processedCount: tasks.length };
}

export function wakeLogoGenerationProcessor() {
  processLogoGenerationJobs().catch((error: unknown) => {
    console.error("Logo generation processor failed", { errorName: error instanceof Error ? error.name : "UnknownError" });
  });
}
