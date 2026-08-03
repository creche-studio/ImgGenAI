import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AuthError,
  ProviderError,
  RateLimitError,
  ValidationError,
} from "../../errors/index.js";
import type { GenerateRequest } from "../../types/index.js";
import { GeminiProvider } from "../gemini.js";
import geminiDef from "../gemini.js";

// ---------------------------------------------------------------------------
// Mock the @google/genai SDK
// ---------------------------------------------------------------------------

const mockGenerateContent = vi.fn();

vi.mock("@google/genai", () => {
  return {
    GoogleGenAI: class {
      models = { generateContent: mockGenerateContent };
    },
  };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const REQUEST: GenerateRequest = {
  prompt: "a cat",
  count: 1,
  size: { width: 1024, height: 1024 },
};

function imageResponse(
  data = "aGVsbG8=",
  usage?: { promptTokenCount?: number; candidatesTokenCount?: number },
) {
  return {
    candidates: [
      {
        content: {
          parts: [{ inlineData: { data, mimeType: "image/png" } }],
        },
      },
    ],
    ...(usage ? { usageMetadata: usage } : {}),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GeminiProvider", () => {
  let provider: GeminiProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new GeminiProvider("test-key");
  });

  // --- metadata -----------------------------------------------------------

  it("has correct metadata", () => {
    expect(provider.name).toBe("gemini");
    expect(provider.models).toEqual([
      "gemini-flash-lite",
      "gemini-flash",
      "gemini-pro",
    ]);
    expect(provider.defaultModel).toBe("gemini-flash");
    expect(provider.maxPromptLength).toBe(32000);
  });

  it("default export has correct definition", () => {
    expect(geminiDef.name).toBe("gemini");
    expect(geminiDef.models).toEqual([
      "gemini-flash-lite",
      "gemini-flash",
      "gemini-pro",
    ]);
    expect(geminiDef.defaultModel).toBe("gemini-flash");
    expect(geminiDef.envKey).toBe("GEMINI_API_KEY");
    expect(geminiDef.maxPromptLength).toBe(32000);
    expect(typeof geminiDef.factory).toBe("function");
  });

  // --- success -------------------------------------------------------------

  it("returns ImageData from inlineData parts on success", async () => {
    mockGenerateContent.mockResolvedValue(imageResponse());

    const result = await provider.generate(REQUEST);

    expect(result.images).toHaveLength(1);
    expect(result.images[0]).toEqual({
      base64: "aGVsbG8=",
      mimeType: "image/png",
    });
  });

  it("calls generateContent with resolved apiId, aspect ratio, and image size", async () => {
    mockGenerateContent.mockResolvedValue(imageResponse());

    await provider.generate(REQUEST);

    expect(mockGenerateContent).toHaveBeenCalledWith({
      model: "gemini-3.1-flash-image",
      contents: "a cat",
      config: {
        imageConfig: { aspectRatio: "1:1", imageSize: "1K" },
      },
    });
  });

  it("resolves shortName request.model to the API id", async () => {
    mockGenerateContent.mockResolvedValue(imageResponse());

    await provider.generate({ ...REQUEST, model: "gemini-pro" });

    expect(mockGenerateContent).toHaveBeenCalledWith(
      expect.objectContaining({ model: "gemini-3-pro-image" }),
    );
  });

  it("maps larger sizes to 2K/4K image size classes", async () => {
    mockGenerateContent.mockResolvedValue(imageResponse());

    await provider.generate({
      ...REQUEST,
      size: { width: 2048, height: 2048 },
    });

    expect(mockGenerateContent).toHaveBeenCalledWith(
      expect.objectContaining({
        config: { imageConfig: { aspectRatio: "1:1", imageSize: "2K" } },
      }),
    );
  });

  it("generates count images with one call each", async () => {
    mockGenerateContent
      .mockResolvedValueOnce(imageResponse("aW1nMQ=="))
      .mockResolvedValueOnce(imageResponse("aW1nMg=="))
      .mockResolvedValueOnce(imageResponse("aW1nMw=="));

    const result = await provider.generate({ ...REQUEST, count: 3 });

    expect(mockGenerateContent).toHaveBeenCalledTimes(3);
    expect(result.images.map((i) => i.base64)).toEqual([
      "aW1nMQ==",
      "aW1nMg==",
      "aW1nMw==",
    ]);
  });

  // --- usage & actual cost --------------------------------------------------

  it("accumulates usage metadata across calls and computes actualCost", async () => {
    mockGenerateContent
      .mockResolvedValueOnce(
        imageResponse("aW1nMQ==", {
          promptTokenCount: 10,
          candidatesTokenCount: 1120,
        }),
      )
      .mockResolvedValueOnce(
        imageResponse("aW1nMg==", {
          promptTokenCount: 10,
          candidatesTokenCount: 1120,
        }),
      );

    const result = await provider.generate({ ...REQUEST, count: 2 });

    expect(result.usage).toEqual({ inputTokens: 20, outputTokens: 2240 });
    // flash rates: input $0.5/1M, output $60/1M
    // (20 * 0.5 + 2240 * 60) / 1_000_000 = (10 + 134400) / 1M = 0.13441
    expect(result.actualCost).toBeCloseTo(0.13441, 6);
  });

  it("returns null actualCost when usage is absent", async () => {
    mockGenerateContent.mockResolvedValue(imageResponse());

    const result = await provider.generate(REQUEST);

    expect(result.usage).toBeUndefined();
    expect(result.actualCost).toBeNull();
  });

  // --- error: 0 images -------------------------------------------------------

  it("throws ProviderError when the response has no image parts", async () => {
    mockGenerateContent.mockResolvedValue({
      candidates: [{ content: { parts: [{ text: "cannot help" }] } }],
    });

    await expect(provider.generate(REQUEST)).rejects.toThrow(ProviderError);
    await expect(provider.generate(REQUEST)).rejects.toThrow("0 images");
  });

  // --- error mapping ---------------------------------------------------------

  it("maps 429 to RateLimitError", async () => {
    mockGenerateContent.mockRejectedValue({
      status: 429,
      message: "rate limited",
    });

    await expect(provider.generate(REQUEST)).rejects.toThrow(RateLimitError);
  });

  it("maps 401 to AuthError", async () => {
    mockGenerateContent.mockRejectedValue({
      status: 401,
      message: "Unauthorized",
    });

    await expect(provider.generate(REQUEST)).rejects.toThrow(AuthError);
  });

  it("maps 403 to AuthError", async () => {
    mockGenerateContent.mockRejectedValue({
      status: 403,
      message: "Forbidden",
    });

    await expect(provider.generate(REQUEST)).rejects.toThrow(AuthError);
  });

  it("maps 500 to ProviderError", async () => {
    mockGenerateContent.mockRejectedValue({
      status: 500,
      message: "Internal Server Error",
    });

    await expect(provider.generate(REQUEST)).rejects.toThrow(ProviderError);
  });

  // --- size validation --------------------------------------------------------

  it("throws ValidationError for unsupported aspect ratio", async () => {
    const badRequest: GenerateRequest = {
      ...REQUEST,
      size: { width: 1200, height: 630 },
    };

    await expect(provider.generate(badRequest)).rejects.toThrow(
      ValidationError,
    );
    await expect(provider.generate(badRequest)).rejects.toThrow(
      "Unsupported aspect ratio",
    );
  });

  it("throws ValidationError for flash-lite above 1K", async () => {
    const badRequest: GenerateRequest = {
      ...REQUEST,
      model: "gemini-flash-lite",
      size: { width: 2048, height: 2048 },
    };

    await expect(provider.generate(badRequest)).rejects.toThrow(
      ValidationError,
    );
    await expect(provider.generate(badRequest)).rejects.toThrow(
      "Unsupported resolution 2K",
    );
  });

  it("accepts supported ratios beyond the old Imagen set", async () => {
    mockGenerateContent.mockResolvedValue(imageResponse());

    // 3:2 and 21:9 were not supported by the retired Imagen provider
    for (const size of [
      { width: 1536, height: 1024 },
      { width: 2100, height: 900 },
    ]) {
      const result = await provider.generate({ ...REQUEST, size });
      expect(result.images).toHaveLength(1);
    }
  });
});
