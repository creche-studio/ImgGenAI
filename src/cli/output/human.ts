// ---------------------------------------------------------------------------
// Human-friendly TTY Output – ImgGenAI
// ---------------------------------------------------------------------------

import type { PipelineResult, ProviderResult } from "../../types/index.js";

function formatDuration(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

/**
 * Print the "Generating with ..." header to stderr.
 */
export function printGeneratingHeader(
  providers: string[],
  count: number,
): void {
  const names = providers.join(", ");
  const suffix = count > 1 ? ` (${count} images each)` : "";
  process.stderr.write(`Generating with ${names}${suffix}...\n\n`);
}

/**
 * Print a dry-run summary to stderr.
 */
export function printDryRun(
  prompt: string,
  providers: string[],
  count: number,
  preset: string | undefined,
  outputDir: string,
): void {
  process.stderr.write("Dry run — no images will be generated.\n\n");
  process.stderr.write(`  Prompt:    "${prompt}"\n`);
  process.stderr.write(`  Providers: ${providers.join(", ")}\n`);
  process.stderr.write(`  Count:     ${count}\n`);
  if (preset) {
    process.stderr.write(`  Preset:    ${preset}\n`);
  }
  process.stderr.write(`  Output:    ${outputDir}\n`);
}

/**
 * Print the pipeline result in human-friendly format to stderr,
 * and output file paths to stdout.
 */
export function printResult(result: PipelineResult): void {
  let totalImages = 0;
  let maxDuration = 0;

  for (const r of result.results) {
    printProviderResult(r);
    totalImages += r.outputs.length;
    if (r.duration > maxDuration) {
      maxDuration = r.duration;
    }
  }

  process.stderr.write(`\nOutput: ${result.outputDir}/\n`);

  // List output files
  for (const r of result.results) {
    for (const output of r.outputs) {
      const filename = output.split("/").pop() ?? output;
      process.stderr.write(`  ${filename}\n`);
      // stdout: file paths only
      process.stdout.write(`${output}\n`);
    }
  }

  process.stderr.write(
    `\nTotal: ${totalImages} images, ${formatDuration(maxDuration)}\n`,
  );
}

function printProviderResult(r: ProviderResult): void {
  if (r.success) {
    const count = r.outputs.length;
    const label = count === 1 ? "image" : "images";
    process.stderr.write(
      `  ${r.provider.padEnd(8)} \u2713  ${count} ${label}  ${formatDuration(r.duration)}\n`,
    );
  } else {
    process.stderr.write(`  ${r.provider.padEnd(8)} \u2717  failed`);
    if (r.error) {
      process.stderr.write(`  "${r.error}"`);
    }
    process.stderr.write("\n");
  }
}
