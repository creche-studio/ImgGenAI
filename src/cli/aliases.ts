// ---------------------------------------------------------------------------
// Tier Aliases – ImgGenAI
// ---------------------------------------------------------------------------

/**
 * Abstraction layer for model selection. Users pick a tier (premium / standard
 * / economy) and the alias table resolves it to the provider-internal model id.
 */

export type Tier = "premium" | "standard" | "economy";
export const DEFAULT_TIER: Tier = "standard";

/**
 * Tier alias table. Maps provider name × tier to the provider-internal model
 * id that will be passed to the API.
 */
export const TIER_ALIASES: Record<string, Record<Tier, string>> = {
  openai: {
    premium: "gpt-image-1.5",
    standard: "gpt-image-1",
    economy: "gpt-image-1-mini",
  },
  recraft: {
    premium: "recraftv4_pro",
    standard: "recraftv4",
    economy: "recraftv2",
  },
  imagen: {
    premium: "imagen-4.0-ultra-generate-001",
    standard: "imagen-4.0-generate-001",
    economy: "imagen-4.0-fast-generate-001",
  },
};

/**
 * Recraft vector tier aliases. When --vector is specified, Recraft resolves
 * to these model ids instead of the raster ones.
 */
export const RECRAFT_VECTOR_ALIASES: Record<Tier, string> = {
  premium: "recraftv4_pro_vector",
  standard: "recraftv4_vector",
  economy: "recraftv2_vector",
};

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

/**
 * Type guard for Tier values.
 */
export function isTier(value: string): value is Tier {
  return value === "premium" || value === "standard" || value === "economy";
}
