// ---------------------------------------------------------------------------
// Recraft Provider – ImgGenAI
// ---------------------------------------------------------------------------

import { AuthError, ProviderError, RateLimitError } from "../errors/index.js";
import type {
  GenerateRequest,
  GenerateResult,
  ImageData,
  Provider,
  ProviderDefinition,
} from "../types/index.js";

const ENDPOINT = "https://external.api.recraft.ai/v1/images/generations";

interface RecraftResponseItem {
  b64_json: string;
}

interface RecraftResponse {
  data: RecraftResponseItem[];
}

export class RecraftProvider implements Provider {
  readonly name = "recraft";
  readonly models = ["recraft-v4"];
  readonly maxPromptLength = 1000;
  private readonly apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async generate(request: GenerateRequest): Promise<GenerateResult> {
    const body = {
      model: "recraftv4",
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
          throw new RateLimitError(`${this.name}: rate limited`);
        }
        if (response.status === 401 || response.status === 403) {
          throw new AuthError(
            `${this.name}: authentication failed`,
            response.status,
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
}

export default {
  name: "recraft",
  models: ["recraft-v4"],
  envKey: "RECRAFT_API_TOKEN",
  maxPromptLength: 1000,
  factory: ({ apiKey }) => new RecraftProvider(apiKey),
} satisfies ProviderDefinition;
