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
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export interface Provider {
  readonly name: string;
  readonly models: string[];
  readonly maxPromptLength: number;
  generate(request: GenerateRequest): Promise<GenerateResult>;
}

export interface ProviderDefinition {
  readonly name: string;
  readonly models: string[];
  readonly envKey: string;
  readonly maxPromptLength: number;
  readonly factory: (config: { apiKey: string }) => Provider;
}

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

export interface ProviderEntry {
  readonly name: string;
  readonly model?: string;
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
  readonly success: boolean;
  readonly outputs: string[];
  readonly duration: number;
  readonly error?: string;
}

export interface PipelineResult {
  readonly success: boolean;
  readonly outputDir: string;
  readonly results: ProviderResult[];
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
}
