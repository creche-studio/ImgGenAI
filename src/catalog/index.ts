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
 * - `shortName` is the user-facing CLI name (e.g. `--model imagen-4`).
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
  /** Flat USD per image (recraft, imagen). Source: provider pricing pages, 2026-05. */
  readonly perImageUSD?: number;
  /** "WxH" → quality → USD per image (openai static table). Source: 2026-05. */
  readonly perImageUSDBySize?: Record<string, Record<string, number>>;
  /** USD per 1M tokens (openai actual-cost calculation). Source: 2026-05. */
  readonly tokenRates?: TokenRates;
}

// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------

export const MODEL_CATALOG: readonly ModelSpec[] = [
  // --- openai ---------------------------------------------------------------
  {
    provider: "openai",
    shortName: "gpt-image-1",
    apiId: "gpt-image-1",
    tier: "standard",
    isDefault: true,
    perImageUSDBySize: {
      "1024x1024": { low: 0.011, medium: 0.042, high: 0.167 },
      "1024x1536": { low: 0.016, medium: 0.063, high: 0.25 },
      "1536x1024": { low: 0.016, medium: 0.063, high: 0.25 },
    },
    tokenRates: { input_text: 5, input_image: 10, output: 40 },
  },
  {
    provider: "openai",
    shortName: "gpt-image-1-mini",
    apiId: "gpt-image-1-mini",
    tier: "economy",
    perImageUSDBySize: {
      "1024x1024": { low: 0.005, medium: 0.011, high: 0.036 },
      "1024x1536": { low: 0.006, medium: 0.015, high: 0.052 },
      "1536x1024": { low: 0.006, medium: 0.015, high: 0.052 },
    },
    tokenRates: { input_text: 2, input_image: 2.5, output: 8 },
  },
  {
    provider: "openai",
    shortName: "gpt-image-1.5",
    apiId: "gpt-image-1.5",
    tier: "premium",
    perImageUSDBySize: {
      "1024x1024": { low: 0.009, medium: 0.034, high: 0.13 },
      "1024x1536": { low: 0.013, medium: 0.05, high: 0.2 },
      "1536x1024": { low: 0.013, medium: 0.05, high: 0.2 },
    },
    tokenRates: { input_text: 5, input_image: 10, output: 32 },
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

  // --- imagen ---------------------------------------------------------------
  {
    provider: "imagen",
    shortName: "imagen-4-fast",
    apiId: "imagen-4.0-fast-generate-001",
    tier: "economy",
    perImageUSD: 0.02,
  },
  {
    provider: "imagen",
    shortName: "imagen-4",
    apiId: "imagen-4.0-generate-001",
    tier: "standard",
    isDefault: true,
    perImageUSD: 0.04,
  },
  {
    provider: "imagen",
    shortName: "imagen-4-ultra",
    apiId: "imagen-4.0-ultra-generate-001",
    tier: "premium",
    perImageUSD: 0.06,
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

/**
 * Resolve a user-facing model name to its API id.
 * API ids resolve to themselves; unknown names pass through unchanged.
 */
export function resolveModelId(provider: string, nameOrId: string): string {
  const hit = MODEL_CATALOG.find(
    (m) =>
      m.provider === provider &&
      (m.shortName === nameOrId || m.apiId === nameOrId),
  );
  return hit ? hit.apiId : nameOrId;
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
