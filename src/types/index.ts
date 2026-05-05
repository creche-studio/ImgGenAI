// ---------------------------------------------------------------------------
// Domain Types – ImgGenAI
// ---------------------------------------------------------------------------

/** Raw image data returned by a provider. */
export interface ImageData {
  readonly base64: string;
  readonly mimeType: string;
}

/** Request handed to a Provider#generate call. */
export interface GenerateRequest {
  readonly prompt: string;
  readonly count: number;
  readonly size: { readonly width: number; readonly height: number };
  readonly model?: string;
  readonly quality?: string;
}

/** Usage metadata returned by providers that expose token-level billing. */
export interface UsageMetadata {
  readonly inputTokens?: number;
  readonly outputTokens?: number;
}

/** Result returned from a single Provider#generate call. */
export interface GenerateResult {
  readonly images: ImageData[];
  /** Token/credit usage breakdown (when available from the API response). */
  readonly usage?: UsageMetadata;
  /** Non-fatal warnings from the provider (e.g. content filtered). */
  readonly warnings?: readonly string[];
  /** Actual USD cost computed from provider response (e.g. token usage). */
  readonly actualCost?: number | null;
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

/**
 * Known provider identifiers. Literal union for type-safe provider selection.
 */
export type ProviderName = "openai" | "recraft" | "imagen";

/** Type guard for ProviderName. */
export function isProviderName(value: string): value is ProviderName {
  return value === "openai" || value === "recraft" || value === "imagen";
}

/** Balance information for a provider's remaining credit. */
export interface BalanceInfo {
  readonly provider: string;
  readonly usd: number | null;
  readonly raw?: number;
  readonly error?: string;
}

/** Whether cost was derived from API response or static table. */
export type CostSource = "actual" | "estimated";

export interface Provider {
  readonly name: string;
  readonly models: string[];
  readonly qualities?: readonly string[];
  readonly defaultModel?: string;
  readonly defaultQuality?: string;
  readonly maxPromptLength: number;
  generate(request: GenerateRequest): Promise<GenerateResult>;
  getBalance?(): Promise<BalanceInfo | null>;
}

export interface ProviderDefinition {
  readonly name: string;
  readonly models: string[];
  readonly qualities?: readonly string[];
  readonly defaultModel?: string;
  readonly defaultQuality?: string;
  readonly envKey: string;
  readonly maxPromptLength: number;
  readonly factory: (config: { apiKey: string }) => Provider;
}

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

export interface ProviderEntry {
  readonly name: ProviderName;
  readonly model?: string;
  readonly quality?: string;
}

export interface PresetParams {
  readonly name: string;
  readonly description?: string;
  readonly size: { readonly width: number; readonly height: number };
}

export interface PipelineOptions {
  readonly count?: number;
  readonly size?: { readonly width: number; readonly height: number };
}

export interface PipelineInput {
  readonly prompt: string;
  readonly providers: ProviderEntry[];
  readonly preset?: string;
  readonly outputDir?: string;
  readonly options?: PipelineOptions;
}

export interface ProviderResult {
  readonly provider: string;
  readonly model: string;
  readonly quality?: string;
  readonly success: boolean;
  readonly outputs: string[];
  readonly duration: number;
  readonly error?: string;
  readonly cost: number | null;
  readonly costSource?: CostSource;
}

export interface PipelineResult {
  readonly success: boolean;
  readonly outputDir: string;
  readonly results: ProviderResult[];
  readonly balances?: readonly BalanceInfo[];
  readonly totalCost?: number | null;
}

// ---------------------------------------------------------------------------
// Manifest
// ---------------------------------------------------------------------------

export interface ManifestEntry {
  readonly timestamp: string;
  readonly provider: string;
  readonly prompt: string;
  readonly params: {
    readonly count: number;
    readonly size: { readonly width: number; readonly height: number };
  };
  readonly outputs: string[];
  readonly duration: number;
  readonly cost: number | null;
  readonly costSource?: CostSource;
}
