import "server-only";

import { randomUUID } from "crypto";
import { withDbClient } from "@/lib/server/db";
import type { PrintProductProductionType } from "@/lib/types";

const promptSettingsKey = "print-product-prompts";
const maxPromptHistoryItems = 20;
const productTypes: PrintProductProductionType[] = ["banner", "signage", "flyer"];

export type PrintProductPromptVersion = {
  id: string;
  productType: PrintProductProductionType;
  mockupInstructions: string;
  cleanInstructions: string;
  editInstructions: string;
  createdAt: string;
};

export type PrintProductPromptItem = {
  mockupInstructions: string;
  cleanInstructions: string;
  editInstructions: string;
  history: PrintProductPromptVersion[];
  updatedAt?: string;
};

export type PrintProductPromptSettings = Record<PrintProductProductionType, PrintProductPromptItem>;

type SettingsRow = {
  payload: unknown;
  updated_at: Date;
};

const emptyPromptItem: PrintProductPromptItem = {
  mockupInstructions: "",
  cleanInstructions: "",
  editInstructions: "",
  history: [],
};

const emptyPromptSettings: PrintProductPromptSettings = {
  banner: emptyPromptItem,
  signage: emptyPromptItem,
  flyer: emptyPromptItem,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readString(value: Record<string, unknown>, key: string) {
  const field = value[key];

  return typeof field === "string" ? field : "";
}

function readProductType(value: unknown): PrintProductProductionType | undefined {
  return value === "banner" || value === "signage" || value === "flyer" ? value : undefined;
}

function readPromptVersion(value: unknown): PrintProductPromptVersion | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const id = readString(value, "id").trim();
  const productType = readProductType(value.productType);
  const createdAt = readString(value, "createdAt").trim();

  if (!id || !productType || !createdAt) {
    return undefined;
  }

  return {
    id,
    productType,
    mockupInstructions: readString(value, "mockupInstructions").trim(),
    cleanInstructions: readString(value, "cleanInstructions").trim(),
    editInstructions: readString(value, "editInstructions").trim(),
    createdAt,
  };
}

function readPromptItem(value: unknown, productType: PrintProductProductionType): PrintProductPromptItem {
  if (!isRecord(value)) {
    return emptyPromptItem;
  }

  const history = Array.isArray(value.history) ? value.history.map(readPromptVersion).filter((item): item is PrintProductPromptVersion => item !== undefined && item.productType === productType) : [];

  return {
    mockupInstructions: readString(value, "mockupInstructions").trim(),
    cleanInstructions: readString(value, "cleanInstructions").trim(),
    editInstructions: readString(value, "editInstructions").trim(),
    history,
    updatedAt: readString(value, "updatedAt").trim() || undefined,
  };
}

export function readPrintProductPromptSettings(value: unknown): PrintProductPromptSettings | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  return {
    banner: readPromptItem(value.banner, "banner"),
    signage: readPromptItem(value.signage, "signage"),
    flyer: readPromptItem(value.flyer, "flyer"),
  };
}

export async function getPrintProductPromptSettings(): Promise<PrintProductPromptSettings> {
  return withDbClient(async (client) => {
    const result = await client.query<SettingsRow>("select payload, updated_at from admin_settings where key = $1", [promptSettingsKey]);
    const row = result.rows[0];
    const settings = readPrintProductPromptSettings(row?.payload) ?? emptyPromptSettings;
    const updatedAt = row?.updated_at.toISOString();

    return {
      banner: { ...settings.banner, updatedAt: settings.banner.updatedAt ?? updatedAt },
      signage: { ...settings.signage, updatedAt: settings.signage.updatedAt ?? updatedAt },
      flyer: { ...settings.flyer, updatedAt: settings.flyer.updatedAt ?? updatedAt },
    };
  });
}

export async function savePrintProductPromptSettings(settings: PrintProductPromptSettings): Promise<PrintProductPromptSettings> {
  return withDbClient(async (client) => {
    const currentResult = await client.query<SettingsRow>("select payload, updated_at from admin_settings where key = $1", [promptSettingsKey]);
    const currentRow = currentResult.rows[0];
    const current = readPrintProductPromptSettings(currentRow?.payload) ?? emptyPromptSettings;
    const now = new Date().toISOString();
    const payload = productTypes.reduce<PrintProductPromptSettings>((next, productType) => {
      const previous = current[productType];
      const incoming = settings[productType];
      const changed = previous.mockupInstructions !== incoming.mockupInstructions.trim() || previous.cleanInstructions !== incoming.cleanInstructions.trim() || previous.editInstructions !== incoming.editInstructions.trim();
      const previousVersion = changed && (previous.mockupInstructions || previous.cleanInstructions || previous.editInstructions || currentRow)
        ? [{ id: `print-product-prompt-${randomUUID()}`, productType, mockupInstructions: previous.mockupInstructions, cleanInstructions: previous.cleanInstructions, editInstructions: previous.editInstructions, createdAt: previous.updatedAt ?? currentRow?.updated_at.toISOString() ?? now }]
        : [];

      return {
        ...next,
        [productType]: {
          mockupInstructions: incoming.mockupInstructions.trim(),
          cleanInstructions: incoming.cleanInstructions.trim(),
          editInstructions: incoming.editInstructions.trim(),
          history: [...previousVersion, ...previous.history].slice(0, maxPromptHistoryItems),
          updatedAt: now,
        },
      };
    }, emptyPromptSettings);
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

    return readPrintProductPromptSettings(result.rows[0]?.payload) ?? emptyPromptSettings;
  });
}

export async function rollbackPrintProductPromptSettings(productType: PrintProductProductionType, versionId: string): Promise<PrintProductPromptSettings | undefined> {
  return withDbClient(async (client) => {
    const currentResult = await client.query<SettingsRow>("select payload, updated_at from admin_settings where key = $1", [promptSettingsKey]);
    const currentRow = currentResult.rows[0];
    const current = readPrintProductPromptSettings(currentRow?.payload) ?? emptyPromptSettings;
    const selectedVersion = current[productType].history.find((version) => version.id === versionId);

    if (!selectedVersion) {
      return undefined;
    }

    const now = new Date().toISOString();
    const currentVersion: PrintProductPromptVersion = {
      id: `print-product-prompt-${randomUUID()}`,
      productType,
      mockupInstructions: current[productType].mockupInstructions,
      cleanInstructions: current[productType].cleanInstructions,
      editInstructions: current[productType].editInstructions,
      createdAt: current[productType].updatedAt ?? currentRow?.updated_at.toISOString() ?? now,
    };
    const payload: PrintProductPromptSettings = {
      ...current,
      [productType]: {
        mockupInstructions: selectedVersion.mockupInstructions,
        cleanInstructions: selectedVersion.cleanInstructions,
        editInstructions: selectedVersion.editInstructions,
        history: [currentVersion, ...current[productType].history.filter((version) => version.id !== selectedVersion.id)].slice(0, maxPromptHistoryItems),
        updatedAt: now,
      },
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

    return readPrintProductPromptSettings(result.rows[0]?.payload) ?? emptyPromptSettings;
  });
}
