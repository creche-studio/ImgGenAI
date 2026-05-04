// ---------------------------------------------------------------------------
// OpenAI Provider – ImgGenAI
// ---------------------------------------------------------------------------

import OpenAI from "openai";
import { AuthError, ProviderError, RateLimitError } from "../errors/index.js";
import type {
  GenerateRequest,
  GenerateResult,
  ImageData,
  Provider,
  ProviderDefinition,
} from "../types/index.js";

export class OpenAIProvider implements Provider {
  readonly name = "openai";
  readonly models = ["gpt-image-1-mini", "gpt-image-1.5"];
  readonly maxPromptLength = 32000;
  private readonly client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async generate(request: GenerateRequest): Promise<GenerateResult> {
    const size = `${request.size.width}x${request.size.height}`;

    try {
      const response = await this.client.images.generate({
        model: "gpt-image-1",
        prompt: request.prompt,
        n: request.count,
        size: size as "1024x1024" | "1536x1024" | "1024x1536" | "auto",
        output_format: "png",
        quality: "low",
      });

      const images: ImageData[] = (response.data ?? []).map((item) => ({
        base64: item.b64_json ?? "",
        mimeType: "image/png",
      }));

      if (images.length === 0) {
        throw new ProviderError(`${this.name}: API returned 0 images`);
      }

      return { images };
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
  models: ["gpt-image-1-mini", "gpt-image-1.5"],
  envKey: "OPENAI_API_KEY",
  maxPromptLength: 32000,
  factory: ({ apiKey }) => new OpenAIProvider(apiKey),
} satisfies ProviderDefinition;
