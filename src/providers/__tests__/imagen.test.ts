import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AuthError,
  ProviderError,
  RateLimitError,
  ValidationError,
} from "../../errors/index.js";
import type { GenerateRequest } from "../../types/index.js";
import { ImagenProvider } from "../imagen.js";
import imagenDef from "../imagen.js";

// ---------------------------------------------------------------------------
// Mock @google/genai
// ---------------------------------------------------------------------------

const mockGenerateImages = vi.fn();

vi.mock("@google/genai", () => {
  return {
    GoogleGenAI: class {
      models = { generateImages: mockGenerateImages };
    },
  };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const REQUEST: GenerateRequest = {
  prompt: "a sunset",
  count: 1,
  size: { width: 1024, height: 1024 },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ImagenProvider", () => {
  let provider: ImagenProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new ImagenProvider("gemini-key");
  });

  // --- metadata -----------------------------------------------------------

  it("has correct metadata", () => {
    expect(provider.name).toBe("imagen");
    expect(provider.models).toEqual(["imagen-4"]);
    expect(provider.maxPromptLength).toBe(480);
  });

  // --- ProviderDefinition default export -----------------------------------

  it("default export has correct definition", () => {
    expect(imagenDef.name).toBe("imagen");
    expect(imagenDef.models).toEqual(["imagen-4"]);
    expect(imagenDef.envKey).toBe("GEMINI_API_KEY");
    expect(imagenDef.maxPromptLength).toBe(480);
    expect(typeof imagenDef.factory).toBe("function");
  });

  // --- success -------------------------------------------------------------

  it("returns ImageData with base64 and mimeType on success", async () => {
    mockGenerateImages.mockResolvedValue({
      generatedImages: [{ image: { imageBytes: "c3Vuc2V0" } }],
    });

    const result = await provider.generate(REQUEST);

    expect(result.images).toHaveLength(1);
    expect(result.images[0]).toEqual({
      base64: "c3Vuc2V0",
      mimeType: "image/png",
    });
  });

  it("passes correct parameters to the SDK", async () => {
    mockGenerateImages.mockResolvedValue({
      generatedImages: [{ image: { imageBytes: "c3Vuc2V0" } }],
    });

    await provider.generate(REQUEST);

    expect(mockGenerateImages).toHaveBeenCalledWith({
      model: "imagen-4.0-generate-001",
      prompt: "a sunset",
      config: {
        numberOfImages: 1,
        aspectRatio: "1:1",
      },
    });
  });

  it("computes aspect ratio correctly for non-square sizes", async () => {
    mockGenerateImages.mockResolvedValue({
      generatedImages: [{ image: { imageBytes: "c3Vuc2V0" } }],
    });

    await provider.generate({
      ...REQUEST,
      size: { width: 1024, height: 768 },
    });

    expect(mockGenerateImages).toHaveBeenCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({
          aspectRatio: "4:3",
        }),
      }),
    );
  });

  // --- error: 0 images -----------------------------------------------------

  it("throws ProviderError when API returns 0 images", async () => {
    mockGenerateImages.mockResolvedValue({ generatedImages: [] });

    await expect(provider.generate(REQUEST)).rejects.toThrow(ProviderError);
    await expect(provider.generate(REQUEST)).rejects.toThrow("0 images");
  });

  // --- error: 429 → RateLimitError -----------------------------------------

  it("maps 429 to RateLimitError", async () => {
    mockGenerateImages.mockRejectedValue({
      status: 429,
      message: "rate limited",
    });

    await expect(provider.generate(REQUEST)).rejects.toThrow(RateLimitError);
  });

  // --- error: 401 → AuthError ----------------------------------------------

  it("maps 401 to AuthError", async () => {
    mockGenerateImages.mockRejectedValue({
      status: 401,
      message: "Unauthorized",
    });

    await expect(provider.generate(REQUEST)).rejects.toThrow(AuthError);
  });

  // --- error: 403 → AuthError ----------------------------------------------

  it("maps 403 to AuthError", async () => {
    mockGenerateImages.mockRejectedValue({
      status: 403,
      message: "Forbidden",
    });

    await expect(provider.generate(REQUEST)).rejects.toThrow(AuthError);
  });

  // --- error: 500 → ProviderError ------------------------------------------

  it("maps 500 to ProviderError", async () => {
    mockGenerateImages.mockRejectedValue({
      status: 500,
      message: "Internal Server Error",
    });

    await expect(provider.generate(REQUEST)).rejects.toThrow(ProviderError);
  });

  // --- size validation -----------------------------------------------------

  it("throws ValidationError for unsupported aspect ratio", async () => {
    const badRequest: GenerateRequest = {
      ...REQUEST,
      size: { width: 1536, height: 1024 },
    };

    await expect(provider.generate(badRequest)).rejects.toThrow(
      ValidationError,
    );
    await expect(provider.generate(badRequest)).rejects.toThrow(
      "Unsupported aspect ratio",
    );
  });

  it("accepts all supported aspect ratios", async () => {
    mockGenerateImages.mockResolvedValue({
      generatedImages: [{ image: { imageBytes: "c3Vuc2V0" } }],
    });

    // 1:1
    await provider.generate({ ...REQUEST, size: { width: 1024, height: 1024 } });
    // 3:4
    await provider.generate({ ...REQUEST, size: { width: 768, height: 1024 } });
    // 4:3
    await provider.generate({ ...REQUEST, size: { width: 1024, height: 768 } });
    // 9:16
    await provider.generate({ ...REQUEST, size: { width: 576, height: 1024 } });
    // 16:9
    await provider.generate({ ...REQUEST, size: { width: 1024, height: 576 } });

    expect(mockGenerateImages).toHaveBeenCalledTimes(5);
  });
});
