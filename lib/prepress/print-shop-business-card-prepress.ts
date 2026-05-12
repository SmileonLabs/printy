import "server-only";

import { mkdir, readFile, rm, writeFile } from "fs/promises";
import os from "os";
import path from "path";
import type { PrintShopBusinessCardRenderData } from "@/lib/print-shop-business-card-html";
import { generatePrintShopBusinessCardPdf } from "@/lib/print-shop-business-card-pdf";
import { generateGhostscriptCmykPdfxCandidate } from "@/lib/prepress/ghostscript";
import { runNativeTool } from "@/lib/prepress/native-tool-runner";
import { defaultGhostscriptPath, readPrepressConfig } from "@/lib/prepress/prepress-config";
import type { PrepressCheck, PrepressResult } from "@/lib/prepress/types";
import type { PrintTemplate } from "@/lib/types";

type GeneratePrepressBusinessCardPdfOptions = {
  origin?: string;
  renderData?: PrintShopBusinessCardRenderData;
};

function prepressFileName(sourceFileName: string, suffix: string) {
  return sourceFileName.replace(/\.pdf$/i, `${suffix}.pdf`);
}

async function runQpdfCheck(bytes: Uint8Array, qpdfPath: string): Promise<PrepressCheck> {
  const tempDirectory = path.join(os.tmpdir(), `printy-qpdf-${process.pid}-${Date.now()}`);
  const pdfPath = path.join(tempDirectory, "candidate.pdf");

  await mkdir(tempDirectory, { recursive: true });
  await writeFile(pdfPath, bytes);

  try {
    const result = await runNativeTool(qpdfPath, ["--check", pdfPath], 30000);

    return result.exitCode === 0
      ? { name: "qpdf syntax check", status: "passed", message: "qpdf accepted the generated PDF structure." }
      : { name: "qpdf syntax check", status: "failed", message: result.stderr || result.stdout || "qpdf check failed." };
  } finally {
    await rm(tempDirectory, { recursive: true, force: true });
  }
}

async function runConfiguredValidator(bytes: Uint8Array, command: string, args: string[]): Promise<PrepressCheck> {
  const tempDirectory = path.join(os.tmpdir(), `printy-validator-${process.pid}-${Date.now()}`);
  const pdfPath = path.join(tempDirectory, "candidate.pdf");

  await mkdir(tempDirectory, { recursive: true });
  await writeFile(pdfPath, bytes);

  try {
    const resolvedArgs = args.length > 0 ? args.map((arg) => arg.replace("{pdf}", pdfPath)) : [pdfPath];
    const validatorArgs = args.length > 0 && !args.some((arg) => arg.includes("{pdf}")) ? [...resolvedArgs, pdfPath] : resolvedArgs;
    const result = await runNativeTool(command, validatorArgs, 60000);

    return result.exitCode === 0
      ? { name: "configured PDF/X preflight", status: "passed", message: "Configured validator accepted the prepress PDF." }
      : { name: "configured PDF/X preflight", status: "failed", message: result.stderr || result.stdout || "Configured validator rejected the prepress PDF." };
  } finally {
    await rm(tempDirectory, { recursive: true, force: true });
  }
}

export async function generatePrepressBusinessCardPdf(template: PrintTemplate, options: GeneratePrepressBusinessCardPdfOptions = {}): Promise<PrepressResult> {
  const sourcePdf = await generatePrintShopBusinessCardPdf(template, { origin: options.origin, includeProductionMarks: true, renderData: options.renderData });
  const config = await readPrepressConfig();
  const checks: PrepressCheck[] = [];
  const notes = [...sourcePdf.notes];

  const ghostscript = await generateGhostscriptCmykPdfxCandidate({ sourcePdfBytes: sourcePdf.bytes, ghostscriptPath: config.ghostscriptPath ?? defaultGhostscriptPath, cmykIccPath: config.cmykIccPath });

  checks.push(...ghostscript.checks);
  notes.push(...ghostscript.notes);

  if (!ghostscript.bytes) {
    return {
      status: "prepress-unavailable",
      fileName: prepressFileName(sourcePdf.fileName, "-prepress-unavailable"),
      notes: [...notes, "Install/configure Ghostscript to generate a CMYK PDF/X candidate."],
      checks,
    };
  }

  let status: PrepressResult["status"] = "pdfx-candidate";
  const qpdfCheck = await runQpdfCheck(ghostscript.bytes, config.qpdfPath ?? "qpdf");

  checks.push(qpdfCheck);

  if (qpdfCheck.status === "failed") {
    notes.push("qpdf syntax check did not pass; treat this as a failed prepress PDF.");
    status = "validation-failed";
  }

  if (config.validatorCommand) {
    const validatorCheck = await runConfiguredValidator(ghostscript.bytes, config.validatorCommand, config.validatorArgs);

    checks.push(validatorCheck);
    status = validatorCheck.status === "passed" && status !== "validation-failed" ? "pdfx-validated" : "validation-failed";
  } else {
    checks.push({ name: "PDF/X preflight validation", status: "skipped", message: "No configured PDF/X validator. This file is a CMYK/PDF-X candidate, not certified." });
    notes.push("No configured PDF/X validator passed, so this is a CMYK PDF/X candidate rather than certified PDF/X.");
  }

  return {
    status,
    bytes: status === "validation-failed" ? undefined : ghostscript.bytes,
    fileName: prepressFileName(sourcePdf.fileName, status === "pdfx-validated" ? "-pdfx-validated" : "-cmyk-pdfx-candidate"),
    notes,
    checks,
  };
}
