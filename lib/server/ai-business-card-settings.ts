import "server-only";

import { randomUUID } from "crypto";
import { withDbClient } from "@/lib/server/db";

const promptSettingsKey = "ai-business-card-prompts";
const maxPromptHistoryItems = 20;

export type AiBusinessCardPromptVersion = {
  id: string;
  mockupInstructions: string;
  cleanInstructions: string;
  createdAt: string;
};

export type AiBusinessCardPromptSettings = {
  mockupInstructions: string;
  cleanInstructions: string;
  history: AiBusinessCardPromptVersion[];
  updatedAt?: string;
};

type SettingsRow = {
  payload: unknown;
  updated_at: Date;
};

const emptyPromptSettings: AiBusinessCardPromptSettings = {
  mockupInstructions: "",
  cleanInstructions: "",
  history: [],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readString(value: Record<string, unknown>, key: string) {
  const field = value[key];

  return typeof field === "string" ? field : "";
}

function readPromptVersion(value: unknown): AiBusinessCardPromptVersion | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const id = readString(value, "id").trim();
  const createdAt = readString(value, "createdAt").trim();

  if (!id || !createdAt) {
    return undefined;
  }

  return {
    id,
    mockupInstructions: readString(value, "mockupInstructions").trim(),
    cleanInstructions: readString(value, "cleanInstructions").trim(),
    createdAt,
  };
}

export function readAiBusinessCardPromptSettings(value: unknown): AiBusinessCardPromptSettings | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const history = Array.isArray(value.history) ? value.history.map(readPromptVersion).filter((item): item is AiBusinessCardPromptVersion => Boolean(item)) : [];

  return {
    mockupInstructions: readString(value, "mockupInstructions").trim(),
    cleanInstructions: readString(value, "cleanInstructions").trim(),
    history,
    updatedAt: readString(value, "updatedAt").trim() || undefined,
  };
}

export async function getAiBusinessCardPromptSettings(): Promise<AiBusinessCardPromptSettings> {
  return withDbClient(async (client) => {
    const result = await client.query<SettingsRow>("select payload, updated_at from admin_settings where key = $1", [promptSettingsKey]);
    const row = result.rows[0];
    const settings = readAiBusinessCardPromptSettings(row?.payload) ?? emptyPromptSettings;

    return { ...settings, updatedAt: row?.updated_at.toISOString() };
  });
}

export async function saveAiBusinessCardPromptSettings(settings: AiBusinessCardPromptSettings): Promise<AiBusinessCardPromptSettings> {
  return withDbClient(async (client) => {
    const currentResult = await client.query<SettingsRow>("select payload, updated_at from admin_settings where key = $1", [promptSettingsKey]);
    const currentRow = currentResult.rows[0];
    const current = readAiBusinessCardPromptSettings(currentRow?.payload) ?? emptyPromptSettings;
    const currentChanged = current.mockupInstructions !== settings.mockupInstructions.trim() || current.cleanInstructions !== settings.cleanInstructions.trim();
    const now = new Date().toISOString();
    const previousVersion = currentChanged && (current.mockupInstructions || current.cleanInstructions || currentRow)
      ? [{ id: `ai-business-card-prompt-${randomUUID()}`, mockupInstructions: current.mockupInstructions, cleanInstructions: current.cleanInstructions, createdAt: currentRow?.updated_at.toISOString() ?? now }]
      : [];
    const payload: AiBusinessCardPromptSettings = {
      mockupInstructions: settings.mockupInstructions.trim(),
      cleanInstructions: settings.cleanInstructions.trim(),
      history: [...previousVersion, ...current.history].slice(0, maxPromptHistoryItems),
      updatedAt: now,
    };
    const result = await client.query<SettingsRow>(
      `
        insert into admin_settings (key, payload)
        values ($1, $2::jsonb)
        on conflict (key)
        do update set payload = excluded.payload, updated_at = now()
        returning payload, updated_at
      `,
      [promptSettingsKey, JSON.stringify(payload)],
    );
    const saved = readAiBusinessCardPromptSettings(result.rows[0]?.payload) ?? emptyPromptSettings;

    return { ...saved, updatedAt: result.rows[0]?.updated_at.toISOString() };
  });
}

export async function rollbackAiBusinessCardPromptSettings(versionId: string): Promise<AiBusinessCardPromptSettings | undefined> {
  return withDbClient(async (client) => {
    const currentResult = await client.query<SettingsRow>("select payload, updated_at from admin_settings where key = $1", [promptSettingsKey]);
    const currentRow = currentResult.rows[0];
    const current = readAiBusinessCardPromptSettings(currentRow?.payload) ?? emptyPromptSettings;
    const selectedVersion = current.history.find((version) => version.id === versionId);

    if (!selectedVersion) {
      return undefined;
    }

    const now = new Date().toISOString();
    const currentVersion: AiBusinessCardPromptVersion = {
      id: `ai-business-card-prompt-${randomUUID()}`,
      mockupInstructions: current.mockupInstructions,
      cleanInstructions: current.cleanInstructions,
      createdAt: currentRow?.updated_at.toISOString() ?? now,
    };
    const payload: AiBusinessCardPromptSettings = {
      mockupInstructions: selectedVersion.mockupInstructions,
      cleanInstructions: selectedVersion.cleanInstructions,
      history: [currentVersion, ...current.history.filter((version) => version.id !== selectedVersion.id)].slice(0, maxPromptHistoryItems),
      updatedAt: now,
    };
    const result = await client.query<SettingsRow>(
      `
        insert into admin_settings (key, payload)
        values ($1, $2::jsonb)
        on conflict (key)
        do update set payload = excluded.payload, updated_at = now()
        returning payload, updated_at
      `,
      [promptSettingsKey, JSON.stringify(payload)],
    );
    const saved = readAiBusinessCardPromptSettings(result.rows[0]?.payload) ?? emptyPromptSettings;

    return { ...saved, updatedAt: result.rows[0]?.updated_at.toISOString() };
  });
}
