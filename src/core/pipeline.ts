// ---------------------------------------------------------------------------
// Pipeline – ImgGenAI
// ---------------------------------------------------------------------------

import { ValidationError } from "../errors/index.js";
import type { record as RecordFn } from "../manifest/index.js";
import type { PresetRegistry } from "../presets/registry.js";
import type { CostQuery } from "../pricing/index.js";
import type { ProviderRegistry } from "../providers/registry.js";
import type {
  BalanceInfo,
  CostSource,
  ManifestEntry,
  PipelineInput,
  PipelineResult,
  Provider,
  ProviderEntry,
  ProviderResult,
} from "../types/index.js";
import type { OutputWriter } from "./output-writer.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a URL-friendly slug from a prompt string. */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

/** Format a Date as YYYYMMDDHHmmss. */
export function formatTimestamp(date: Date = new Date()): string {
  const y = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");
  const s = String(date.getSeconds()).padStart(2, "0");
  return `${y}${mo}${d}${h}${mi}${s}`;
}

/**
 * Hybrid cost resolver: prefer actual (API-derived) cost over static estimate.
 */
function resolveCost(
  actualCost: number | null | undefined,
  staticCost: number | null,
): { cost: number | null; costSource?: CostSource } {
  if (typeof actualCost === "number" && Number.isFinite(actualCost) && actualCost > 0) {
    return { cost: actualCost, costSource: "actual" };
  }
  if (staticCost === null) return { cost: null };
  return { cost: staticCost, costSource: "estimated" };
}

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

export class Pipeline {
  constructor(
    private readonly providerRegistry: ProviderRegistry,
    private readonly presetRegistry: PresetRegistry,
    private readonly manifestRecorder: typeof RecordFn,
    private readonly outputWriter: OutputWriter,
    private readonly pricingCalculator: (query: CostQuery) => number | null = () => null,
  ) {}

  async execute(
    input: PipelineInput,
    options?: { dryRun?: boolean },
  ): Promise<PipelineResult> {
    // 1. Input validation
    if (!input.prompt || input.prompt.trim() === "") {
      throw new ValidationError("Prompt is required");
    }
    if (!input.providers || input.providers.length === 0) {
      throw new ValidationError("At least one provider is required");
    }

    // 2. Preset resolution
    let size = input.options?.size ?? { width: 1024, height: 1024 };
    if (input.preset) {
      const preset = this.presetRegistry.resolve(input.preset);
      size = preset.size;
    }

    const count = input.options?.count ?? 1;

    // 3. Dry-run: validate provider names, compute estimated cost
    if (options?.dryRun) {
      for (const pe of input.providers) {
        if (!this.providerRegistry.has(pe.name)) {
          throw new ValidationError(`Unknown provider: "${pe.name}"`);
        }
      }

      const outputDir =
        input.outputDir ?? `${slugify(input.prompt)}_${formatTimestamp()}`;

      const results: ProviderResult[] = input.providers.map((pe) => {
        // Try to resolve provider for defaultModel/defaultQuality; fall back gracefully
        let model = pe.model ?? "";
        let quality = pe.quality;
        try {
          const provider = this.providerRegistry.resolve(pe.name);
          model = pe.model ?? provider.defaultModel ?? provider.models[0];
          quality = pe.quality ?? provider.defaultQuality;
        } catch {
          // API key not set – use entry values only (best-effort in dry-run)
        }

        const staticCost = this.pricingCalculator({
          provider: pe.name,
          model,
          size,
          quality,
          count,
        });
        const { cost, costSource } = resolveCost(undefined, staticCost);
        return {
          provider: pe.name,
          model,
          quality,
          success: true,
          outputs: [],
          duration: 0,
          cost,
          costSource,
        };
      });

      const totalCost = this.computeTotalCost(results);

      return {
        success: true,
        outputDir,
        results,
        totalCost,
      };
    }

    // 4. Resolve providers + validate prompt length
    const resolvedProviders = input.providers.map((pe) => {
      const provider = this.providerRegistry.resolve(pe.name);
      if (input.prompt.length > provider.maxPromptLength) {
        throw new ValidationError(
          `Prompt too long for provider "${pe.name}": ${input.prompt.length} > ${provider.maxPromptLength}`,
        );
      }
      return { entry: pe, provider };
    });

    const outputDir =
      input.outputDir ?? `${slugify(input.prompt)}_${formatTimestamp()}`;

    // 5. Parallel execution
    const settled = await Promise.allSettled(
      resolvedProviders.map(async ({ entry, provider }) => {
        const model = entry.model ?? provider.defaultModel ?? provider.models[0];
        const quality = entry.quality ?? provider.defaultQuality;

        const start = Date.now();
        const result = await provider.generate({
          prompt: input.prompt,
          count,
          size,
          model,
          quality,
        });
        const duration = Date.now() - start;

        // Save images
        const outputs: string[] = [];
        await this.outputWriter.ensureDir(outputDir);

        for (let i = 0; i < result.images.length; i++) {
          const img = result.images[i];
          const ext = img.mimeType.split("/")[1] ?? "png";
          const filename = `${entry.name}_${i}.${ext}`;
          const filePath = await this.outputWriter.write(
            outputDir,
            filename,
            Buffer.from(img.base64, "base64"),
          );
          outputs.push(filePath);
        }

        // Cost resolution (hybrid: actual > static)
        const staticCost = this.pricingCalculator({
          provider: entry.name,
          model,
          size,
          quality,
          count,
        });
        const { cost, costSource } = resolveCost(result.actualCost, staticCost);

        // Manifest
        const manifestEntry: ManifestEntry = {
          timestamp: formatTimestamp(),
          provider: entry.name,
          prompt: input.prompt,
          params: { count, size },
          outputs,
          duration,
          cost,
          costSource,
        };
        await this.manifestRecorder(manifestEntry, outputDir);

        return {
          provider: entry.name,
          model,
          quality,
          success: true,
          outputs,
          duration,
          cost,
          costSource,
        } satisfies ProviderResult;
      }),
    );

    // 6. Aggregate results
    const results: ProviderResult[] = settled.map((s, idx) => {
      if (s.status === "fulfilled") {
        return s.value;
      }
      const entry = input.providers[idx];
      return {
        provider: entry.name,
        model: entry.model ?? "",
        success: false,
        outputs: [],
        duration: 0,
        error: s.reason instanceof Error ? s.reason.message : String(s.reason),
        cost: null,
      };
    });

    const allSuccess = results.every((r) => r.success);

    // 7. Balance resolution (best-effort, post-generate)
    const balances = await this.resolveBalances(resolvedProviders);

    const totalCost = this.computeTotalCost(results);

    return {
      success: allSuccess,
      outputDir,
      results,
      balances,
      totalCost,
    };
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private computeTotalCost(results: ProviderResult[]): number | null {
    const costsWithValues = results.filter((r) => r.cost !== null);
    if (costsWithValues.length === 0) return null;
    return costsWithValues.reduce((sum, r) => sum + r.cost!, 0);
  }

  private async resolveBalances(
    providers: Array<{ entry: ProviderEntry; provider: Provider }>,
  ): Promise<BalanceInfo[]> {
    const seen = new Set<string>();
    const tasks = providers
      .filter(({ entry }) => !seen.has(entry.name) && seen.add(entry.name))
      .map(async ({ entry, provider }) => {
        if (!provider.getBalance) return { provider: entry.name, usd: null };
        try {
          return await provider.getBalance() ?? { provider: entry.name, usd: null };
        } catch (e) {
          return { provider: entry.name, usd: null, error: (e as Error).message };
        }
      });
    return Promise.all(tasks);
  }
}
