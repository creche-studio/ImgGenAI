// ---------------------------------------------------------------------------
// OpenAI Static Pricing – ImgGenAI
// ---------------------------------------------------------------------------

/**
 * Static per-image cost table for OpenAI image models.
 * Key hierarchy: model → "WxH" → quality → USD/image.
 *
 * Source: OpenAI pricing page (as of 2026-05).
 * `quality: "auto"` is resolved server-side, so it has no static entry —
 * the dynamic (token-based) path handles it instead.
 */
export const OPENAI_PRICING: Record<
  string,
  Record<string, Record<string, number>>
> = {
  "gpt-image-1": {
    "1024x1024": { low: 0.011, medium: 0.042, high: 0.167 },
    "1024x1536": { low: 0.016, medium: 0.063, high: 0.25 },
    "1536x1024": { low: 0.016, medium: 0.063, high: 0.25 },
  },
  "gpt-image-1-mini": {
    "1024x1024": { low: 0.005, medium: 0.011, high: 0.036 },
    "1024x1536": { low: 0.006, medium: 0.015, high: 0.052 },
    "1536x1024": { low: 0.006, medium: 0.015, high: 0.052 },
  },
  "gpt-image-1.5": {
    "1024x1024": { low: 0.009, medium: 0.034, high: 0.13 },
    "1024x1536": { low: 0.013, medium: 0.05, high: 0.2 },
    "1536x1024": { low: 0.013, medium: 0.05, high: 0.2 },
  },
};
