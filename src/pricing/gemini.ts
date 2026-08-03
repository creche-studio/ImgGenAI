// ---------------------------------------------------------------------------
// Gemini Pricing – ImgGenAI
// ---------------------------------------------------------------------------

import { findModel, modelsFor } from "../catalog/index.js";
import type { GeminiResolution } from "../catalog/index.js";

/**
 * Static per-image cost table for Gemini image models.
 * Key hierarchy: API model id → resolution class → USD/image.
 * Derived from the model catalog.
 */
export const GEMINI_PRICING: Record<
  string,
  Partial<Record<GeminiResolution, number>>
> = Object.fromEntries(
  modelsFor("gemini")
    .filter((m) => m.perImageUSDByResolution !== undefined)
    .map((m) => [
      m.apiId,
      m.perImageUSDByResolution as Partial<Record<GeminiResolution, number>>,
    ]),
);

/**
 * Map a WxH request size to Gemini's resolution class (imageConfig.imageSize).
 * The class is decided by the longest edge; billing follows the class.
 */
export function resolutionForSize(size: {
  width: number;
  height: number;
}): GeminiResolution {
  const maxDim = Math.max(size.width, size.height);
  if (maxDim <= 1024) return "1K";
  if (maxDim <= 2048) return "2K";
  return "4K";
}

/** Token usage of a Gemini generateContent response (usageMetadata). */
export interface GeminiUsage {
  readonly inputTokens?: number;
  readonly outputTokens?: number;
}

/**
 * Calculate actual USD cost from Gemini usage metadata.
 *
 * Image output is billed as output tokens (resolution decides the token
 * count), so promptTokenCount × input rate + candidatesTokenCount × output
 * rate covers the whole request.
 *
 * Returns `null` when usage is missing, the model has no rate entry, or the
 * computed cost is not a positive finite number.
 */
export function calculateGeminiActualCost(
  usage: GeminiUsage | undefined,
  model: string,
): number | null {
  if (!usage) return null;

  const rates = findModel("gemini", model)?.tokenRates;
  if (!rates) return null;

  const inputTokens = usage.inputTokens ?? 0;
  const outputTokens = usage.outputTokens ?? 0;

  const cost =
    (inputTokens * rates.input_text + outputTokens * rates.output) / 1_000_000;

  if (!Number.isFinite(cost) || cost <= 0) return null;

  return cost;
}
