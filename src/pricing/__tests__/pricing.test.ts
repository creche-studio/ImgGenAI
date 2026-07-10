// ---------------------------------------------------------------------------
// Static Pricing Tests – ImgGenAI
// ---------------------------------------------------------------------------

import { describe, expect, it } from "vitest";
import { GEMINI_PRICING, resolutionForSize } from "../gemini.js";
import { calculateCost, perImageCost } from "../index.js";
import { OPENAI_PRICING } from "../openai.js";
import { RECRAFT_PRICING } from "../recraft.js";

// ---------------------------------------------------------------------------
// perImageCost – OpenAI
// ---------------------------------------------------------------------------

describe("perImageCost – OpenAI", () => {
  it("returns correct cost for gpt-image-2 / 1024x1024 / low", () => {
    expect(
      perImageCost(
        "openai",
        "gpt-image-2",
        { width: 1024, height: 1024 },
        "low",
      ),
    ).toBe(0.006);
  });

  it("returns correct cost for gpt-image-2 / 1024x1024 / medium", () => {
    expect(
      perImageCost(
        "openai",
        "gpt-image-2",
        { width: 1024, height: 1024 },
        "medium",
      ),
    ).toBe(0.053);
  });

  it("returns correct cost for gpt-image-2 / 1024x1024 / high", () => {
    expect(
      perImageCost(
        "openai",
        "gpt-image-2",
        { width: 1024, height: 1024 },
        "high",
      ),
    ).toBe(0.211);
  });

  it("returns correct cost for gpt-image-2 / 1024x1536 / high", () => {
    expect(
      perImageCost(
        "openai",
        "gpt-image-2",
        { width: 1024, height: 1536 },
        "high",
      ),
    ).toBe(0.165);
  });

  it("returns correct cost for gpt-image-2 / 1536x1024 / medium", () => {
    expect(
      perImageCost(
        "openai",
        "gpt-image-2",
        { width: 1536, height: 1024 },
        "medium",
      ),
    ).toBe(0.041);
  });

  it("returns correct cost for gpt-image-2 / 1536x1024 / low", () => {
    expect(
      perImageCost(
        "openai",
        "gpt-image-2",
        { width: 1536, height: 1024 },
        "low",
      ),
    ).toBe(0.005);
  });

  it("returns null for quality 'auto' (not in static table)", () => {
    expect(
      perImageCost(
        "openai",
        "gpt-image-2",
        { width: 1024, height: 1024 },
        "auto",
      ),
    ).toBeNull();
  });

  it("returns null for unknown model", () => {
    expect(
      perImageCost(
        "openai",
        "gpt-image-99",
        { width: 1024, height: 1024 },
        "high",
      ),
    ).toBeNull();
  });

  it("returns null for sizes outside the static table", () => {
    expect(
      perImageCost(
        "openai",
        "gpt-image-2",
        { width: 2048, height: 2048 },
        "high",
      ),
    ).toBeNull();
  });

  it("returns null when quality is omitted", () => {
    expect(
      perImageCost("openai", "gpt-image-2", { width: 1024, height: 1024 }),
    ).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// perImageCost – Recraft
// ---------------------------------------------------------------------------

describe("perImageCost – Recraft", () => {
  it("returns cost for recraftv4", () => {
    expect(
      perImageCost("recraft", "recraftv4", { width: 1024, height: 1024 }),
    ).toBe(0.04);
  });

  it("returns cost for recraftv4_pro", () => {
    expect(
      perImageCost("recraft", "recraftv4_pro", { width: 1024, height: 1024 }),
    ).toBe(0.25);
  });

  it("returns cost for recraftv2", () => {
    expect(
      perImageCost("recraft", "recraftv2", { width: 1024, height: 1024 }),
    ).toBe(0.022);
  });

  it("returns cost for recraftv4_vector", () => {
    expect(
      perImageCost("recraft", "recraftv4_vector", {
        width: 1024,
        height: 1024,
      }),
    ).toBe(0.08);
  });

  it("returns cost for recraftv4_pro_vector", () => {
    expect(
      perImageCost("recraft", "recraftv4_pro_vector", {
        width: 1024,
        height: 1024,
      }),
    ).toBe(0.3);
  });

  it("returns cost for recraftv3_vector", () => {
    expect(
      perImageCost("recraft", "recraftv3_vector", {
        width: 1024,
        height: 1024,
      }),
    ).toBe(0.08);
  });

  it("returns cost for recraftv2_vector", () => {
    expect(
      perImageCost("recraft", "recraftv2_vector", {
        width: 1024,
        height: 1024,
      }),
    ).toBe(0.044);
  });

  it("ignores size (flat rate)", () => {
    expect(
      perImageCost("recraft", "recraftv4", { width: 2048, height: 2048 }),
    ).toBe(0.04);
  });

  it("returns null for unknown model", () => {
    expect(
      perImageCost("recraft", "recraftv99", { width: 1024, height: 1024 }),
    ).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// perImageCost – Gemini
// ---------------------------------------------------------------------------

describe("perImageCost – Gemini", () => {
  it("returns 1K cost for gemini-3.1-flash-image", () => {
    expect(
      perImageCost("gemini", "gemini-3.1-flash-image", {
        width: 1024,
        height: 1024,
      }),
    ).toBe(0.067);
  });

  it("returns 2K cost for gemini-3.1-flash-image", () => {
    expect(
      perImageCost("gemini", "gemini-3.1-flash-image", {
        width: 2048,
        height: 2048,
      }),
    ).toBe(0.101);
  });

  it("returns 4K cost for gemini-3.1-flash-image", () => {
    expect(
      perImageCost("gemini", "gemini-3.1-flash-image", {
        width: 4096,
        height: 4096,
      }),
    ).toBe(0.151);
  });

  it("returns 1K cost for gemini-3.1-flash-lite-image", () => {
    expect(
      perImageCost("gemini", "gemini-3.1-flash-lite-image", {
        width: 1024,
        height: 1024,
      }),
    ).toBe(0.0336);
  });

  it("returns null for flash-lite above 1K (unsupported resolution)", () => {
    expect(
      perImageCost("gemini", "gemini-3.1-flash-lite-image", {
        width: 2048,
        height: 2048,
      }),
    ).toBeNull();
  });

  it("returns 1K/2K cost for gemini-3-pro-image (same price)", () => {
    expect(
      perImageCost("gemini", "gemini-3-pro-image", {
        width: 1024,
        height: 1024,
      }),
    ).toBe(0.134);
    expect(
      perImageCost("gemini", "gemini-3-pro-image", {
        width: 2048,
        height: 2048,
      }),
    ).toBe(0.134);
  });

  it("resolution class follows the longest edge", () => {
    // 1280x720: longest edge 1280 → 2K class
    expect(
      perImageCost("gemini", "gemini-3.1-flash-image", {
        width: 1280,
        height: 720,
      }),
    ).toBe(0.101);
  });

  it("returns null for unknown model", () => {
    expect(
      perImageCost("gemini", "gemini-99", { width: 1024, height: 1024 }),
    ).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// resolutionForSize
// ---------------------------------------------------------------------------

describe("resolutionForSize", () => {
  it("maps by longest edge", () => {
    expect(resolutionForSize({ width: 512, height: 512 })).toBe("1K");
    expect(resolutionForSize({ width: 1024, height: 1024 })).toBe("1K");
    expect(resolutionForSize({ width: 2048, height: 1024 })).toBe("2K");
    expect(resolutionForSize({ width: 4096, height: 2048 })).toBe("4K");
  });
});

describe("GEMINI_PRICING", () => {
  it("is keyed by API model id", () => {
    expect(Object.keys(GEMINI_PRICING).sort()).toEqual([
      "gemini-3-pro-image",
      "gemini-3.1-flash-image",
      "gemini-3.1-flash-lite-image",
    ]);
  });
});

// ---------------------------------------------------------------------------
// perImageCost – unknown provider
// ---------------------------------------------------------------------------

describe("perImageCost – unknown provider", () => {
  it("returns null for unknown provider", () => {
    expect(
      perImageCost("dall-e", "dall-e-3", { width: 1024, height: 1024 }),
    ).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// calculateCost (batch)
// ---------------------------------------------------------------------------

describe("calculateCost", () => {
  it("multiplies per-image cost by count", () => {
    expect(
      calculateCost({
        provider: "openai",
        model: "gpt-image-2",
        size: { width: 1024, height: 1024 },
        quality: "medium",
        count: 3,
      }),
    ).toBeCloseTo(0.053 * 3);
  });

  it("returns null when per-image cost is unknown", () => {
    expect(
      calculateCost({
        provider: "openai",
        model: "gpt-image-2",
        size: { width: 1024, height: 1024 },
        quality: "auto",
        count: 1,
      }),
    ).toBeNull();
  });

  it("handles count of 1 for Recraft", () => {
    expect(
      calculateCost({
        provider: "recraft",
        model: "recraftv4_pro",
        size: { width: 1024, height: 1024 },
        count: 1,
      }),
    ).toBe(0.25);
  });

  it("handles count of 5 for Gemini", () => {
    expect(
      calculateCost({
        provider: "gemini",
        model: "gemini-3.1-flash-image",
        size: { width: 1024, height: 1024 },
        count: 5,
      }),
    ).toBeCloseTo(0.067 * 5);
  });

  it("returns null for unknown provider", () => {
    expect(
      calculateCost({
        provider: "unknown",
        model: "some-model",
        size: { width: 1024, height: 1024 },
        count: 1,
      }),
    ).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Table completeness
// ---------------------------------------------------------------------------

describe("pricing table completeness", () => {
  it("OPENAI_PRICING has the single gpt-image-2 model", () => {
    expect(Object.keys(OPENAI_PRICING)).toEqual(["gpt-image-2"]);
  });

  it("OPENAI_PRICING has 3 sizes per model", () => {
    for (const model of Object.keys(OPENAI_PRICING)) {
      expect(Object.keys(OPENAI_PRICING[model])).toEqual([
        "1024x1024",
        "1024x1536",
        "1536x1024",
      ]);
    }
  });

  it("OPENAI_PRICING has 3 qualities per size", () => {
    for (const model of Object.values(OPENAI_PRICING)) {
      for (const size of Object.values(model)) {
        expect(Object.keys(size)).toEqual(["low", "medium", "high"]);
      }
    }
  });

  it("RECRAFT_PRICING has 8 entries (4 raster + 4 vector)", () => {
    expect(Object.keys(RECRAFT_PRICING)).toHaveLength(8);
  });

  it("GEMINI_PRICING has 3 entries", () => {
    expect(Object.keys(GEMINI_PRICING)).toHaveLength(3);
  });
});
