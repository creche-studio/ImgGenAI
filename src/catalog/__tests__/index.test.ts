import { describe, expect, it } from "vitest";
import {
  MODEL_CATALOG,
  defaultModelFor,
  modelNamesFor,
  modelsFor,
  resolveModelId,
  tierAliasesFor,
} from "../index.js";

const PROVIDERS = ["openai", "recraft", "imagen"] as const;

describe("MODEL_CATALOG invariants", () => {
  it("shortName and apiId are unique within each provider", () => {
    for (const provider of PROVIDERS) {
      const models = modelsFor(provider);
      const shortNames = models.map((m) => m.shortName);
      const apiIds = models.map((m) => m.apiId);
      expect(new Set(shortNames).size).toBe(shortNames.length);
      expect(new Set(apiIds).size).toBe(apiIds.length);
    }
  });

  it("every provider has exactly one default model", () => {
    for (const provider of PROVIDERS) {
      const defaults = modelsFor(provider).filter((m) => m.isDefault);
      expect(defaults, provider).toHaveLength(1);
    }
  });

  it("every provider with tiers covers all three tiers", () => {
    for (const provider of PROVIDERS) {
      const tiers = modelsFor(provider)
        .map((m) => m.tier)
        .filter(Boolean);
      expect(new Set(tiers), provider).toEqual(
        new Set(["premium", "standard", "economy"]),
      );
    }
  });

  it("recraft vector tiers cover all three tiers", () => {
    const vectorTiers = modelsFor("recraft")
      .map((m) => m.vectorTier)
      .filter(Boolean);
    expect(new Set(vectorTiers)).toEqual(
      new Set(["premium", "standard", "economy"]),
    );
  });

  it("every model has a pricing entry (flat or by-size)", () => {
    for (const m of MODEL_CATALOG) {
      expect(
        m.perImageUSD !== undefined || m.perImageUSDBySize !== undefined,
        `${m.provider}/${m.shortName}`,
      ).toBe(true);
    }
  });
});

describe("resolveModelId", () => {
  it("resolves shortName to apiId", () => {
    expect(resolveModelId("imagen", "imagen-4")).toBe(
      "imagen-4.0-generate-001",
    );
    expect(resolveModelId("recraft", "recraft-v4")).toBe("recraftv4");
    expect(resolveModelId("openai", "gpt-image-1")).toBe("gpt-image-1");
  });

  it("is idempotent: apiId resolves to itself", () => {
    for (const m of MODEL_CATALOG) {
      expect(resolveModelId(m.provider, m.apiId)).toBe(m.apiId);
    }
  });

  it("passes unknown names through unchanged", () => {
    expect(resolveModelId("imagen", "imagen-99")).toBe("imagen-99");
    expect(resolveModelId("nonexistent", "whatever")).toBe("whatever");
  });

  it("does not resolve across providers", () => {
    expect(resolveModelId("openai", "imagen-4")).toBe("imagen-4");
  });
});

describe("derived lookups", () => {
  it("defaultModelFor returns the flagged default", () => {
    expect(defaultModelFor("openai")).toBe("gpt-image-1");
    expect(defaultModelFor("recraft")).toBe("recraft-v4");
    expect(defaultModelFor("imagen")).toBe("imagen-4");
  });

  it("defaultModelFor throws for unknown providers", () => {
    expect(() => defaultModelFor("nonexistent")).toThrow();
  });

  it("modelNamesFor preserves catalog order", () => {
    expect(modelNamesFor("imagen")).toEqual([
      "imagen-4-fast",
      "imagen-4",
      "imagen-4-ultra",
    ]);
  });

  it("tierAliasesFor matches the pre-catalog alias tables", () => {
    expect(tierAliasesFor("imagen")).toEqual({
      premium: "imagen-4.0-ultra-generate-001",
      standard: "imagen-4.0-generate-001",
      economy: "imagen-4.0-fast-generate-001",
    });
    expect(tierAliasesFor("recraft", true)).toEqual({
      premium: "recraftv4_pro_vector",
      standard: "recraftv4_vector",
      economy: "recraftv2_vector",
    });
  });
});
