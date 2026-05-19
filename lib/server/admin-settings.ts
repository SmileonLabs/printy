import "server-only";

import type { BankAccountSettings } from "@/lib/types";
import { withDbClient } from "@/lib/server/db";

const bankAccountSettingsKey = "bank-account";

type SettingsRow = {
  payload: unknown;
  updated_at: Date;
};

const emptyBankAccountSettings: BankAccountSettings = {
  bankName: "",
  accountNumber: "",
  accountHolder: "",
  memo: "",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readString(value: Record<string, unknown>, key: string) {
  const field = value[key];

  return typeof field === "string" ? field : "";
}

export function readBankAccountSettings(value: unknown): BankAccountSettings | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  return {
    bankName: readString(value, "bankName").trim(),
    accountNumber: readString(value, "accountNumber").trim(),
    accountHolder: readString(value, "accountHolder").trim(),
    memo: readString(value, "memo").trim(),
  };
}

export async function getBankAccountSettings(): Promise<BankAccountSettings> {
  return withDbClient(async (client) => {
    const result = await client.query<SettingsRow>("select payload, updated_at from admin_settings where key = $1", [bankAccountSettingsKey]);
    const row = result.rows[0];
    const settings = readBankAccountSettings(row?.payload);

    if (!settings) {
      return emptyBankAccountSettings;
    }

    return { ...settings, updatedAt: row.updated_at.toISOString() };
  });
}

export async function saveBankAccountSettings(settings: BankAccountSettings): Promise<BankAccountSettings> {
  const payload: BankAccountSettings = {
    bankName: settings.bankName.trim(),
    accountNumber: settings.accountNumber.trim(),
    accountHolder: settings.accountHolder.trim(),
    memo: settings.memo.trim(),
  };

  return withDbClient(async (client) => {
    const result = await client.query<SettingsRow>(
      `
        insert into admin_settings (key, payload)
        values ($1, $2::jsonb)
        on conflict (key)
        do update set payload = excluded.payload, updated_at = now()
        returning payload, updated_at
      `,
      [bankAccountSettingsKey, JSON.stringify(payload)],
    );
    const saved = readBankAccountSettings(result.rows[0]?.payload) ?? emptyBankAccountSettings;

    return { ...saved, updatedAt: result.rows[0]?.updated_at.toISOString() };
  });
}
