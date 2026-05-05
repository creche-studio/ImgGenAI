// ---------------------------------------------------------------------------
// OpenAI Token-Based Pricing (Dynamic / Actual Cost) – ImgGenAI
// ---------------------------------------------------------------------------

/** Per-model token rates in USD per 1 million tokens. */
export interface OpenAITokenRate {
  readonly input_text: number;
  readonly input_image: number;
  readonly output: number;
}

/** Token usage from an OpenAI image generation response. */
export interface OpenAIUsage {
  readonly input_tokens?: number;
  readonly output_tokens?: number;
  readonly input_tokens_details?: {
    readonly text_tokens?: number;
    readonly image_tokens?: number;
  };
}

/**
 * Token rates per model, in USD per million tokens.
 * Source: OpenAI pricing page (as of 2026-05).
 */
export const OPENAI_TOKEN_RATES_USD_PER_MILLION: Record<
  string,
  OpenAITokenRate
> = {
  "gpt-image-1": { input_text: 5, input_image: 10, output: 40 },
  "gpt-image-1-mini": { input_text: 2, input_image: 2.5, output: 8 },
  "gpt-image-1.5": { input_text: 5, input_image: 10, output: 32 },
};

/**
 * Calculate actual USD cost from an OpenAI image response's usage field.
 *
 * Returns `null` when the calculation cannot be performed:
 * - `usage` is missing or undefined
 * - Model has no known rate table entry
 * - Computed cost is not a positive finite number
 */
export function calculateOpenAIActualCost(
  usage: OpenAIUsage | undefined,
  model: string,
): number | null {
  if (!usage) return null;

  const rate = OPENAI_TOKEN_RATES_USD_PER_MILLION[model];
  if (!rate) return null;

  const textTokens = usage.input_tokens_details?.text_tokens ?? 0;
  const imageTokens = usage.input_tokens_details?.image_tokens ?? 0;
  const outputTokens = usage.output_tokens ?? 0;

  // If no detailed breakdown, fall back to total input_tokens as text
  const inputText =
    textTokens === 0 && imageTokens === 0
      ? (usage.input_tokens ?? 0)
      : textTokens;
  const inputImage = imageTokens;

  const cost =
    (inputText * rate.input_text +
      inputImage * rate.input_image +
      outputTokens * rate.output) /
    1_000_000;

  if (!Number.isFinite(cost) || cost <= 0) return null;

  return cost;
}
