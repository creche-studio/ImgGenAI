// ---------------------------------------------------------------------------
// Tests: Tier Aliases
// ---------------------------------------------------------------------------

import { describe, expect, it } from "vitest";
import {
  DEFAULT_TIER,
  isTier,
  RECRAFT_VECTOR_ALIASES,
  resolveTier,
  TIER_ALIASES,
  type Tier,
} from "../aliases.js";

describe("TIER_ALIASES", () => {
  it("has entries for all three providers", () => {
    expect(Object.keys(TIER_ALIASES).sort()).toEqual([
      "imagen",
      "openai",
      "recraft",
    ]);
  });

  it("each provider has premium, standard, economy", () => {
    for (const provider of Object.keys(TIER_ALIASES)) {
      expect(TIER_ALIASES[provider]).toHaveProperty("premium");
      expect(TIER_ALIASES[provider]).toHaveProperty("standard");
      expect(TIER_ALIASES[provider]).toHaveProperty("economy");
    }
  });
});

describe("RECRAFT_VECTOR_ALIASES", () => {
  it("has premium, standard, economy entries", () => {
    expect(RECRAFT_VECTOR_ALIASES).toHaveProperty("premium");
    expect(RECRAFT_VECTOR_ALIASES).toHaveProperty("standard");
    expect(RECRAFT_VECTOR_ALIASES).toHaveProperty("economy");
  });

  it("all values contain 'vector'", () => {
    for (const val of Object.values(RECRAFT_VECTOR_ALIASES)) {
      expect(val).toContain("vector");
    }
  });
});

describe("DEFAULT_TIER", () => {
  it('is "standard"', () => {
    expect(DEFAULT_TIER).toBe("standard");
  });
});

describe("resolveTier", () => {
  it("resolves openai standard to gpt-image-1", () => {
    expect(resolveTier("openai", "standard")).toBe("gpt-image-1");
  });

  it("resolves openai premium to gpt-image-1.5", () => {
    expect(resolveTier("openai", "premium")).toBe("gpt-image-1.5");
  });

  it("resolves openai economy to gpt-image-1-mini", () => {
    expect(resolveTier("openai", "economy")).toBe("gpt-image-1-mini");
  });

  it("resolves recraft standard to recraftv4", () => {
    expect(resolveTier("recraft", "standard")).toBe("recraftv4");
  });

  it("resolves recraft premium to recraftv4_pro", () => {
    expect(resolveTier("recraft", "premium")).toBe("recraftv4_pro");
  });

  it("resolves recraft economy to recraftv2", () => {
    expect(resolveTier("recraft", "economy")).toBe("recraftv2");
  });

  it("resolves imagen standard to imagen-4.0-generate-001", () => {
    expect(resolveTier("imagen", "standard")).toBe("imagen-4.0-generate-001");
  });

  it("resolves imagen premium to imagen-4.0-ultra-generate-001", () => {
    expect(resolveTier("imagen", "premium")).toBe(
      "imagen-4.0-ultra-generate-001",
    );
  });

  it("resolves imagen economy to imagen-4.0-fast-generate-001", () => {
    expect(resolveTier("imagen", "economy")).toBe(
      "imagen-4.0-fast-generate-001",
    );
  });

  it("defaults tier to standard when omitted", () => {
    expect(resolveTier("openai")).toBe("gpt-image-1");
    expect(resolveTier("recraft")).toBe("recraftv4");
    expect(resolveTier("imagen")).toBe("imagen-4.0-generate-001");
  });

  it("returns undefined for unknown provider", () => {
    expect(resolveTier("unknown", "standard")).toBeUndefined();
  });

  it("resolves recraft vector standard to recraftv4_vector", () => {
    expect(resolveTier("recraft", "standard", true)).toBe("recraftv4_vector");
  });

  it("resolves recraft vector premium to recraftv4_pro_vector", () => {
    expect(resolveTier("recraft", "premium", true)).toBe(
      "recraftv4_pro_vector",
    );
  });

  it("resolves recraft vector economy to recraftv2_vector", () => {
    expect(resolveTier("recraft", "economy", true)).toBe("recraftv2_vector");
  });

  it("vector flag on non-recraft falls back to normal alias", () => {
    expect(resolveTier("openai", "premium", true)).toBe("gpt-image-1.5");
    expect(resolveTier("imagen", "standard", true)).toBe(
      "imagen-4.0-generate-001",
    );
  });
});

describe("isTier", () => {
  it('returns true for "premium"', () => {
    expect(isTier("premium")).toBe(true);
  });

  it('returns true for "standard"', () => {
    expect(isTier("standard")).toBe(true);
  });

  it('returns true for "economy"', () => {
    expect(isTier("economy")).toBe(true);
  });

  it("returns false for invalid values", () => {
    expect(isTier("high")).toBe(false);
    expect(isTier("low")).toBe(false);
    expect(isTier("")).toBe(false);
    expect(isTier("PREMIUM")).toBe(false);
  });
});
