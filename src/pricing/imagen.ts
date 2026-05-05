// ---------------------------------------------------------------------------
// Imagen Static Pricing – ImgGenAI
// ---------------------------------------------------------------------------

/**
 * Static per-image cost table for Google Imagen models.
 * Key: API model id → USD/image.
 *
 * Source: Google Cloud Vertex AI pricing (as of 2026-05).
 */
export const IMAGEN_PRICING: Record<string, number> = {
  "imagen-4.0-fast-generate-001": 0.02,
  "imagen-4.0-generate-001": 0.04,
  "imagen-4.0-ultra-generate-001": 0.06,
};
