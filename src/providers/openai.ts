// ---------------------------------------------------------------------------
// OpenAI Provider – ImgGenAI
// ---------------------------------------------------------------------------

import OpenAI from "openai";
import {
  defaultModelFor,
  modelNamesFor,
  resolveModelId,
} from "../catalog/index.js";
import {
  AuthError,
  ProviderError,
  RateLimitError,
  ValidationError,
} from "../errors/index.js";
import { calculateOpenAIActualCost } from "../pricing/openai-tokens.js";
import type { OpenAIUsage } from "../pricing/openai-tokens.js";
import type {
  GenerateRequest,
  GenerateResult,
  ImageData,
  Provider,
  ProviderDefinition,
  UsageMetadata,
} from "../types/index.js";

const OPENAI_SUPPORTED_SIZES = [
  { width: 1024, height: 1024 },
  { width: 1536, height: 1024 },
  { width: 1024, height: 1536 },
] as const;

function validateSize(size: { width: number; height: number }): void {
  const valid = OPENAI_SUPPORTED_SIZES.some(
    (s) => s.width === size.width && s.height === size.height,
  );
  if (!valid) {
    const allowed = OPENAI_SUPPORTED_SIZES.map(
      (s) => `${s.width}x${s.height}`,
    ).join(", ");
    throw new ValidationError(
      `Unsupported size ${size.width}x${size.height} for openai`,
      `Allowed sizes: ${allowed}`,
    );
  }
}

export class OpenAIProvider implements Provider {
  readonly name = "openai";
  readonly models = modelNamesFor("openai");
  readonly qualities = ["low", "medium", "high", "auto"] as const;
  readonly defaultModel = defaultModelFor("openai");
  readonly defaultQuality = "auto";
  readonly maxPromptLength = 32000;
  private readonly client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async generate(request: GenerateRequest): Promise<GenerateResult> {
    validateSize(request.size);

    const model = resolveModelId(this.name, request.model ?? this.defaultModel);
    const quality = request.quality ?? this.defaultQuality;

    try {
      const response = await this.client.images.generate({
        model,
        prompt: request.prompt,
        n: request.count,
        size: `${request.size.width}x${request.size.height}` as
          | "1024x1024"
          | "1536x1024"
          | "1024x1536",
        output_format: "png",
        quality: quality as "low" | "medium" | "high" | "auto",
      });

      const images: ImageData[] = (response.data ?? []).map((item) => ({
        base64: item.b64_json ?? "",
        mimeType: "image/png",
      }));

      if (images.length === 0) {
        throw new ProviderError(`${this.name}: API returned 0 images`);
      }

      const usage: UsageMetadata | undefined = response.usage
        ? {
            inputTokens: response.usage.input_tokens,
            outputTokens: response.usage.output_tokens,
          }
        : undefined;

      const actualCost = calculateOpenAIActualCost(
        response.usage as OpenAIUsage | undefined,
        model,
      );

      return { images, ...(usage ? { usage } : {}), actualCost };
    } catch (error) {
      if (error instanceof ProviderError) throw error;

      const apiError = error as { status?: number; message?: string };
      if (apiError.status === 429) {
        throw new RateLimitError(
          `${this.name}: rate limited`,
          "Wait a moment and retry, or check your usage limits at platform.openai.com",
        );
      }
      if (apiError.status === 401 || apiError.status === 403) {
        throw new AuthError(
          `${this.name}: authentication failed`,
          apiError.status,
          "Verify OPENAI_API_KEY is valid: export OPENAI_API_KEY=sk-...",
        );
      }
      throw new ProviderError(
        `${this.name}: ${apiError.message ?? "Unknown API error"}`,
        apiError.status,
      );
    }
  }
}

export default {
  name: "openai",
  models: modelNamesFor("openai"),
  qualities: ["low", "medium", "high", "auto"],
  defaultModel: defaultModelFor("openai"),
  defaultQuality: "auto",
  envKey: "OPENAI_API_KEY",
  maxPromptLength: 32000,
  factory: ({ apiKey }) => new OpenAIProvider(apiKey),
} satisfies ProviderDefinition;
