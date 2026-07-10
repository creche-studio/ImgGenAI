import { describe, expect, it } from "vitest";
import { ConfigError } from "../../errors/index.js";
import {
  type FlagValues,
  parseEnvCount,
  parseEnvProviders,
  resolveConfig,
} from "../config.js";

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
    const config = resolveConfig(
      baseFlags({ provider: [], count: undefined }),
      {},
    );

    expect(config.providers).toEqual(["openai"]);
    expect(config.count).toBe(1);
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

  it("falls back to IMGGEN_PROVIDER from env when no --provider flag", () => {
    const config = resolveConfig(baseFlags({ provider: [] }), {
      IMGGEN_PROVIDER: "recraft,imagen",
    });

    expect(config.providers).toEqual(["recraft", "imagen"]);
  });

  it("falls back to IMGGEN_COUNT from env when no --count flag", () => {
    const config = resolveConfig(baseFlags({ count: undefined }), {
      IMGGEN_COUNT: "5",
    });

    expect(config.count).toBe(5);
  });

  // -----------------------------------------------------------------------
  // Flags take priority over env
  // -----------------------------------------------------------------------
  it("flags override env values", () => {
    const config = resolveConfig(baseFlags({ outputDir: "./from-flag" }), {
      IMGGEN_OUTPUT_DIR: "/from-env",
    });

    expect(config.outputDir).toBe("./from-flag");
  });

  it("--provider flag overrides IMGGEN_PROVIDER env", () => {
    const config = resolveConfig(baseFlags({ provider: ["imagen"] }), {
      IMGGEN_PROVIDER: "recraft",
    });

    expect(config.providers).toEqual(["imagen"]);
  });

  it("--count flag overrides IMGGEN_COUNT env", () => {
    const config = resolveConfig(baseFlags({ count: 3 }), {
      IMGGEN_COUNT: "7",
    });

    expect(config.count).toBe(3);
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
      baseFlags({ provider: ["openai", "recraft"], count: 5, preset: "hd" }),
      {},
    );

    expect(config.providers).toEqual(["openai", "recraft"]);
    expect(config.count).toBe(5);
    expect(config.preset).toBe("hd");
  });

  it("preset is undefined when not provided", () => {
    const config = resolveConfig(baseFlags(), {});
    expect(config.preset).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// parseEnvProviders
// ---------------------------------------------------------------------------

describe("parseEnvProviders", () => {
  it("returns default [{name: 'openai'}] when env is undefined", () => {
    expect(parseEnvProviders(undefined)).toEqual([{ name: "openai" }]);
  });

  it("returns default [{name: 'openai'}] when env is empty string", () => {
    expect(parseEnvProviders("")).toEqual([{ name: "openai" }]);
  });

  it("parses single provider", () => {
    expect(parseEnvProviders("recraft")).toEqual([{ name: "recraft" }]);
  });

  it("parses comma-separated providers", () => {
    expect(parseEnvProviders("openai,recraft,imagen")).toEqual([
      { name: "openai" },
      { name: "recraft" },
      { name: "imagen" },
    ]);
  });

  it("trims whitespace around provider names", () => {
    expect(parseEnvProviders(" openai , recraft ")).toEqual([
      { name: "openai" },
      { name: "recraft" },
    ]);
  });

  it("throws ConfigError for unknown provider name", () => {
    expect(() => parseEnvProviders("openai,unknown")).toThrow(ConfigError);
    expect(() => parseEnvProviders("openai,unknown")).toThrow(
      /Invalid provider in IMGGEN_PROVIDER: "unknown"/,
    );
  });
});

// ---------------------------------------------------------------------------
// parseEnvCount
// ---------------------------------------------------------------------------

describe("parseEnvCount", () => {
  it("returns default 1 when env is undefined", () => {
    expect(parseEnvCount(undefined)).toBe(1);
  });

  it("returns default 1 when env is empty string", () => {
    expect(parseEnvCount("")).toBe(1);
  });

  it("parses valid integer", () => {
    expect(parseEnvCount("5")).toBe(5);
  });

  it("accepts count of 1 (minimum)", () => {
    expect(parseEnvCount("1")).toBe(1);
  });

  it("accepts count of 10 (maximum)", () => {
    expect(parseEnvCount("10")).toBe(10);
  });

  it("throws ConfigError for 0", () => {
    expect(() => parseEnvCount("0")).toThrow(ConfigError);
    expect(() => parseEnvCount("0")).toThrow(/Invalid IMGGEN_COUNT: "0"/);
  });

  it("throws ConfigError for negative number", () => {
    expect(() => parseEnvCount("-1")).toThrow(ConfigError);
  });

  it("throws ConfigError for value > 10", () => {
    expect(() => parseEnvCount("11")).toThrow(ConfigError);
  });

  it("throws ConfigError for non-integer", () => {
    expect(() => parseEnvCount("2.5")).toThrow(ConfigError);
  });

  it("throws ConfigError for non-numeric string", () => {
    expect(() => parseEnvCount("abc")).toThrow(ConfigError);
  });
});
