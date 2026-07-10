// ---------------------------------------------------------------------------
// Tier Aliases – ImgGenAI
// ---------------------------------------------------------------------------

/**
 * Abstraction layer for model selection. Users pick a tier (premium / standard
 * / economy) and the alias table resolves it to the model id passed to the API.
 *
 * The tables here are derived from the model catalog (src/catalog) — edit the
 * catalog, not this file, when models change.
 */

import {
  DEFAULT_TIER,
  MODEL_CATALOG,
  isTier,
  tierAliasesFor,
} from "../catalog/index.js";
import type { Tier } from "../catalog/index.js";

export { DEFAULT_TIER, isTier };
export type { Tier };

/**
 * Tier alias table. Maps provider name × tier to the model id that will be
 * passed to the API. Derived from the catalog's tier-mapped entries.
 */
export const TIER_ALIASES: Record<
  string,
  Record<Tier, string>
> = Object.fromEntries(
  [...new Set(MODEL_CATALOG.filter((m) => m.tier).map((m) => m.provider))].map(
    (provider) => [provider, tierAliasesFor(provider) as Record<Tier, string>],
  ),
);

/**
 * Recraft vector tier aliases. When --vector is specified, Recraft resolves
 * to these model ids instead of the raster ones.
 */
export const RECRAFT_VECTOR_ALIASES: Record<Tier, string> = tierAliasesFor(
  "recraft",
  true,
) as Record<Tier, string>;

/**
 * Resolve a tier alias to a provider-internal model id.
 *
 * @param provider - Provider name (e.g. "openai", "recraft", "imagen")
 * @param tier - Tier to resolve (default: "standard")
 * @param vector - If true, use Recraft's vector alias table
 * @returns The resolved model id, or undefined if the provider has no alias table
 */
export function resolveTier(
  provider: string,
  tier: Tier = DEFAULT_TIER,
  vector = false,
): string | undefined {
  if (vector && provider === "recraft") {
    return RECRAFT_VECTOR_ALIASES[tier];
  }
  const providerAliases = TIER_ALIASES[provider];
  if (!providerAliases) return undefined;
  return providerAliases[tier];
}
