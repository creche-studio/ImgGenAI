import { describe, expect, it } from "vitest";
import { type FlagValues, resolveConfig } from "../config.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function baseFlags(overrides?: Partial<FlagValues>): FlagValues {
  return {
    provider: ["openai"],
    count: 1,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("resolveConfig", () => {
  // -----------------------------------------------------------------------
  // Defaults
  // -----------------------------------------------------------------------
  it("uses default values when flags and env are absent", () => {
    const config = resolveConfig(baseFlags(), {});

    expect(config.outputDir).toBe("./output");
    expect(config.json).toBe(false);
    expect(config.quiet).toBe(false);
    expect(config.debug).toBe(false);
    expect(config.dryRun).toBe(false);
  });

  // -----------------------------------------------------------------------
  // Env fallback
  // -----------------------------------------------------------------------
  it("falls back to IMGGEN_OUTPUT_DIR from env", () => {
    const config = resolveConfig(baseFlags(), {
      IMGGEN_OUTPUT_DIR: "/tmp/imgs",
    });

    expect(config.outputDir).toBe("/tmp/imgs");
  });

  // -----------------------------------------------------------------------
  // Flags take priority
  // -----------------------------------------------------------------------
  it("flags override env values", () => {
    const config = resolveConfig(baseFlags({ outputDir: "./from-flag" }), {
      IMGGEN_OUTPUT_DIR: "/from-env",
    });

    expect(config.outputDir).toBe("./from-flag");
  });

  it("flags override defaults for boolean options", () => {
    const config = resolveConfig(
      baseFlags({ json: true, quiet: true, debug: true, dryRun: true }),
      {},
    );

    expect(config.json).toBe(true);
    expect(config.quiet).toBe(true);
    expect(config.debug).toBe(true);
    expect(config.dryRun).toBe(true);
  });

  // -----------------------------------------------------------------------
  // Pass-through
  // -----------------------------------------------------------------------
  it("passes providers, count, and preset through from flags", () => {
    const config = resolveConfig(
      baseFlags({ provider: ["a", "b"], count: 5, preset: "hd" }),
      {},
    );

    expect(config.providers).toEqual(["a", "b"]);
    expect(config.count).toBe(5);
    expect(config.preset).toBe("hd");
  });

  it("preset is undefined when not provided", () => {
    const config = resolveConfig(baseFlags(), {});
    expect(config.preset).toBeUndefined();
  });
});
