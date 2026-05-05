// ---------------------------------------------------------------------------
// Recraft Static Pricing – ImgGenAI
// ---------------------------------------------------------------------------

/**
 * Static per-image cost table for Recraft models.
 * Key: API model id → USD/image.
 *
 * Source: Recraft pricing page (as of 2026-05).
 */
export const RECRAFT_PRICING: Record<string, number> = {
  recraftv4: 0.04,
  recraftv4_pro: 0.25,
  recraftv3: 0.04,
  recraftv2: 0.022,
  recraftv4_vector: 0.08,
  recraftv4_pro_vector: 0.3,
  recraftv3_vector: 0.08,
  recraftv2_vector: 0.044,
};
