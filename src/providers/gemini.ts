// ---------------------------------------------------------------------------
// Gemini Provider – ImgGenAI
// ---------------------------------------------------------------------------

// Successor of the Imagen provider: the Imagen 4 endpoints shut down on
// Aug 17, 2026, and Google's migration path is the Gemini image model
// family. Unlike Imagen's dedicated generateImages API, Gemini image models
// generate through generateContent and return images as inlineData parts.

import { GoogleGenAI } from "@google/genai";
import {
  defaultModelFor,
  findModel,
  modelNamesFor,
  resolveModelId,
} from "../catalog/index.js";
import {
  AuthError,
  ProviderError,
  RateLimitError,
  ValidationError,
} from "../errors/index.js";
import {
  calculateGeminiActualCost,
  resolutionForSize,
} from "../pricing/gemini.js";
import type {
  GenerateRequest,
  GenerateResult,
  ImageData,
  Provider,
  ProviderDefinition,
  UsageMetadata,
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

const GEMINI_SUPPORTED_RATIOS = [
  "1:1",
  "2:3",
  "3:2",
  "3:4",
  "4:3",
  "4:5",
  "5:4",
  "9:16",
  "16:9",
  "21:9",
] as const;

/** Reduced form of each supported ratio → the API's canonical label
 *  (21:9 reduces to 7:3, so compare after reduction). */
const RATIO_BY_REDUCED = new Map(
  GEMINI_SUPPORTED_RATIOS.map((label) => {
    const [w, h] = label.split(":").map(Number);
    return [toAspectRatio(w, h), label];
  }),
);

/** Resolve a WxH size to the API's aspect ratio label, if supported. */
function supportedRatioFor(size: {
  width: number;
  height: number;
}): string | undefined {
  return RATIO_BY_REDUCED.get(toAspectRatio(size.width, size.height));
}

function validateSize(
  size: { width: number; height: number },
  apiModel: string,
): void {
  if (!supportedRatioFor(size)) {
    const ratio = toAspectRatio(size.width, size.height);
    throw new ValidationError(
      `Unsupported aspect ratio ${ratio} (${size.width}x${size.height}) for gemini`,
      `Supported ratios: ${GEMINI_SUPPORTED_RATIOS.join(", ")} (e.g. 1024x1024, 1344x768, 768x1344)`,
    );
  }

  // The catalog's per-resolution price keys double as the model's supported
  // resolution classes (e.g. flash-lite is 1K only).
  const resolution = resolutionForSize(size);
  const supported = findModel("gemini", apiModel)?.perImageUSDByResolution;
  if (supported && !(resolution in supported)) {
    throw new ValidationError(
      `Unsupported resolution ${resolution} (${size.width}x${size.height}) for ${apiModel}`,
      `Supported: ${Object.keys(supported).join(", ")} — use a smaller --size or another --tier/--model`,
    );
  }
}

export class GeminiProvider implements Provider {
  readonly name = "gemini";
  readonly models = modelNamesFor("gemini");
  readonly defaultModel = defaultModelFor("gemini");
  readonly maxPromptLength = 32000;
  private readonly ai: GoogleGenAI;

  constructor(apiKey: string) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  async generate(request: GenerateRequest): Promise<GenerateResult> {
    const apiModel = resolveModelId(
      this.name,
      request.model ?? this.defaultModel,
    );
    validateSize(request.size, apiModel);

    // validateSize guarantees a supported ratio, so the assertion is safe.
    const aspectRatio = supportedRatioFor(request.size) as string;
    const imageSize = resolutionForSize(request.size);

    try {
      // Gemini image models return one image per generateContent call, so
      // count > 1 is served by sequential calls (also gentler on rate limits).
      const images: ImageData[] = [];
      let inputTokens = 0;
      let outputTokens = 0;
      let hasUsage = false;

      for (let i = 0; i < request.count; i++) {
        const response = await this.ai.models.generateContent({
          model: apiModel,
          contents: request.prompt,
          config: {
            imageConfig: { aspectRatio, imageSize },
          },
        });

        const parts = response.candidates?.[0]?.content?.parts ?? [];
        for (const part of parts) {
          if (part.inlineData?.data) {
            images.push({
              base64: part.inlineData.data,
              mimeType: part.inlineData.mimeType ?? "image/png",
            });
          }
        }

        const meta = response.usageMetadata;
        if (meta) {
          hasUsage = true;
          inputTokens += meta.promptTokenCount ?? 0;
          outputTokens += meta.candidatesTokenCount ?? 0;
        }
      }

      if (images.length === 0) {
        throw new ProviderError(`${this.name}: API returned 0 images`);
      }

      const usage: UsageMetadata | undefined = hasUsage
        ? { inputTokens, outputTokens }
        : undefined;

      const actualCost = calculateGeminiActualCost(usage, apiModel);

      return { images, ...(usage ? { usage } : {}), actualCost };
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
  name: "gemini",
  models: modelNamesFor("gemini"),
  defaultModel: defaultModelFor("gemini"),
  envKey: "GEMINI_API_KEY",
  maxPromptLength: 32000,
  factory: ({ apiKey }) => new GeminiProvider(apiKey),
} satisfies ProviderDefinition;
