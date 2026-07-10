// ---------------------------------------------------------------------------
// generate command tests – flag parsing & validation
// ---------------------------------------------------------------------------

import { describe, expect, it } from "vitest";
import { resolveProviderEntries } from "../commands/generate.js";
import type { GenerateFlags } from "../commands/generate.js";

const BASE_FLAGS: GenerateFlags = {
  provider: ["openai"],
  json: false,
  quiet: false,
  debug: false,
  dryRun: false,
};

const PROVIDER_QUALITIES: Record<string, readonly string[] | undefined> = {
  openai: ["low", "medium", "high", "auto"],
  recraft: undefined,
  imagen: undefined,
};

describe("resolveProviderEntries", () => {
  // 1. Default tier → standard model for each provider
  it("default (no flags) → standard tier model", () => {
    const entries = resolveProviderEntries(
      ["openai"],
      { ...BASE_FLAGS },
      PROVIDER_QUALITIES,
    );
    expect(entries).toEqual([{ name: "openai", model: "gpt-image-1" }]);
  });

  it("default for recraft → recraftv4", () => {
    const entries = resolveProviderEntries(
      ["recraft"],
      { ...BASE_FLAGS },
      PROVIDER_QUALITIES,
    );
    expect(entries).toEqual([{ name: "recraft", model: "recraftv4" }]);
  });

  it("default for imagen → imagen-4.0-generate-001", () => {
    const entries = resolveProviderEntries(
      ["imagen"],
      { ...BASE_FLAGS },
      PROVIDER_QUALITIES,
    );
    expect(entries).toEqual([
      { name: "imagen", model: "imagen-4.0-generate-001" },
    ]);
  });

  // 2. --tier premium
  it("--tier premium → premium models", () => {
    const entries = resolveProviderEntries(
      ["openai", "recraft", "imagen"],
      { ...BASE_FLAGS, tier: "premium" },
      PROVIDER_QUALITIES,
    );
    expect(entries).toEqual([
      { name: "openai", model: "gpt-image-1.5" },
      { name: "recraft", model: "recraftv4_pro" },
      { name: "imagen", model: "imagen-4.0-ultra-generate-001" },
    ]);
  });

  // 3. --tier economy
  it("--tier economy → economy models", () => {
    const entries = resolveProviderEntries(
      ["openai"],
      { ...BASE_FLAGS, tier: "economy" },
      PROVIDER_QUALITIES,
    );
    expect(entries).toEqual([{ name: "openai", model: "gpt-image-1-mini" }]);
  });

  // 4. --model overrides tier
  it("--model <id> → direct model id", () => {
    const entries = resolveProviderEntries(
      ["openai"],
      { ...BASE_FLAGS, model: "gpt-image-1.5" },
      PROVIDER_QUALITIES,
    );
    expect(entries).toEqual([{ name: "openai", model: "gpt-image-1.5" }]);
  });

  // 5. --tier + --model → error
  it("--tier + --model → ValidationError", () => {
    expect(() =>
      resolveProviderEntries(
        ["openai"],
        { ...BASE_FLAGS, tier: "premium", model: "gpt-image-1.5" },
        PROVIDER_QUALITIES,
      ),
    ).toThrow("--tier and --model cannot be used together");
  });

  // 6. Invalid --tier → error
  it("invalid --tier → ValidationError", () => {
    expect(() =>
      resolveProviderEntries(
        ["openai"],
        { ...BASE_FLAGS, tier: "ultra" },
        PROVIDER_QUALITIES,
      ),
    ).toThrow('Invalid --tier: "ultra"');
  });

  // 7. --quality on quality-supporting provider
  it("--quality on openai → quality forwarded", () => {
    const entries = resolveProviderEntries(
      ["openai"],
      { ...BASE_FLAGS, quality: "high" },
      PROVIDER_QUALITIES,
    );
    expect(entries[0].quality).toBe("high");
  });

  // 8. --quality on non-quality provider → silent ignore for that provider
  it("--quality on mixed providers → quality only on supported", () => {
    const entries = resolveProviderEntries(
      ["openai", "recraft"],
      { ...BASE_FLAGS, quality: "low" },
      PROVIDER_QUALITIES,
    );
    expect(entries[0].quality).toBe("low"); // openai supports quality
    expect(entries[1].quality).toBeUndefined(); // recraft does not
  });

  // 9. --quality with only non-quality providers → error
  it("--quality with only recraft → ValidationError", () => {
    expect(() =>
      resolveProviderEntries(
        ["recraft"],
        { ...BASE_FLAGS, quality: "high" },
        PROVIDER_QUALITIES,
      ),
    ).toThrow("--quality is not supported by any of the specified providers");
  });

  // 10. --vector → recraft vector alias
  it("--vector → recraft vector model", () => {
    const entries = resolveProviderEntries(
      ["recraft"],
      { ...BASE_FLAGS, vector: true },
      PROVIDER_QUALITIES,
    );
    expect(entries[0].model).toBe("recraftv4_vector");
  });

  // 11. --vector + --tier premium
  it("--vector + --tier premium → recraftv4_pro_vector", () => {
    const entries = resolveProviderEntries(
      ["recraft"],
      { ...BASE_FLAGS, vector: true, tier: "premium" },
      PROVIDER_QUALITIES,
    );
    expect(entries[0].model).toBe("recraftv4_pro_vector");
  });

  // 12. --vector on non-recraft → no-op (uses standard tier alias)
  it("--vector on openai → standard tier (no-op)", () => {
    const entries = resolveProviderEntries(
      ["openai"],
      { ...BASE_FLAGS, vector: true },
      PROVIDER_QUALITIES,
    );
    expect(entries[0].model).toBe("gpt-image-1"); // standard tier, vector ignored for openai
  });

  // 13. Multiple providers
  it("multiple providers with default tier", () => {
    const entries = resolveProviderEntries(
      ["openai", "recraft", "imagen"],
      { ...BASE_FLAGS },
      PROVIDER_QUALITIES,
    );
    expect(entries).toHaveLength(3);
    expect(entries[0]).toEqual({ name: "openai", model: "gpt-image-1" });
    expect(entries[1]).toEqual({ name: "recraft", model: "recraftv4" });
    expect(entries[2]).toEqual({
      name: "imagen",
      model: "imagen-4.0-generate-001",
    });
  });
});
