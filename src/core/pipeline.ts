// ---------------------------------------------------------------------------
// Pipeline – ImgGenAI
// ---------------------------------------------------------------------------

import { ValidationError } from "../errors/index.js";
import type { record as RecordFn } from "../manifest/index.js";
import type { PresetRegistry } from "../presets/registry.js";
import type { ProviderRegistry } from "../providers/registry.js";
import type {
  ManifestEntry,
  PipelineInput,
  PipelineResult,
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

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

export class Pipeline {
  constructor(
    private readonly providerRegistry: ProviderRegistry,
    private readonly presetRegistry: PresetRegistry,
    private readonly manifestRecorder: typeof RecordFn,
    private readonly outputWriter: OutputWriter,
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

    // 3. Dry-run: validate provider names only
    if (options?.dryRun) {
      for (const pe of input.providers) {
        if (!this.providerRegistry.has(pe.name)) {
          throw new ValidationError(`Unknown provider: "${pe.name}"`);
        }
      }

      const outputDir =
        input.outputDir ?? `${slugify(input.prompt)}_${formatTimestamp()}`;

      return {
        success: true,
        outputDir,
        results: input.providers.map((pe) => ({
          provider: pe.name,
          model: pe.model ?? "",
          success: true,
          outputs: [],
          duration: 0,
          cost: null,
        })),
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
        const start = Date.now();
        const result = await provider.generate({
          prompt: input.prompt,
          count,
          size,
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

        // Manifest
        const manifestEntry: ManifestEntry = {
          timestamp: formatTimestamp(),
          provider: entry.name,
          prompt: input.prompt,
          params: { count, size },
          outputs,
          duration,
          cost: null,
        };
        await this.manifestRecorder(manifestEntry, outputDir);

        const model = entry.model ?? provider.models[0] ?? "";

        return {
          provider: entry.name,
          model,
          success: true,
          outputs,
          duration,
          cost: null,
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

    return {
      success: allSuccess,
      outputDir,
      results,
    };
  }
}
