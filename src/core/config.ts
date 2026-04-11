// ---------------------------------------------------------------------------
// Config Resolver – ImgGenAI
// ---------------------------------------------------------------------------

/** Values coming directly from CLI flags. */
export interface FlagValues {
  provider: string[];
  count: number;
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
    providers: flags.provider,
    count: flags.count,
    preset: flags.preset,
    outputDir: flags.outputDir ?? env.IMGGEN_OUTPUT_DIR ?? "./output",
    json: flags.json ?? false,
    quiet: flags.quiet ?? false,
    debug: flags.debug ?? false,
    dryRun: flags.dryRun ?? false,
  };
}
