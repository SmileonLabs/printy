import "server-only";

import { spawn } from "child_process";
import type { NativeToolResult } from "@/lib/prepress/types";

const defaultTimeoutMs = 30000;

export function runNativeTool(command: string, args: string[], timeoutMs = defaultTimeoutMs): Promise<NativeToolResult> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { shell: false, windowsHide: true });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let finished = false;

    const finish = (result: NativeToolResult) => {
      if (finished) {
        return;
      }

      finished = true;
      clearTimeout(timer);
      resolve(result);
    };

    const timer = setTimeout(() => {
      child.kill();
      finish({ exitCode: null, stdout: Buffer.concat(stdout).toString("utf8"), stderr: `${Buffer.concat(stderr).toString("utf8")}\nTimed out after ${timeoutMs}ms.`.trim() });
    }, timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    child.on("error", (error) => finish({ exitCode: null, stdout: Buffer.concat(stdout).toString("utf8"), stderr: error.message }));
    child.on("close", (exitCode) => finish({ exitCode, stdout: Buffer.concat(stdout).toString("utf8"), stderr: Buffer.concat(stderr).toString("utf8") }));
  });
}
