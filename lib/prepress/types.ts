export type PrepressStatus = "source-only" | "prepress-unavailable" | "pdfx-candidate" | "validation-failed" | "pdfx-validated";

export type PrepressCheck = {
  name: string;
  status: "passed" | "failed" | "skipped";
  message: string;
};

export type PrepressResult = {
  status: PrepressStatus;
  bytes?: Uint8Array;
  fileName: string;
  notes: string[];
  checks: PrepressCheck[];
};

export type NativeToolResult = {
  exitCode: number | null;
  stdout: string;
  stderr: string;
};
