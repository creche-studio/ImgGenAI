// ---------------------------------------------------------------------------
// generate command – ImgGenAI
// ---------------------------------------------------------------------------

import * as readline from "node:readline";
import { resolveConfig } from "../../core/config.js";
import type { FlagValues } from "../../core/config.js";
import { createPipeline } from "../../core/index.js";
import { AppError, ConfigError, ValidationError } from "../../errors/index.js";
import { BUILTIN_PROVIDER_DEFS } from "../../providers/index.js";
import type {
  PipelineInput,
  PipelineResult,
  ProviderEntry,
  ProviderName,
} from "../../types/index.js";
import { isProviderName } from "../../types/index.js";
import { DEFAULT_TIER, isTier, resolveTier } from "../aliases.js";
import type { Tier } from "../aliases.js";
import {
  printDryRun,
  printGeneratingHeader,
  printResult,
} from "../output/human.js";
import { printJsonError, printJsonResult } from "../output/json.js";

export interface GenerateFlags {
  provider: string[];
  count?: number;
  preset?: string;
  size?: string;
  output?: string;
  json?: boolean;
  quiet?: boolean;
  debug?: boolean;
  dryRun?: boolean;
  tier?: string;
  model?: string;
  quality?: string;
  vector?: boolean;
}

function parseCount(raw: number | undefined): number | undefined {
  if (raw === undefined) return undefined;
  if (!Number.isInteger(raw) || raw < 1 || raw > 10) {
    throw new ValidationError(
      `Invalid --count: "${raw}"`,
      "Must be an integer between 1 and 10",
    );
  }
  return raw;
}

function validateProviderName(name: string): ProviderName {
  if (!isProviderName(name)) {
    throw new ValidationError(
      `Unknown provider: "${name}"`,
      "Allowed providers: openai, recraft, gemini",
    );
  }
  return name;
}

function buildFlagValues(flags: GenerateFlags): FlagValues {
  return {
    provider: flags.provider,
    ...(flags.count !== undefined ? { count: flags.count } : {}),
    preset: flags.preset,
    outputDir: flags.output,
    json: flags.json,
    quiet: flags.quiet,
    debug: flags.debug,
    dryRun: flags.dryRun,
    model: flags.model,
    quality: flags.quality,
    tier: flags.tier,
    vector: flags.vector,
  };
}

/**
 * Resolve CLI flags into ProviderEntry[] with model/quality populated.
 *
 * Validation rules (§2-2):
 * - --tier + --model → ValidationError
 * - Unknown --tier value → ValidationError
 * - --quality on quality-unsupported providers only → ValidationError
 */
export function resolveProviderEntries(
  providerNames: ProviderName[],
  flags: GenerateFlags,
  providerQualities: Record<string, readonly string[] | undefined>,
): ProviderEntry[] {
  // --tier and --model are mutually exclusive
  if (flags.tier !== undefined && flags.model !== undefined) {
    throw new ValidationError(
      "--tier and --model cannot be used together",
      "Pick one: --tier <premium|standard|economy> or --model <internal-name>",
    );
  }

  // Validate --tier value
  if (flags.tier !== undefined && !isTier(flags.tier)) {
    throw new ValidationError(
      `Invalid --tier: "${flags.tier}"`,
      "Allowed: premium, standard, economy",
    );
  }

  const tier: Tier | undefined = flags.tier as Tier | undefined;
  const vector = flags.vector ?? false;

  const entries: ProviderEntry[] = providerNames.map((name) => {
    const modelId =
      flags.model ?? resolveTier(name, tier ?? DEFAULT_TIER, vector);
    const qualities = providerQualities[name];
    const qualityVal = qualities ? flags.quality : undefined;
    return {
      name,
      ...(modelId !== undefined ? { model: modelId } : {}),
      ...(qualityVal !== undefined ? { quality: qualityVal } : {}),
    };
  });

  // --quality specified but no provider supports it → ValidationError
  if (flags.quality !== undefined) {
    const anySupports = providerNames.some(
      (name) => providerQualities[name] !== undefined,
    );
    if (!anySupports) {
      throw new ValidationError(
        "--quality is not supported by any of the specified providers",
        "Only openai accepts --quality; drop the flag or add `-p openai`",
      );
    }
  }

  return entries;
}

/**
 * Known provider quality support. Used by CLI layer to determine whether
 * --quality should be forwarded to a given provider.
 */
const PROVIDER_QUALITIES: Record<string, readonly string[] | undefined> =
  Object.fromEntries(BUILTIN_PROVIDER_DEFS.map((d) => [d.name, d.qualities]));

async function executeForPrompt(
  prompt: string,
  flags: GenerateFlags,
): Promise<PipelineResult> {
  // Validate --count flag early (CLI layer), before resolveConfig
  parseCount(flags.count);

  const config = resolveConfig(buildFlagValues(flags));
  const pipeline = createPipeline();

  // Parse --size WxH into { width, height }
  let sizeOption: { width: number; height: number } | undefined;
  if (flags.size) {
    const match = flags.size.match(/^(\d+)x(\d+)$/);
    if (!match) {
      throw new ValidationError(
        `Invalid size format: "${flags.size}"`,
        "Use WxH format, e.g. --size 1024x1024",
      );
    }
    const width = Number(match[1]);
    const height = Number(match[2]);
    if (width <= 0 || height <= 0 || width > 8192 || height > 8192) {
      throw new ValidationError(
        `Invalid size value: "${flags.size}"`,
        "Width and height must be between 1 and 8192",
      );
    }
    sizeOption = { width, height };
  }

  // Validate provider names early (CLI layer)
  const providerNames = config.providers.map((name) =>
    validateProviderName(name),
  );

  // Resolve provider entries with model/quality from --tier/--model/--quality/--vector
  const providers = resolveProviderEntries(
    providerNames,
    flags,
    PROVIDER_QUALITIES,
  );

  const input: PipelineInput = {
    prompt,
    providers,
    preset: config.preset,
    outputDir: config.outputDir !== "./output" ? config.outputDir : undefined,
    options: {
      count: config.count,
      size: sizeOption,
    },
  };

  if (config.dryRun) {
    const result = await pipeline.execute(input, { dryRun: true });
    if (!config.json) {
      printDryRun(prompt, providers, config.count, config.preset, result);
    } else {
      printJsonResult(result);
    }
    return result;
  }

  if (!config.quiet && !config.json) {
    printGeneratingHeader(providers, config.count);
  }

  const result = await pipeline.execute(input);

  if (config.json || !process.stdout.isTTY) {
    printJsonResult(result);
  } else {
    printResult(result);
  }

  return result;
}

function computeExitCode(results: PipelineResult[]): number {
  const allSuccess = results.every((r) => r.success);
  if (allSuccess) return 0;

  const allFailed = results.every((r) => r.results.every((pr) => !pr.success));
  if (allFailed) return 2;

  return 1;
}

export async function runGenerate(
  promptArg: string | undefined,
  flags: GenerateFlags,
): Promise<number> {
  try {
    // Pipe mode: read prompts from stdin
    if (!process.stdin.isTTY && !promptArg) {
      const results: PipelineResult[] = [];
      const rl = readline.createInterface({ input: process.stdin });

      for await (const line of rl) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const result = await executeForPrompt(trimmed, flags);
        results.push(result);
      }

      if (results.length === 0) {
        process.stderr.write("No prompts received from stdin.\n");
        return 3;
      }

      return computeExitCode(results);
    }

    // TTY + no prompt: handled by caller (show help)
    if (!promptArg) {
      return 3;
    }

    const result = await executeForPrompt(promptArg, flags);
    return computeExitCode([result]);
  } catch (error) {
    const isJson = flags.json || !process.stdout.isTTY;

    if (error instanceof ValidationError) {
      if (isJson) {
        printJsonError(error);
      } else {
        process.stderr.write(`\u2717 ${error.message}\n`);
        if (error.hint) {
          process.stderr.write(`  ${error.hint}\n`);
        }
        if (flags.debug && error.stack) {
          process.stderr.write(`\n${error.stack}\n`);
        }
      }
      return 3;
    }
    if (error instanceof ConfigError) {
      if (isJson) {
        printJsonError(error);
      } else {
        process.stderr.write(`\u2717 ${error.name}: ${error.message}\n`);
        if (error.hint) {
          process.stderr.write(`\n  ${error.hint}\n`);
        }
        if (flags.debug && error.stack) {
          process.stderr.write(`\n${error.stack}\n`);
        }
      }
      return 4;
    }
    if (error instanceof AppError) {
      if (isJson) {
        printJsonError(error);
      } else {
        process.stderr.write(`\u2717 ${error.name}: ${error.message}\n`);
        if (error.hint) {
          process.stderr.write(`  ${error.hint}\n`);
        }
        if (flags.debug && error.stack) {
          process.stderr.write(`\n${error.stack}\n`);
        }
      }
      return 2;
    }

    // Unexpected error
    const msg = error instanceof Error ? error.message : String(error);
    if (isJson) {
      printJsonError(new AppError(msg));
    } else {
      process.stderr.write(`\u2717 Unexpected error: ${msg}\n`);
      if (flags.debug && error instanceof Error && error.stack) {
        process.stderr.write(`\n${error.stack}\n`);
      }
    }
    return 2;
  }
}
