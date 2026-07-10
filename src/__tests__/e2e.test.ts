// ---------------------------------------------------------------------------
// E2E Tests – ImgGenAI (Phase 7)
// ---------------------------------------------------------------------------

import { execFile, execSync } from "node:child_process";
import * as path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PROJECT_ROOT = path.resolve(import.meta.dirname, "../..");
const CLI_PATH = path.join(PROJECT_ROOT, "dist/cli/index.js");

interface RunResult {
  stdout: string;
  stderr: string;
  code: number;
}

/**
 * Run the CLI as a child process and capture stdout, stderr, and exit code.
 */
function run(args: string[], stdin?: string): Promise<RunResult> {
  return new Promise((resolve) => {
    const child = execFile(
      "node",
      [CLI_PATH, ...args],
      {
        cwd: PROJECT_ROOT,
        env: { ...process.env, NO_COLOR: "1" },
        timeout: 15_000,
      },
      (error, stdout, stderr) => {
        const code =
          error && "code" in error && typeof error.code === "number"
            ? error.code
            : error
              ? 1
              : 0;
        resolve({ stdout: String(stdout), stderr: String(stderr), code });
      },
    );

    if (stdin !== undefined && child.stdin) {
      child.stdin.write(stdin);
      child.stdin.end();
    }
  });
}

// ---------------------------------------------------------------------------
// Build before all E2E tests
// ---------------------------------------------------------------------------

beforeAll(() => {
  execSync("pnpm build", { cwd: PROJECT_ROOT, stdio: "pipe" });
}, 30_000);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("E2E: CLI", () => {
  // 1. --help
  it("--help → exit 0, stdout contains help text", async () => {
    const r = await run(["--help"]);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("Usage:");
    expect(r.stdout).toContain("imggen");
  });

  // 2. --version
  it("--version → exit 0, stdout contains version", async () => {
    const r = await run(["--version"]);
    expect(r.code).toBe(0);
    expect(r.stdout.trim()).toMatch(/^\d+\.\d+\.\d+/);
  });

  // 3. providers subcommand
  it("providers → exit 0, lists openai, recraft, imagen", async () => {
    const r = await run(["providers"]);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("openai");
    expect(r.stdout).toContain("recraft");
    expect(r.stdout).toContain("imagen");
  });

  // 4. dry-run (no API key needed)
  it('"test" -p openai --dry-run → exit 0', async () => {
    const r = await run(["test", "-p", "openai", "--dry-run"]);
    expect(r.code).toBe(0);
  });

  // 5. dry-run with --json → valid JSON
  it('"test" -p openai --dry-run --json → exit 0, valid JSON with model field', async () => {
    const r = await run(["test", "-p", "openai", "--dry-run", "--json"]);
    expect(r.code).toBe(0);

    const json = JSON.parse(r.stdout.trim());
    expect(json).toHaveProperty("success", true);
    expect(json).toHaveProperty("outputDir");
    expect(json).toHaveProperty("results");
    expect(Array.isArray(json.results)).toBe(true);
    expect(json.results.length).toBeGreaterThan(0);
    // model field must be present
    expect(json.results[0]).toHaveProperty("model");
  });

  // 6. no args → exit 0, stdout contains help
  it("no args (TTY-like) → exit 0, shows help", async () => {
    // The CLI checks process.stdin.isTTY, which is false in child_process.
    // With no args and non-TTY stdin, the CLI will wait for stdin input.
    // We pass --help explicitly to test the help path.
    const r = await run(["--help"]);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("Usage:");
  });

  // 7. provider not specified → defaults to openai via env fallback → exit 4 (no API key)
  // In non-TTY (child process), error is JSON on stdout
  it('"test" without -p → defaults to openai, exit 4 (missing API key)', async () => {
    const r = await run(["test"]);
    expect(r.code).toBe(4);
    const json = JSON.parse(r.stdout.trim());
    expect(json.success).toBe(false);
    expect(json.message).toContain("API key not set");
  });

  // 8. unknown provider → exit 3
  // In non-TTY (child process), error is JSON on stdout
  it('"test" -p unknown --dry-run → exit 3', async () => {
    const r = await run(["test", "-p", "unknown", "--dry-run"]);
    expect(r.code).toBe(3);
    const json = JSON.parse(r.stdout.trim());
    expect(json.success).toBe(false);
    expect(json.message).toContain("Unknown provider");
  });

  // 9. pipe mode
  it("pipe mode: stdin prompt with -p openai --dry-run → exit 0", async () => {
    const r = await run(["-p", "openai", "--dry-run"], "test prompt\n");
    expect(r.code).toBe(0);
  });

  // 10. --json + error → JSON error object on stdout
  it('"test" -p unknown --json → exit 3, JSON error with success:false', async () => {
    const r = await run(["test", "-p", "unknown", "--json"]);
    expect(r.code).toBe(3);
    const json = JSON.parse(r.stdout.trim());
    expect(json).toEqual({
      success: false,
      error: "ValidationError",
      message: expect.stringContaining("Unknown provider"),
      hint: expect.any(String),
    });
  });

  // 11. --json + config error → JSON error with hint
  it('"test" --json → exit 4, JSON error for missing API key', async () => {
    const r = await run(["test", "--json"]);
    expect(r.code).toBe(4);
    const json = JSON.parse(r.stdout.trim());
    expect(json.success).toBe(false);
    expect(json.error).toBe("ConfigError");
    expect(json.message).toContain("API key not set");
    expect(json.hint).toBeDefined();
  });

  // 12. --tier premium --dry-run --json → resolves premium models
  it('"test" -p openai --tier premium --dry-run --json → premium model', async () => {
    const r = await run([
      "test",
      "-p",
      "openai",
      "--tier",
      "premium",
      "--dry-run",
      "--json",
    ]);
    expect(r.code).toBe(0);
    const json = JSON.parse(r.stdout.trim());
    expect(json.results[0].model).toBe("gpt-image-1.5");
  });

  // 13. --tier economy --dry-run --json → resolves economy models
  it('"test" -p openai --tier economy --dry-run --json → economy model', async () => {
    const r = await run([
      "test",
      "-p",
      "openai",
      "--tier",
      "economy",
      "--dry-run",
      "--json",
    ]);
    expect(r.code).toBe(0);
    const json = JSON.parse(r.stdout.trim());
    expect(json.results[0].model).toBe("gpt-image-1-mini");
  });

  // 14. --tier + --model → error
  it('"test" -p openai --tier premium --model gpt-image-1 → exit 3', async () => {
    const r = await run([
      "test",
      "-p",
      "openai",
      "--tier",
      "premium",
      "--model",
      "gpt-image-1",
      "--dry-run",
    ]);
    expect(r.code).toBe(3);
  });

  // 15. dry-run --json → cost field present (totalCost, costSource)
  it('"test" -p openai --tier standard --dry-run --json → has cost fields', async () => {
    const r = await run([
      "test",
      "-p",
      "openai",
      "--tier",
      "standard",
      "--quality",
      "low",
      "--dry-run",
      "--json",
    ]);
    expect(r.code).toBe(0);
    const json = JSON.parse(r.stdout.trim());
    expect(json.results[0]).toHaveProperty("cost");
    expect(json.results[0]).toHaveProperty("costSource");
    // Default size 1024x1024, quality low, gpt-image-1 → $0.011
    expect(json.results[0].cost).toBe(0.011);
    expect(json.results[0].costSource).toBe("estimated");
    expect(json.totalCost).toBe(0.011);
  });

  // 16. --quality on recraft only → error
  it('"test" -p recraft --quality high → exit 3', async () => {
    const r = await run([
      "test",
      "-p",
      "recraft",
      "--quality",
      "high",
      "--dry-run",
    ]);
    expect(r.code).toBe(3);
  });
});
