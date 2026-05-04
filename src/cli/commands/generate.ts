// ---------------------------------------------------------------------------
// generate command – ImgGenAI
// ---------------------------------------------------------------------------

import * as readline from "node:readline";
import { resolveConfig } from "../../core/config.js";
import type { FlagValues } from "../../core/config.js";
import { createPipeline } from "../../core/index.js";
import { AppError, ConfigError, ValidationError } from "../../errors/index.js";
import type { PipelineInput, PipelineResult, ProviderName } from "../../types/index.js";
import { isProviderName } from "../../types/index.js";
import {
  printDryRun,
  printGeneratingHeader,
  printResult,
} from "../output/human.js";
import { printJsonResult } from "../output/json.js";

export interface GenerateFlags {
  provider: string[];
  count: number;
  preset?: string;
  size?: string;
  output?: string;
  json?: boolean;
  quiet?: boolean;
  debug?: boolean;
  dryRun?: boolean;
}

function parseCount(raw: number): number {
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
      "Allowed providers: openai, recraft, imagen",
    );
  }
  return name;
}

function buildFlagValues(flags: GenerateFlags): FlagValues {
  return {
    provider: flags.provider,
    count: flags.count,
    preset: flags.preset,
    outputDir: flags.output,
    json: flags.json,
    quiet: flags.quiet,
    debug: flags.debug,
    dryRun: flags.dryRun,
  };
}

async function executeForPrompt(
  prompt: string,
  flags: GenerateFlags,
): Promise<PipelineResult> {
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

  // Validate count early (CLI layer)
  parseCount(config.count);

  // Validate provider names early (CLI layer)
  const providers = config.providers.map((name) => ({
    name: validateProviderName(name),
  }));

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
      printDryRun(
        prompt,
        config.providers,
        config.count,
        config.preset,
        result.outputDir,
      );
    } else {
      printJsonResult(result);
    }
    return result;
  }

  if (!config.quiet && !config.json) {
    printGeneratingHeader(config.providers, config.count);
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
    if (error instanceof ValidationError) {
      process.stderr.write(`\u2717 ${error.message}\n`);
      if (error.hint) {
        process.stderr.write(`  ${error.hint}\n`);
      }
      if (flags.debug && error.stack) {
        process.stderr.write(`\n${error.stack}\n`);
      }
      return 3;
    }
    if (error instanceof ConfigError) {
      process.stderr.write(`\u2717 ${error.name}: ${error.message}\n`);
      if (error.hint) {
        process.stderr.write(`\n  ${error.hint}\n`);
      }
      if (flags.debug && error.stack) {
        process.stderr.write(`\n${error.stack}\n`);
      }
      return 4;
    }
    if (error instanceof AppError) {
      process.stderr.write(`\u2717 ${error.name}: ${error.message}\n`);
      if (error.hint) {
        process.stderr.write(`  ${error.hint}\n`);
      }
      if (flags.debug && error.stack) {
        process.stderr.write(`\n${error.stack}\n`);
      }
      return 2;
    }

    // Unexpected error
    const msg = error instanceof Error ? error.message : String(error);
    process.stderr.write(`\u2717 Unexpected error: ${msg}\n`);
    if (flags.debug && error instanceof Error && error.stack) {
      process.stderr.write(`\n${error.stack}\n`);
    }
    return 2;
  }
}
