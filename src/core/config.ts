// ---------------------------------------------------------------------------
// Config Resolver – ImgGenAI
// ---------------------------------------------------------------------------

import { ConfigError } from "../errors/index.js";
import { type ProviderName, isProviderName } from "../types/index.js";
import type { ProviderEntry } from "../types/index.js";

/** Values coming directly from CLI flags. */
export interface FlagValues {
  provider: string[];
  count?: number;
  preset?: string;
  outputDir?: string;
  json?: boolean;
  quiet?: boolean;
  debug?: boolean;
  dryRun?: boolean;
}

/** Fully resolved configuration (no optional primitives). */
export interface ResolvedConfig {
  providers: string[];
  count: number;
  preset?: string;
  outputDir: string;
  json: boolean;
  quiet: boolean;
  debug: boolean;
  dryRun: boolean;
}

// ---------------------------------------------------------------------------
// Environment variable parsers
// ---------------------------------------------------------------------------

/**
 * Parse IMGGEN_PROVIDER env var: comma-separated provider names.
 * Returns default provider when env is unset.
 */
export function parseEnvProviders(
  raw: string | undefined,
): ProviderEntry[] {
  if (!raw) return [{ name: "openai" as ProviderName }];
  return raw.split(",").map((s) => {
    const name = s.trim();
    if (!isProviderName(name)) {
      throw new ConfigError(
        `Invalid provider in IMGGEN_PROVIDER: "${name}"`,
        "Allowed: openai, recraft, imagen",
      );
    }
    return { name };
  });
}

/**
 * Parse IMGGEN_COUNT env var. Returns default (1) when env is unset.
 */
export function parseEnvCount(raw: string | undefined): number {
  if (!raw) return 1;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 10) {
    throw new ConfigError(
      `Invalid IMGGEN_COUNT: "${raw}"`,
      "Must be an integer between 1 and 10",
    );
  }
  return n;
}

/**
 * Resolve configuration using the hierarchy: flags > env > defaults.
 *
 * @param flags  - Values parsed from CLI flags.
 * @param env    - Environment variables (defaults to `process.env`).
 */
export function resolveConfig(
  flags: FlagValues,
  env: Record<string, string | undefined> = process.env,
): ResolvedConfig {
  return {
    providers:
      flags.provider.length > 0
        ? flags.provider
        : parseEnvProviders(env.IMGGEN_PROVIDER).map((e) => e.name),
    count:
      flags.count !== undefined
        ? flags.count
        : parseEnvCount(env.IMGGEN_COUNT),
    preset: flags.preset,
    outputDir: flags.outputDir ?? env.IMGGEN_OUTPUT_DIR ?? "./output",
    json: flags.json ?? false,
    quiet: flags.quiet ?? false,
    debug: flags.debug ?? false,
    dryRun: flags.dryRun ?? false,
  };
}
