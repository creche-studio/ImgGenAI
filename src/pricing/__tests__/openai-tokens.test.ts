// ---------------------------------------------------------------------------
// OpenAI Token-Based (Dynamic) Pricing Tests – ImgGenAI
// ---------------------------------------------------------------------------

import { describe, expect, it } from "vitest";
import {
  OPENAI_TOKEN_RATES_USD_PER_MILLION,
  calculateOpenAIActualCost,
} from "../openai-tokens.js";
import type { OpenAIUsage } from "../openai-tokens.js";

// ---------------------------------------------------------------------------
// Token rate table
// ---------------------------------------------------------------------------

describe("OPENAI_TOKEN_RATES_USD_PER_MILLION", () => {
  it("has rates for gpt-image-2", () => {
    const rate = OPENAI_TOKEN_RATES_USD_PER_MILLION["gpt-image-2"];
    expect(rate).toEqual({ input_text: 5, input_image: 8, output: 30 });
  });

  it("has no rates for shut-down gpt-image-1 models", () => {
    expect(OPENAI_TOKEN_RATES_USD_PER_MILLION["gpt-image-1"]).toBeUndefined();
    expect(
      OPENAI_TOKEN_RATES_USD_PER_MILLION["gpt-image-1-mini"],
    ).toBeUndefined();
    expect(OPENAI_TOKEN_RATES_USD_PER_MILLION["gpt-image-1.5"]).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// calculateOpenAIActualCost – valid usage
// ---------------------------------------------------------------------------

describe("calculateOpenAIActualCost – valid usage", () => {
  it("calculates cost with detailed token breakdown", () => {
    const usage: OpenAIUsage = {
      input_tokens: 500,
      output_tokens: 4000,
      input_tokens_details: {
        text_tokens: 200,
        image_tokens: 300,
      },
    };
    // (200 * 5 + 300 * 8 + 4000 * 30) / 1_000_000
    // = (1000 + 2400 + 120000) / 1_000_000
    // = 123400 / 1_000_000
    // = 0.1234
    const cost = calculateOpenAIActualCost(usage, "gpt-image-2");
    expect(cost).toBeCloseTo(0.1234);
  });

  it("falls back to input_tokens as text when no details", () => {
    const usage: OpenAIUsage = {
      input_tokens: 500,
      output_tokens: 2000,
    };
    // (500 * 5 + 0 * 8 + 2000 * 30) / 1_000_000
    // = (2500 + 0 + 60000) / 1_000_000
    // = 62500 / 1_000_000
    // = 0.0625
    const cost = calculateOpenAIActualCost(usage, "gpt-image-2");
    expect(cost).toBeCloseTo(0.0625);
  });

  it("handles zero image tokens in details", () => {
    const usage: OpenAIUsage = {
      input_tokens: 100,
      output_tokens: 1000,
      input_tokens_details: {
        text_tokens: 100,
        image_tokens: 0,
      },
    };
    // (100 * 5 + 0 * 8 + 1000 * 30) / 1_000_000 = 30500 / 1_000_000
    const cost = calculateOpenAIActualCost(usage, "gpt-image-2");
    expect(cost).toBeCloseTo(0.0305);
  });
});

// ---------------------------------------------------------------------------
// calculateOpenAIActualCost – null returns
// ---------------------------------------------------------------------------

describe("calculateOpenAIActualCost – null returns", () => {
  it("returns null when usage is undefined", () => {
    expect(calculateOpenAIActualCost(undefined, "gpt-image-2")).toBeNull();
  });

  it("returns null for unknown model", () => {
    const usage: OpenAIUsage = {
      input_tokens: 100,
      output_tokens: 1000,
    };
    expect(calculateOpenAIActualCost(usage, "unknown-model")).toBeNull();
  });

  it("returns null when all tokens are zero", () => {
    const usage: OpenAIUsage = {
      input_tokens: 0,
      output_tokens: 0,
      input_tokens_details: {
        text_tokens: 0,
        image_tokens: 0,
      },
    };
    expect(calculateOpenAIActualCost(usage, "gpt-image-2")).toBeNull();
  });

  it("returns null when usage has no token fields", () => {
    const usage: OpenAIUsage = {};
    expect(calculateOpenAIActualCost(usage, "gpt-image-2")).toBeNull();
  });
});
