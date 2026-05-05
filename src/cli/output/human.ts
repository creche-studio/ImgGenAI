// ---------------------------------------------------------------------------
// Human-friendly TTY Output – ImgGenAI
// ---------------------------------------------------------------------------

import type { PipelineResult, ProviderEntry, ProviderResult } from "../../types/index.js";

function formatDuration(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatCost(usd: number): string {
  return `$${usd.toFixed(usd < 0.01 ? 4 : usd < 1 ? 3 : 2)}`;
}

/**
 * Print the "Generating with ..." header to stderr.
 * Includes model and quality info per provider when available.
 */
export function printGeneratingHeader(
  providers: ProviderEntry[],
  count: number,
): void {
  const parts = providers.map((pe) => {
    const details: string[] = [];
    if (pe.model) details.push(pe.model);
    if (pe.quality) details.push(pe.quality);
    return details.length > 0
      ? `${pe.name} (${details.join(", ")})`
      : pe.name;
  });
  const suffix = count > 1 ? ` (${count} images each)` : "";
  process.stderr.write(`Generating with ${parts.join(", ")}${suffix}...\n\n`);
}

/**
 * Print a dry-run summary to stderr.
 */
export function printDryRun(
  prompt: string,
  providers: ProviderEntry[],
  count: number,
  preset: string | undefined,
  result: PipelineResult,
): void {
  process.stderr.write("Dry run — no images will be generated.\n\n");
  process.stderr.write(`  Prompt:    "${prompt}"\n`);
  const providerDescs = providers.map((pe) => {
    const details: string[] = [];
    if (pe.model) details.push(pe.model);
    if (pe.quality) details.push(pe.quality);
    return details.length > 0
      ? `${pe.name} (${details.join(", ")})`
      : pe.name;
  });
  process.stderr.write(`  Providers: ${providerDescs.join(", ")}\n`);
  process.stderr.write(`  Count:     ${count}\n`);
  if (preset) {
    process.stderr.write(`  Preset:    ${preset}\n`);
  }
  process.stderr.write(`  Output:    ${result.outputDir}\n`);

  // Cost (estimated, dry-run)
  if (result.totalCost !== undefined && result.totalCost !== null) {
    process.stderr.write(`  Cost:      ${formatCost(result.totalCost)} (estimated, no API calls made)\n`);
  }
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

  // Summary line
  const summaryParts: string[] = [];
  summaryParts.push(`Total: ${totalImages} images, ${formatDuration(maxDuration)}`);
  process.stderr.write(`\n${summaryParts.join("")}\n`);

  // Cost line
  const costLine = formatCostSummary(result);
  if (costLine) {
    process.stderr.write(`${costLine}\n`);
  }
}

function formatCostSummary(result: PipelineResult): string | null {
  const { results, balances, totalCost } = result;

  // Cost part
  let costStr: string;
  if (totalCost === undefined || totalCost === null) {
    // Check if all costs are null
    const allNull = results.every((r) => r.cost === null);
    if (allNull) {
      costStr = "Cost: N/A";
    } else {
      costStr = "Cost: N/A";
    }
  } else {
    const hasNull = results.some((r) => r.cost === null);
    costStr = hasNull
      ? `Cost: ${formatCost(totalCost)} (partial)`
      : `Cost: ${formatCost(totalCost)}`;
  }

  // Balance part
  let balanceStr = "";
  if (balances && balances.length > 0) {
    const parts = balances.map((b) => {
      return b.usd !== null ? `${b.provider} ${formatCost(b.usd)}` : `${b.provider} N/A`;
    });
    balanceStr = ` | Balance: ${parts.join(", ")}`;
  }

  return `${costStr}${balanceStr}`;
}

function printProviderResult(r: ProviderResult): void {
  if (r.success) {
    const count = r.outputs.length;
    const label = count === 1 ? "image" : "images";
    const costPart = r.cost !== null ? `  ${formatCost(r.cost)}` : "";
    process.stderr.write(
      `  ${r.provider.padEnd(8)} ✓  ${count} ${label}  ${formatDuration(r.duration)}${costPart}\n`,
    );
  } else {
    process.stderr.write(`  ${r.provider.padEnd(8)} ✗  failed`);
    if (r.error) {
      process.stderr.write(`  "${r.error}"`);
    }
    process.stderr.write("\n");
    if (r.hint) {
      process.stderr.write(`${"".padEnd(12)}  ${r.hint}\n`);
    }
  }
}
