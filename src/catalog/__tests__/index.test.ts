import { describe, expect, it } from "vitest";
import {
  MODEL_CATALOG,
  defaultModelFor,
  findModel,
  modelNamesFor,
  modelsFor,
  resolveModelId,
  tierAliasesFor,
} from "../index.js";

const PROVIDERS = ["openai", "recraft", "gemini"] as const;

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

  it("multi-model providers cover all three tiers", () => {
    for (const provider of ["recraft", "gemini"]) {
      const tiers = modelsFor(provider)
        .map((m) => m.tier)
        .filter(Boolean);
      expect(new Set(tiers), provider).toEqual(
        new Set(["premium", "standard", "economy"]),
      );
    }
  });

  it("openai (single-model lineup) maps standard only", () => {
    const tiers = modelsFor("openai")
      .map((m) => m.tier)
      .filter(Boolean);
    expect(tiers).toEqual(["standard"]);
  });

  it("a tier appears at most once per provider", () => {
    for (const provider of PROVIDERS) {
      const tiers = modelsFor(provider)
        .map((m) => m.tier)
        .filter(Boolean);
      expect(new Set(tiers).size, provider).toBe(tiers.length);
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

  it("every model has a pricing entry (flat, by-size, or by-resolution)", () => {
    for (const m of MODEL_CATALOG) {
      expect(
        m.perImageUSD !== undefined ||
          m.perImageUSDBySize !== undefined ||
          m.perImageUSDByResolution !== undefined,
        `${m.provider}/${m.shortName}`,
      ).toBe(true);
    }
  });

  it("no deprecated models remain in the catalog", () => {
    // OpenAI shuts down gpt-image-1* on Dec 1, 2026; Google shuts down
    // Imagen 4 endpoints on Aug 17, 2026.
    for (const m of MODEL_CATALOG) {
      expect(m.apiId).not.toMatch(/^gpt-image-1/);
      expect(m.apiId).not.toMatch(/^imagen-/);
    }
  });
});

describe("resolveModelId", () => {
  it("resolves shortName to apiId", () => {
    expect(resolveModelId("gemini", "gemini-flash")).toBe(
      "gemini-3.1-flash-image",
    );
    expect(resolveModelId("recraft", "recraft-v4")).toBe("recraftv4");
    expect(resolveModelId("openai", "gpt-image-2")).toBe("gpt-image-2");
  });

  it("is idempotent: apiId resolves to itself", () => {
    for (const m of MODEL_CATALOG) {
      expect(resolveModelId(m.provider, m.apiId)).toBe(m.apiId);
    }
  });

  it("passes unknown names through unchanged", () => {
    expect(resolveModelId("gemini", "gemini-99")).toBe("gemini-99");
    expect(resolveModelId("nonexistent", "whatever")).toBe("whatever");
  });

  it("does not resolve across providers", () => {
    expect(resolveModelId("openai", "gemini-flash")).toBe("gemini-flash");
  });
});

describe("derived lookups", () => {
  it("defaultModelFor returns the flagged default", () => {
    expect(defaultModelFor("openai")).toBe("gpt-image-2");
    expect(defaultModelFor("recraft")).toBe("recraft-v4");
    expect(defaultModelFor("gemini")).toBe("gemini-flash");
  });

  it("defaultModelFor throws for unknown providers", () => {
    expect(() => defaultModelFor("nonexistent")).toThrow();
  });

  it("modelNamesFor preserves catalog order", () => {
    expect(modelNamesFor("gemini")).toEqual([
      "gemini-flash-lite",
      "gemini-flash",
      "gemini-pro",
    ]);
  });

  it("findModel finds by shortName and apiId", () => {
    expect(findModel("gemini", "gemini-pro")?.apiId).toBe("gemini-3-pro-image");
    expect(findModel("gemini", "gemini-3-pro-image")?.shortName).toBe(
      "gemini-pro",
    );
    expect(findModel("gemini", "nope")).toBeUndefined();
  });

  it("tierAliasesFor maps the migration decisions", () => {
    expect(tierAliasesFor("gemini")).toEqual({
      premium: "gemini-3-pro-image",
      standard: "gemini-3.1-flash-image",
      economy: "gemini-3.1-flash-lite-image",
    });
    expect(tierAliasesFor("openai")).toEqual({
      standard: "gpt-image-2",
    });
    expect(tierAliasesFor("recraft", true)).toEqual({
      premium: "recraftv4_pro_vector",
      standard: "recraftv4_vector",
      economy: "recraftv2_vector",
    });
  });
});
