import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AuthError,
  ProviderError,
  RateLimitError,
} from "../../errors/index.js";
import type { GenerateRequest } from "../../types/index.js";
import { OpenAIProvider } from "../openai.js";
import openaiDef from "../openai.js";

// ---------------------------------------------------------------------------
// Mock the OpenAI SDK
// ---------------------------------------------------------------------------

const mockGenerate = vi.fn();

vi.mock("openai", () => {
  return {
    default: class {
      images = { generate: mockGenerate };
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("OpenAIProvider", () => {
  let provider: OpenAIProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new OpenAIProvider("sk-test");
  });

  // --- metadata -----------------------------------------------------------

  it("has correct metadata", () => {
    expect(provider.name).toBe("openai");
    expect(provider.models).toEqual(["gpt-image-1-mini", "gpt-image-1.5"]);
    expect(provider.maxPromptLength).toBe(32000);
  });

  // --- ProviderDefinition default export -----------------------------------

  it("default export has correct definition", () => {
    expect(openaiDef.name).toBe("openai");
    expect(openaiDef.models).toEqual(["gpt-image-1-mini", "gpt-image-1.5"]);
    expect(openaiDef.envKey).toBe("OPENAI_API_KEY");
    expect(openaiDef.maxPromptLength).toBe(32000);
    expect(typeof openaiDef.factory).toBe("function");
  });

  // --- success -------------------------------------------------------------

  it("returns ImageData with base64 and mimeType on success", async () => {
    mockGenerate.mockResolvedValue({
      data: [{ b64_json: "aGVsbG8=" }],
    });

    const result = await provider.generate(REQUEST);

    expect(result.images).toHaveLength(1);
    expect(result.images[0]).toEqual({
      base64: "aGVsbG8=",
      mimeType: "image/png",
    });
  });

  it("returns usage metadata when API response includes usage", async () => {
    mockGenerate.mockResolvedValue({
      data: [{ b64_json: "aGVsbG8=" }],
      usage: { input_tokens: 100, output_tokens: 4096 },
    });

    const result = await provider.generate(REQUEST);

    expect(result.usage).toEqual({
      inputTokens: 100,
      outputTokens: 4096,
    });
  });

  it("omits usage when API response has no usage field", async () => {
    mockGenerate.mockResolvedValue({
      data: [{ b64_json: "aGVsbG8=" }],
    });

    const result = await provider.generate(REQUEST);

    expect(result.usage).toBeUndefined();
  });

  it("passes correct parameters to the SDK", async () => {
    mockGenerate.mockResolvedValue({
      data: [{ b64_json: "aGVsbG8=" }],
    });

    await provider.generate(REQUEST);

    expect(mockGenerate).toHaveBeenCalledWith({
      model: "gpt-image-1",
      prompt: "a cat",
      n: 1,
      size: "1024x1024",
      output_format: "png",
      quality: "low",
    });
  });

  // --- error: 0 images -----------------------------------------------------

  it("throws ProviderError when API returns 0 images", async () => {
    mockGenerate.mockResolvedValue({ data: [] });

    await expect(provider.generate(REQUEST)).rejects.toThrow(ProviderError);
    await expect(provider.generate(REQUEST)).rejects.toThrow("0 images");
  });

  // --- error: 429 → RateLimitError -----------------------------------------

  it("maps 429 to RateLimitError", async () => {
    mockGenerate.mockRejectedValue({ status: 429, message: "rate limited" });

    await expect(provider.generate(REQUEST)).rejects.toThrow(RateLimitError);
  });

  // --- error: 401 → AuthError ----------------------------------------------

  it("maps 401 to AuthError", async () => {
    mockGenerate.mockRejectedValue({
      status: 401,
      message: "Unauthorized",
    });

    await expect(provider.generate(REQUEST)).rejects.toThrow(AuthError);
  });

  // --- error: 403 → AuthError ----------------------------------------------

  it("maps 403 to AuthError", async () => {
    mockGenerate.mockRejectedValue({
      status: 403,
      message: "Forbidden",
    });

    await expect(provider.generate(REQUEST)).rejects.toThrow(AuthError);
  });

  // --- error: 500 → ProviderError ------------------------------------------

  it("maps 500 to ProviderError", async () => {
    mockGenerate.mockRejectedValue({
      status: 500,
      message: "Internal Server Error",
    });

    await expect(provider.generate(REQUEST)).rejects.toThrow(ProviderError);
  });
});
