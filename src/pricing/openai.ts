// ---------------------------------------------------------------------------
// OpenAI Static Pricing – ImgGenAI
// ---------------------------------------------------------------------------

import { modelsFor } from "../catalog/index.js";

/**
 * Static per-image cost table for OpenAI image models.
 * Key hierarchy: model → "WxH" → quality → USD/image.
 * Derived from the model catalog.
 *
 * `quality: "auto"` is resolved server-side, so it has no static entry —
 * the dynamic (token-based) path handles it instead.
 */
export const OPENAI_PRICING: Record<
  string,
  Record<string, Record<string, number>>
> = Object.fromEntries(
  modelsFor("openai")
    .filter((m) => m.perImageUSDBySize !== undefined)
    .map((m) => [
      m.apiId,
      m.perImageUSDBySize as Record<string, Record<string, number>>,
    ]),
);
