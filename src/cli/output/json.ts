// ---------------------------------------------------------------------------
// JSON Output – ImgGenAI
// ---------------------------------------------------------------------------

import type { AppError } from "../../errors/index.js";
import type { PipelineResult } from "../../types/index.js";

/**
 * Print a PipelineResult as JSON to stdout.
 */
export function printJsonResult(result: PipelineResult): void {
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

interface JsonError {
  success: false;
  error: string;
  message: string;
  hint?: string;
}

/**
 * Print an error as structured JSON to stdout.
 * Used when --json is set or stdout is not a TTY (machine consumer).
 */
export function printJsonError(error: AppError): void {
  const obj: JsonError = {
    success: false,
    error: error.name,
    message: error.message,
    ...(error.hint ? { hint: error.hint } : {}),
  };
  process.stdout.write(`${JSON.stringify(obj, null, 2)}\n`);
}
