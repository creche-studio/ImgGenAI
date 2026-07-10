// ---------------------------------------------------------------------------
// Tests: Tier Aliases
// ---------------------------------------------------------------------------

import { describe, expect, it } from "vitest";
import {
  DEFAULT_TIER,
  RECRAFT_VECTOR_ALIASES,
  TIER_ALIASES,
  isTier,
  resolveTier,
} from "../aliases.js";

describe("TIER_ALIASES", () => {
  it("has entries for all three providers", () => {
    expect(Object.keys(TIER_ALIASES).sort()).toEqual([
      "gemini",
      "openai",
      "recraft",
    ]);
  });

  it("gemini and recraft have premium, standard, economy", () => {
    for (const provider of ["gemini", "recraft"]) {
      expect(TIER_ALIASES[provider]).toHaveProperty("premium");
      expect(TIER_ALIASES[provider]).toHaveProperty("standard");
      expect(TIER_ALIASES[provider]).toHaveProperty("economy");
    }
  });

  it("openai maps standard only (single-model lineup)", () => {
    expect(Object.keys(TIER_ALIASES.openai)).toEqual(["standard"]);
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
  it("resolves openai standard to gpt-image-2", () => {
    expect(resolveTier("openai", "standard")).toBe("gpt-image-2");
  });

  it("returns undefined for openai premium/economy (falls back to default)", () => {
    expect(resolveTier("openai", "premium")).toBeUndefined();
    expect(resolveTier("openai", "economy")).toBeUndefined();
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

  it("resolves gemini standard to gemini-3.1-flash-image", () => {
    expect(resolveTier("gemini", "standard")).toBe("gemini-3.1-flash-image");
  });

  it("resolves gemini premium to gemini-3-pro-image", () => {
    expect(resolveTier("gemini", "premium")).toBe("gemini-3-pro-image");
  });

  it("resolves gemini economy to gemini-3.1-flash-lite-image", () => {
    expect(resolveTier("gemini", "economy")).toBe(
      "gemini-3.1-flash-lite-image",
    );
  });

  it("defaults tier to standard when omitted", () => {
    expect(resolveTier("openai")).toBe("gpt-image-2");
    expect(resolveTier("recraft")).toBe("recraftv4");
    expect(resolveTier("gemini")).toBe("gemini-3.1-flash-image");
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
    expect(resolveTier("openai", "standard", true)).toBe("gpt-image-2");
    expect(resolveTier("gemini", "standard", true)).toBe(
      "gemini-3.1-flash-image",
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
