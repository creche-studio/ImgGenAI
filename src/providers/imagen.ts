// ---------------------------------------------------------------------------
// Imagen Provider – ImgGenAI
// ---------------------------------------------------------------------------

import { GoogleGenAI } from "@google/genai";
import {
  AuthError,
  ProviderError,
  RateLimitError,
  ValidationError,
} from "../errors/index.js";
import type {
  GenerateRequest,
  GenerateResult,
  ImageData,
  Provider,
  ProviderDefinition,
} from "../types/index.js";

/** Compute GCD for aspect ratio calculation. */
function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/** Convert width x height to aspect ratio string (e.g., "1:1"). */
function toAspectRatio(width: number, height: number): string {
  const d = gcd(width, height);
  return `${width / d}:${height / d}`;
}

const IMAGEN_SUPPORTED_RATIOS = [
  "1:1",
  "3:4",
  "4:3",
  "9:16",
  "16:9",
] as const;

function validateSize(size: { width: number; height: number }): void {
  const ratio = toAspectRatio(size.width, size.height);
  if (
    !IMAGEN_SUPPORTED_RATIOS.includes(
      ratio as (typeof IMAGEN_SUPPORTED_RATIOS)[number],
    )
  ) {
    throw new ValidationError(
      `Unsupported aspect ratio ${ratio} (${size.width}x${size.height}) for imagen`,
      `Supported ratios: ${IMAGEN_SUPPORTED_RATIOS.join(", ")}`,
    );
  }
}

export class ImagenProvider implements Provider {
  readonly name = "imagen";
  readonly models = ["imagen-4"];
  readonly maxPromptLength = 480;
  private readonly ai: GoogleGenAI;

  constructor(apiKey: string) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  async generate(request: GenerateRequest): Promise<GenerateResult> {
    validateSize(request.size);
    const aspectRatio = toAspectRatio(request.size.width, request.size.height);

    try {
      const response = await this.ai.models.generateImages({
        model: "imagen-4.0-generate-001",
        prompt: request.prompt,
        config: {
          numberOfImages: request.count,
          aspectRatio,
        },
      });

      const generatedImages = response.generatedImages ?? [];
      const images: ImageData[] = generatedImages.map((item) => ({
        base64: (item.image?.imageBytes as string) ?? "",
        mimeType: "image/png",
      }));

      if (images.length === 0) {
        throw new ProviderError(`${this.name}: API returned 0 images`);
      }

      return { images };
    } catch (error) {
      if (error instanceof ProviderError) throw error;

      const err = error as { status?: number; message?: string };
      if (err.status === 429) {
        throw new RateLimitError(
          `${this.name}: rate limited`,
          "Wait a moment and retry, or check your Gemini API quota",
        );
      }
      if (err.status === 401 || err.status === 403) {
        throw new AuthError(
          `${this.name}: authentication failed`,
          err.status,
          "Verify GEMINI_API_KEY is valid: export GEMINI_API_KEY=...",
        );
      }
      throw new ProviderError(
        `${this.name}: ${err.message ?? "Unknown error"}`,
        err.status,
      );
    }
  }
}

export default {
  name: "imagen",
  models: ["imagen-4"],
  envKey: "GEMINI_API_KEY",
  maxPromptLength: 480,
  factory: ({ apiKey }) => new ImagenProvider(apiKey),
} satisfies ProviderDefinition;
