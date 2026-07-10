// ---------------------------------------------------------------------------
// Recraft Provider – ImgGenAI
// ---------------------------------------------------------------------------

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
import type {
  BalanceInfo,
  GenerateRequest,
  GenerateResult,
  ImageData,
  Provider,
  ProviderDefinition,
} from "../types/index.js";

function validateSize(size: { width: number; height: number }): void {
  if (size.width < 64 || size.height < 64) {
    throw new ValidationError(
      `Size too small for recraft: ${size.width}x${size.height}`,
      "Minimum dimension is 64px",
    );
  }
  if (size.width > 2048 || size.height > 2048) {
    throw new ValidationError(
      `Size too large for recraft: ${size.width}x${size.height}`,
      "Maximum dimension is 2048px",
    );
  }
}

const ENDPOINT = "https://external.api.recraft.ai/v1/images/generations";
const BALANCE_ENDPOINT = "https://external.api.recraft.ai/v1/users/me";

interface RecraftResponseItem {
  b64_json: string;
}

interface RecraftResponse {
  data: RecraftResponseItem[];
}

export class RecraftProvider implements Provider {
  readonly name = "recraft";
  readonly models = modelNamesFor("recraft");
  readonly defaultModel = defaultModelFor("recraft");
  readonly maxPromptLength = 1000;
  private readonly apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async generate(request: GenerateRequest): Promise<GenerateResult> {
    validateSize(request.size);

    const apiModel = resolveModelId(
      this.name,
      request.model ?? this.defaultModel,
    );

    const body = {
      model: apiModel,
      prompt: request.prompt,
      n: request.count,
      width: request.size.width,
      height: request.size.height,
      response_format: "b64_json",
    };

    try {
      const response = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        if (response.status === 429) {
          throw new RateLimitError(
            `${this.name}: rate limited`,
            "Wait a moment and retry, or check your credit balance",
          );
        }
        if (response.status === 401 || response.status === 403) {
          throw new AuthError(
            `${this.name}: authentication failed`,
            response.status,
            "Verify RECRAFT_API_TOKEN is valid: export RECRAFT_API_TOKEN=...",
          );
        }
        const errorText = await response.text().catch(() => "Unknown error");
        throw new ProviderError(
          `${this.name}: HTTP ${response.status} - ${errorText}`,
          response.status,
        );
      }

      const json = (await response.json()) as RecraftResponse;

      const images: ImageData[] = (json.data ?? []).map((item) => ({
        base64: item.b64_json,
        mimeType: "image/png",
      }));

      if (images.length === 0) {
        throw new ProviderError(`${this.name}: API returned 0 images`);
      }

      return { images };
    } catch (error) {
      if (error instanceof ProviderError) throw error;
      throw new ProviderError(
        `${this.name}: ${(error as Error).message ?? "Unknown error"}`,
      );
    }
  }

  async getBalance(): Promise<BalanceInfo | null> {
    try {
      const res = await fetch(BALANCE_ENDPOINT, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return null;
      const json = (await res.json()) as { credits: number };
      return {
        provider: "recraft",
        usd: json.credits / 1000,
        raw: json.credits,
      };
    } catch {
      return null;
    }
  }
}

export default {
  name: "recraft",
  models: modelNamesFor("recraft"),
  defaultModel: defaultModelFor("recraft"),
  envKey: "RECRAFT_API_TOKEN",
  maxPromptLength: 1000,
  factory: ({ apiKey }) => new RecraftProvider(apiKey),
} satisfies ProviderDefinition;
