// ---------------------------------------------------------------------------
// Static Pricing Tests – ImgGenAI
// ---------------------------------------------------------------------------

import { describe, expect, it } from "vitest";
import { calculateCost, perImageCost } from "../index.js";
import { OPENAI_PRICING } from "../openai.js";
import { RECRAFT_PRICING } from "../recraft.js";
import { IMAGEN_PRICING } from "../imagen.js";

// ---------------------------------------------------------------------------
// perImageCost – OpenAI
// ---------------------------------------------------------------------------

describe("perImageCost – OpenAI", () => {
  it("returns correct cost for gpt-image-1 / 1024x1024 / low", () => {
    expect(
      perImageCost("openai", "gpt-image-1", { width: 1024, height: 1024 }, "low"),
    ).toBe(0.011);
  });

  it("returns correct cost for gpt-image-1 / 1024x1024 / medium", () => {
    expect(
      perImageCost("openai", "gpt-image-1", { width: 1024, height: 1024 }, "medium"),
    ).toBe(0.042);
  });

  it("returns correct cost for gpt-image-1 / 1024x1024 / high", () => {
    expect(
      perImageCost("openai", "gpt-image-1", { width: 1024, height: 1024 }, "high"),
    ).toBe(0.167);
  });

  it("returns correct cost for gpt-image-1 / 1024x1536 / high", () => {
    expect(
      perImageCost("openai", "gpt-image-1", { width: 1024, height: 1536 }, "high"),
    ).toBe(0.25);
  });

  it("returns correct cost for gpt-image-1 / 1536x1024 / medium", () => {
    expect(
      perImageCost("openai", "gpt-image-1", { width: 1536, height: 1024 }, "medium"),
    ).toBe(0.063);
  });

  it("returns correct cost for gpt-image-1-mini / 1024x1024 / low", () => {
    expect(
      perImageCost("openai", "gpt-image-1-mini", { width: 1024, height: 1024 }, "low"),
    ).toBe(0.005);
  });

  it("returns correct cost for gpt-image-1-mini / 1024x1536 / high", () => {
    expect(
      perImageCost("openai", "gpt-image-1-mini", { width: 1024, height: 1536 }, "high"),
    ).toBe(0.052);
  });

  it("returns correct cost for gpt-image-1.5 / 1024x1024 / high", () => {
    expect(
      perImageCost("openai", "gpt-image-1.5", { width: 1024, height: 1024 }, "high"),
    ).toBe(0.13);
  });

  it("returns correct cost for gpt-image-1.5 / 1536x1024 / low", () => {
    expect(
      perImageCost("openai", "gpt-image-1.5", { width: 1536, height: 1024 }, "low"),
    ).toBe(0.013);
  });

  it("returns null for quality 'auto' (not in static table)", () => {
    expect(
      perImageCost("openai", "gpt-image-1", { width: 1024, height: 1024 }, "auto"),
    ).toBeNull();
  });

  it("returns null for unknown model", () => {
    expect(
      perImageCost("openai", "gpt-image-99", { width: 1024, height: 1024 }, "high"),
    ).toBeNull();
  });

  it("returns null for unknown size", () => {
    expect(
      perImageCost("openai", "gpt-image-1", { width: 512, height: 512 }, "high"),
    ).toBeNull();
  });

  it("returns null when quality is omitted", () => {
    expect(
      perImageCost("openai", "gpt-image-1", { width: 1024, height: 1024 }),
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
      perImageCost("recraft", "recraftv4_vector", { width: 1024, height: 1024 }),
    ).toBe(0.08);
  });

  it("returns cost for recraftv4_pro_vector", () => {
    expect(
      perImageCost("recraft", "recraftv4_pro_vector", { width: 1024, height: 1024 }),
    ).toBe(0.3);
  });

  it("returns cost for recraftv3_vector", () => {
    expect(
      perImageCost("recraft", "recraftv3_vector", { width: 1024, height: 1024 }),
    ).toBe(0.08);
  });

  it("returns cost for recraftv2_vector", () => {
    expect(
      perImageCost("recraft", "recraftv2_vector", { width: 1024, height: 1024 }),
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
// perImageCost – Imagen
// ---------------------------------------------------------------------------

describe("perImageCost – Imagen", () => {
  it("returns cost for imagen-4.0-fast-generate-001", () => {
    expect(
      perImageCost("imagen", "imagen-4.0-fast-generate-001", { width: 1024, height: 1024 }),
    ).toBe(0.02);
  });

  it("returns cost for imagen-4.0-generate-001", () => {
    expect(
      perImageCost("imagen", "imagen-4.0-generate-001", { width: 1024, height: 1024 }),
    ).toBe(0.04);
  });

  it("returns cost for imagen-4.0-ultra-generate-001", () => {
    expect(
      perImageCost("imagen", "imagen-4.0-ultra-generate-001", { width: 1024, height: 1024 }),
    ).toBe(0.06);
  });

  it("ignores size (flat rate)", () => {
    expect(
      perImageCost("imagen", "imagen-4.0-generate-001", { width: 1536, height: 1024 }),
    ).toBe(0.04);
  });

  it("returns null for unknown model", () => {
    expect(
      perImageCost("imagen", "imagen-99", { width: 1024, height: 1024 }),
    ).toBeNull();
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
        model: "gpt-image-1",
        size: { width: 1024, height: 1024 },
        quality: "medium",
        count: 3,
      }),
    ).toBeCloseTo(0.042 * 3);
  });

  it("returns null when per-image cost is unknown", () => {
    expect(
      calculateCost({
        provider: "openai",
        model: "gpt-image-1",
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

  it("handles count of 5 for Imagen", () => {
    expect(
      calculateCost({
        provider: "imagen",
        model: "imagen-4.0-generate-001",
        size: { width: 1024, height: 1024 },
        count: 5,
      }),
    ).toBeCloseTo(0.04 * 5);
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
  it("OPENAI_PRICING has all 3 models", () => {
    expect(Object.keys(OPENAI_PRICING)).toEqual([
      "gpt-image-1",
      "gpt-image-1-mini",
      "gpt-image-1.5",
    ]);
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

  it("IMAGEN_PRICING has 3 entries", () => {
    expect(Object.keys(IMAGEN_PRICING)).toHaveLength(3);
  });
});
