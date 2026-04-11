// ---------------------------------------------------------------------------
// JSON Output – ImgGenAI
// ---------------------------------------------------------------------------

import type { PipelineResult } from "../../types/index.js";

/**
 * Print a PipelineResult as JSON to stdout.
 */
export function printJsonResult(result: PipelineResult): void {
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
