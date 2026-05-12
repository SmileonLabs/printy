import "server-only";

import { access } from "fs/promises";

export type PrepressConfig = {
  ghostscriptPath?: string;
  qpdfPath?: string;
  validatorCommand?: string;
  validatorArgs: string[];
  cmykIccPath?: string;
};

export const defaultGhostscriptPath = process.platform === "win32" ? "gswin64c.exe" : "gs";

export function parsePreflightArgs(value: string | undefined) {
  if (!value) {
    return [];
  }

  const args: string[] = [];
  let current = "";
  let quote: '"' | "'" | undefined;
  let escaping = false;

  for (const char of value) {
    if (escaping) {
      current += char;
      escaping = false;
      continue;
    }

    if (quote && char === "\\") {
      escaping = true;
      continue;
    }

    if ((char === '"' || char === "'") && (!quote || quote === char)) {
      quote = quote ? undefined : char;
      continue;
    }

    if (!quote && /\s/.test(char)) {
      if (current.length > 0) {
        args.push(current);
        current = "";
      }
      continue;
    }

    current += char;
  }

  if (escaping) {
    current += "\\";
  }

  if (current.length > 0) {
    args.push(current);
  }

  return args;
}

async function fileExists(filePath: string | undefined) {
  if (!filePath) {
    return false;
  }

  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function readPrepressConfig(): Promise<PrepressConfig> {
  const configuredGhostscriptPath = process.env.PRINTY_GHOSTSCRIPT_PATH?.trim();
  const configuredQpdfPath = process.env.PRINTY_QPDF_PATH?.trim();
  const configuredValidatorCommand = process.env.PRINTY_PREFLIGHT_COMMAND?.trim();
  const configuredIccPath = process.env.PRINTY_CMYK_ICC_PATH?.trim();

  return {
    ghostscriptPath: configuredGhostscriptPath && (await fileExists(configuredGhostscriptPath)) ? configuredGhostscriptPath : defaultGhostscriptPath,
    qpdfPath: configuredQpdfPath && (await fileExists(configuredQpdfPath)) ? configuredQpdfPath : "qpdf",
    validatorCommand: configuredValidatorCommand && configuredValidatorCommand.length > 0 ? configuredValidatorCommand : undefined,
    validatorArgs: parsePreflightArgs(process.env.PRINTY_PREFLIGHT_ARGS),
    cmykIccPath: configuredIccPath && (await fileExists(configuredIccPath)) ? configuredIccPath : undefined,
  };
}
