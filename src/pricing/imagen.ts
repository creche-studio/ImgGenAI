// ---------------------------------------------------------------------------
// Imagen Static Pricing – ImgGenAI
// ---------------------------------------------------------------------------

import { modelsFor } from "../catalog/index.js";

/**
 * Static per-image cost table for Google Imagen models.
 * Key: API model id → USD/image. Derived from the model catalog.
 */
export const IMAGEN_PRICING: Record<string, number> = Object.fromEntries(
  modelsFor("imagen")
    .filter((m) => m.perImageUSD !== undefined)
    .map((m) => [m.apiId, m.perImageUSD as number]),
);
