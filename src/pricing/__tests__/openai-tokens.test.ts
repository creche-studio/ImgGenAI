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
  it("has rates for gpt-image-1", () => {
    const rate = OPENAI_TOKEN_RATES_USD_PER_MILLION["gpt-image-1"];
    expect(rate).toEqual({ input_text: 5, input_image: 10, output: 40 });
  });

  it("has rates for gpt-image-1-mini", () => {
    const rate = OPENAI_TOKEN_RATES_USD_PER_MILLION["gpt-image-1-mini"];
    expect(rate).toEqual({ input_text: 2, input_image: 2.5, output: 8 });
  });

  it("has rates for gpt-image-1.5", () => {
    const rate = OPENAI_TOKEN_RATES_USD_PER_MILLION["gpt-image-1.5"];
    expect(rate).toEqual({ input_text: 5, input_image: 10, output: 32 });
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
    // (200 * 5 + 300 * 10 + 4000 * 40) / 1_000_000
    // = (1000 + 3000 + 160000) / 1_000_000
    // = 164000 / 1_000_000
    // = 0.164
    const cost = calculateOpenAIActualCost(usage, "gpt-image-1");
    expect(cost).toBeCloseTo(0.164);
  });

  it("falls back to input_tokens as text when no details", () => {
    const usage: OpenAIUsage = {
      input_tokens: 500,
      output_tokens: 2000,
    };
    // (500 * 5 + 0 * 10 + 2000 * 40) / 1_000_000
    // = (2500 + 0 + 80000) / 1_000_000
    // = 82500 / 1_000_000
    // = 0.0825
    const cost = calculateOpenAIActualCost(usage, "gpt-image-1");
    expect(cost).toBeCloseTo(0.0825);
  });

  it("calculates cost for gpt-image-1-mini", () => {
    const usage: OpenAIUsage = {
      input_tokens: 1000,
      output_tokens: 10000,
      input_tokens_details: {
        text_tokens: 600,
        image_tokens: 400,
      },
    };
    // (600 * 2 + 400 * 2.5 + 10000 * 8) / 1_000_000
    // = (1200 + 1000 + 80000) / 1_000_000
    // = 82200 / 1_000_000
    // = 0.0822
    const cost = calculateOpenAIActualCost(usage, "gpt-image-1-mini");
    expect(cost).toBeCloseTo(0.0822);
  });

  it("calculates cost for gpt-image-1.5", () => {
    const usage: OpenAIUsage = {
      input_tokens: 300,
      output_tokens: 5000,
      input_tokens_details: {
        text_tokens: 100,
        image_tokens: 200,
      },
    };
    // (100 * 5 + 200 * 10 + 5000 * 32) / 1_000_000
    // = (500 + 2000 + 160000) / 1_000_000
    // = 162500 / 1_000_000
    // = 0.1625
    const cost = calculateOpenAIActualCost(usage, "gpt-image-1.5");
    expect(cost).toBeCloseTo(0.1625);
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
    // (100 * 5 + 0 * 10 + 1000 * 40) / 1_000_000 = 40500 / 1_000_000
    const cost = calculateOpenAIActualCost(usage, "gpt-image-1");
    expect(cost).toBeCloseTo(0.0405);
  });
});

// ---------------------------------------------------------------------------
// calculateOpenAIActualCost – null returns
// ---------------------------------------------------------------------------

describe("calculateOpenAIActualCost – null returns", () => {
  it("returns null when usage is undefined", () => {
    expect(calculateOpenAIActualCost(undefined, "gpt-image-1")).toBeNull();
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
    expect(calculateOpenAIActualCost(usage, "gpt-image-1")).toBeNull();
  });

  it("returns null when usage has no token fields", () => {
    const usage: OpenAIUsage = {};
    expect(calculateOpenAIActualCost(usage, "gpt-image-1")).toBeNull();
  });
});
