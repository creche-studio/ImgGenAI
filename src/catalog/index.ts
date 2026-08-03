// ---------------------------------------------------------------------------
// Model Catalog – ImgGenAI
// ---------------------------------------------------------------------------

/**
 * Single source of truth for every model ImgGenAI knows about.
 *
 * Each entry ties together the identifiers, tier alias, and pricing facts
 * that were previously scattered across providers/, cli/aliases.ts, and
 * pricing/. Provider model lists, tier alias tables, and pricing tables are
 * all derived from this table, so a model generation change (deprecation,
 * new model) only ever touches this file.
 *
 * Naming convention:
 * - `shortName` is the user-facing CLI name (e.g. `--model gemini-flash`).
 * - `apiId` is what gets sent to the provider API, and is the key used for
 *   pricing lookups. `resolveModelId` converts shortName → apiId; unknown
 *   names pass through unchanged so provider-side errors stay informative.
 */

import type { ProviderName } from "../types/index.js";

// ---------------------------------------------------------------------------
// Tier
// ---------------------------------------------------------------------------

/** Tier alias identifiers (user-facing quality/price ladder). */
export type Tier = "premium" | "standard" | "economy";
export const DEFAULT_TIER: Tier = "standard";

/** Type guard for Tier values. */
export function isTier(value: string): value is Tier {
  return value === "premium" || value === "standard" || value === "economy";
}

// ---------------------------------------------------------------------------
// ModelSpec
// ---------------------------------------------------------------------------

/** Per-1M-token USD rates (used for OpenAI actual-cost calculation). */
export interface TokenRates {
  readonly input_text: number;
  readonly input_image: number;
  readonly output: number;
}

/** Gemini output resolution classes (imageConfig.imageSize values). */
export type GeminiResolution = "1K" | "2K" | "4K";

export interface ModelSpec {
  readonly provider: ProviderName;
  /** User-facing CLI name. */
  readonly shortName: string;
  /** Id sent to the provider API; key for pricing lookups. */
  readonly apiId: string;
  /** Tier alias that resolves to this model. */
  readonly tier?: Tier;
  /** Tier alias that resolves to this model when --vector is set (recraft). */
  readonly vectorTier?: Tier;
  /** Provider default when neither --model nor --tier picks one. */
  readonly isDefault?: boolean;
  /** Flat USD per image (recraft). Source: provider pricing pages, 2026-05. */
  readonly perImageUSD?: number;
  /** "WxH" → quality → USD per image (openai static table). Source: 2026-07. */
  readonly perImageUSDBySize?: Record<string, Record<string, number>>;
  /**
   * Resolution class → USD per image (gemini static table). Source: 2026-07.
   * The keys double as the model's supported resolutions — a resolution
   * missing here is rejected before the API call (e.g. flash-lite is 1K only).
   */
  readonly perImageUSDByResolution?: Partial<Record<GeminiResolution, number>>;
  /** USD per 1M tokens (actual-cost calculation from usage metadata). */
  readonly tokenRates?: TokenRates;
}

// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------

export const MODEL_CATALOG: readonly ModelSpec[] = [
  // --- openai ---------------------------------------------------------------
  // Single-model lineup: gpt-image-1 / 1-mini / 1.5 were replaced by
  // gpt-image-2 ahead of OpenAI's Dec 1, 2026 shutdown. Only "standard" is
  // tier-mapped; premium/economy fall back to the provider default (same
  // model) — the price ladder within gpt-image-2 is the --quality flag.
  {
    provider: "openai",
    shortName: "gpt-image-2",
    apiId: "gpt-image-2",
    tier: "standard",
    isDefault: true,
    perImageUSDBySize: {
      "1024x1024": { low: 0.006, medium: 0.053, high: 0.211 },
      "1024x1536": { low: 0.005, medium: 0.041, high: 0.165 },
      "1536x1024": { low: 0.005, medium: 0.041, high: 0.165 },
    },
    tokenRates: { input_text: 5, input_image: 8, output: 30 },
  },

  // --- recraft (raster) -----------------------------------------------------
  {
    provider: "recraft",
    shortName: "recraft-v4",
    apiId: "recraftv4",
    tier: "standard",
    isDefault: true,
    perImageUSD: 0.04,
  },
  {
    provider: "recraft",
    shortName: "recraft-v4-pro",
    apiId: "recraftv4_pro",
    tier: "premium",
    perImageUSD: 0.25,
  },
  {
    provider: "recraft",
    shortName: "recraft-v3",
    apiId: "recraftv3",
    perImageUSD: 0.04,
  },
  {
    provider: "recraft",
    shortName: "recraft-v2",
    apiId: "recraftv2",
    tier: "economy",
    perImageUSD: 0.022,
  },

  // --- recraft (vector) -----------------------------------------------------
  {
    provider: "recraft",
    shortName: "recraftv4_vector",
    apiId: "recraftv4_vector",
    vectorTier: "standard",
    perImageUSD: 0.08,
  },
  {
    provider: "recraft",
    shortName: "recraftv4_pro_vector",
    apiId: "recraftv4_pro_vector",
    vectorTier: "premium",
    perImageUSD: 0.3,
  },
  {
    provider: "recraft",
    shortName: "recraftv3_vector",
    apiId: "recraftv3_vector",
    perImageUSD: 0.08,
  },
  {
    provider: "recraft",
    shortName: "recraftv2_vector",
    apiId: "recraftv2_vector",
    vectorTier: "economy",
    perImageUSD: 0.044,
  },

  // --- gemini ---------------------------------------------------------------
  // Successor of the imagen provider: Imagen 4 endpoints shut down on
  // Aug 17, 2026. Pricing is token-based; the per-resolution numbers below
  // are the official per-image equivalents (standard, non-batch).
  {
    provider: "gemini",
    shortName: "gemini-flash-lite",
    apiId: "gemini-3.1-flash-lite-image",
    tier: "economy",
    perImageUSDByResolution: { "1K": 0.0336 },
    tokenRates: { input_text: 0.25, input_image: 0.25, output: 30 },
  },
  {
    provider: "gemini",
    shortName: "gemini-flash",
    apiId: "gemini-3.1-flash-image",
    tier: "standard",
    isDefault: true,
    perImageUSDByResolution: { "1K": 0.067, "2K": 0.101, "4K": 0.151 },
    tokenRates: { input_text: 0.5, input_image: 0.5, output: 60 },
  },
  {
    provider: "gemini",
    shortName: "gemini-pro",
    apiId: "gemini-3-pro-image",
    tier: "premium",
    perImageUSDByResolution: { "1K": 0.134, "2K": 0.134, "4K": 0.24 },
    tokenRates: { input_text: 2, input_image: 2, output: 120 },
  },
];

// ---------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------

/** All catalog entries for a provider, in catalog order. */
export function modelsFor(provider: string): readonly ModelSpec[] {
  return MODEL_CATALOG.filter((m) => m.provider === provider);
}

/** User-facing model names for a provider (what `models[]` lists). */
export function modelNamesFor(provider: string): string[] {
  return modelsFor(provider).map((m) => m.shortName);
}

/** Default model's shortName for a provider (first entry as fallback). */
export function defaultModelFor(provider: string): string {
  const models = modelsFor(provider);
  const def = models.find((m) => m.isDefault) ?? models[0];
  if (!def) {
    throw new Error(`No models in catalog for provider "${provider}"`);
  }
  return def.shortName;
}

/** Find a catalog entry by shortName or apiId. */
export function findModel(
  provider: string,
  nameOrId: string,
): ModelSpec | undefined {
  return MODEL_CATALOG.find(
    (m) =>
      m.provider === provider &&
      (m.shortName === nameOrId || m.apiId === nameOrId),
  );
}

/**
 * Resolve a user-facing model name to its API id.
 * API ids resolve to themselves; unknown names pass through unchanged.
 */
export function resolveModelId(provider: string, nameOrId: string): string {
  return findModel(provider, nameOrId)?.apiId ?? nameOrId;
}

/**
 * Tier → API id table for a provider. Empty when the provider has no
 * tier-mapped models (vector = true reads the recraft vector aliases).
 */
export function tierAliasesFor(
  provider: string,
  vector = false,
): Partial<Record<Tier, string>> {
  const out: Partial<Record<Tier, string>> = {};
  for (const m of modelsFor(provider)) {
    const tier = vector ? m.vectorTier : m.tier;
    if (tier) out[tier] = m.apiId;
  }
  return out;
}
