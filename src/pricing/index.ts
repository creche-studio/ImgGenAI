// ---------------------------------------------------------------------------
// Pricing Module – barrel exports – ImgGenAI
// ---------------------------------------------------------------------------

export { OPENAI_PRICING } from "./openai.js";
export {
  OPENAI_TOKEN_RATES_USD_PER_MILLION,
  calculateOpenAIActualCost,
} from "./openai-tokens.js";
export type { OpenAITokenRate, OpenAIUsage } from "./openai-tokens.js";
export { RECRAFT_PRICING } from "./recraft.js";
export {
  GEMINI_PRICING,
  calculateGeminiActualCost,
  resolutionForSize,
} from "./gemini.js";
export type { GeminiUsage } from "./gemini.js";
export { perImageCost } from "./registry.js";

// ---------------------------------------------------------------------------
// calculateCost – public API for static cost estimation
// ---------------------------------------------------------------------------

import { perImageCost } from "./registry.js";

/** Query parameters for static cost calculation. */
export interface CostQuery {
  readonly provider: string;
  /** API model id (post-modelMap resolution). */
  readonly model: string;
  readonly size: { readonly width: number; readonly height: number };
  readonly quality?: string;
  readonly count: number;
}

/**
 * Calculate total static (estimated) cost for a batch of image generations.
 *
 * @returns Total USD cost, or `null` if the per-image cost is unknown.
 */
export function calculateCost(query: CostQuery): number | null {
  const unitCost = perImageCost(
    query.provider,
    query.model,
    query.size,
    query.quality,
  );
  if (unitCost === null) return null;
  return unitCost * query.count;
}
