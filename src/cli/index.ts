#!/usr/bin/env node
// ---------------------------------------------------------------------------
// CLI Entry Point – ImgGenAI
// ---------------------------------------------------------------------------

import { createRequire } from "node:module";
import { Command } from "commander";
import { runGenerate } from "./commands/generate.js";
import type { GenerateFlags } from "./commands/generate.js";
import { runProviders } from "./commands/providers.js";

// ---------------------------------------------------------------------------
// Version
// ---------------------------------------------------------------------------

const require = createRequire(import.meta.url);
const pkg = require("../../package.json") as { version: string };

// ---------------------------------------------------------------------------
// Color handling
// ---------------------------------------------------------------------------

function shouldDisableColor(opts: { color?: boolean }): boolean {
  // --no-color flag (commander stores as `color: false`)
  if (opts.color === false) return true;
  // NO_COLOR environment variable
  if (process.env.NO_COLOR !== undefined && process.env.NO_COLOR !== "")
    return true;
  return false;
}

// ---------------------------------------------------------------------------
// Program
// ---------------------------------------------------------------------------

const program = new Command();

program
  .name("imggen")
  .version(pkg.version, "-V, --version")
  .description("AI image generation CLI")
  .option("--no-color", "Disable colors");

// ---------------------------------------------------------------------------
// generate (default subcommand)
// ---------------------------------------------------------------------------

const generateCmd = new Command("generate")
  .description("Generate images from a prompt (default command)")
  .argument("[prompt]", "Image generation prompt")
  .option("-p, --provider <name...>", "Provider (repeatable)", [])
  .option("-c, --count <n>", "Images per provider", "1")
  .option("--preset <name>", "Preset name")
  .option("-o, --output <dir>", "Output directory")
  .option("--json", "JSON output")
  .option("-q, --quiet", "Suppress non-essential output")
  .option("-d, --debug", "Show debug information")
  .option("-n, --dry-run", "Show what would be done")
  .action(
    async (prompt: string | undefined, cmdOpts: Record<string, unknown>) => {
      // Merge parent (program) options
      const parentOpts = program.opts();
      if (
        shouldDisableColor({ color: parentOpts.color as boolean | undefined })
      ) {
        process.env.NO_COLOR = "1";
      }

      const flags: GenerateFlags = {
        provider: normalizeProvider(cmdOpts.provider as string[] | string),
        count: Number(cmdOpts.count) || 1,
        preset: cmdOpts.preset as string | undefined,
        output: cmdOpts.output as string | undefined,
        json: (cmdOpts.json as boolean) ?? false,
        quiet: (cmdOpts.quiet as boolean) ?? false,
        debug: (cmdOpts.debug as boolean) ?? false,
        dryRun: (cmdOpts.dryRun as boolean) ?? false,
      };

      const code = await runGenerate(prompt, flags);
      process.exit(code);
    },
  );

program.addCommand(generateCmd, { isDefault: true });

// ---------------------------------------------------------------------------
// providers
// ---------------------------------------------------------------------------

program
  .command("providers")
  .description("List available providers")
  .option("--json", "JSON output")
  .action((cmdOpts: Record<string, unknown>) => {
    const parentOpts = program.opts();
    if (
      shouldDisableColor({ color: parentOpts.color as boolean | undefined })
    ) {
      process.env.NO_COLOR = "1";
    }
    runProviders({ json: (cmdOpts.json as boolean) ?? false });
  });

// ---------------------------------------------------------------------------
// TTY + no args → show help (don't hang)
// ---------------------------------------------------------------------------

function normalizeProvider(value: string[] | string): string[] {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") return [value];
  return [];
}

async function main(): Promise<void> {
  // TTY + no meaningful args → show help and exit 0
  if (process.stdin.isTTY && process.argv.length <= 2) {
    program.outputHelp();
    process.exit(0);
  }

  await program.parseAsync(process.argv);
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  process.stderr.write(`\u2717 Fatal: ${msg}\n`);
  process.exit(2);
});
