// ---------------------------------------------------------------------------
// Pricing Registry – per-image cost dispatcher – ImgGenAI
// ---------------------------------------------------------------------------

import { GEMINI_PRICING, resolutionForSize } from "./gemini.js";
import { OPENAI_PRICING } from "./openai.js";
import { RECRAFT_PRICING } from "./recraft.js";

/**
 * Look up the static per-image cost for a single image generation.
 *
 * @param provider - Provider name (e.g. "openai", "recraft", "gemini")
 * @param model    - API model id (e.g. "gpt-image-2", "recraftv4")
 * @param size     - Output image dimensions
 * @param quality  - Quality level (only significant for OpenAI)
 * @returns USD per image, or `null` if the combination is not in the table
 */
export function perImageCost(
  provider: string,
  model: string,
  size: { width: number; height: number },
  quality?: string,
): number | null {
  switch (provider) {
    case "openai": {
      const sizeKey = `${size.width}x${size.height}`;
      const modelTable = OPENAI_PRICING[model];
      if (!modelTable) return null;
      const sizeTable = modelTable[sizeKey];
      if (!sizeTable) return null;
      if (!quality) return null;
      return sizeTable[quality] ?? null;
    }
    case "recraft":
      return RECRAFT_PRICING[model] ?? null;
    case "gemini": {
      const modelTable = GEMINI_PRICING[model];
      if (!modelTable) return null;
      return modelTable[resolutionForSize(size)] ?? null;
    }
    default:
      return null;
  }
}
