import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AuthError,
  ProviderError,
  RateLimitError,
  ValidationError,
} from "../../errors/index.js";
import type { GenerateRequest } from "../../types/index.js";
import { RecraftProvider } from "../recraft.js";
import recraftDef from "../recraft.js";

// ---------------------------------------------------------------------------
// Mock fetch
// ---------------------------------------------------------------------------

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const REQUEST: GenerateRequest = {
  prompt: "a dog",
  count: 2,
  size: { width: 1024, height: 1024 },
};

function okResponse(data: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => data,
  };
}

function errorResponse(status: number, body = "error") {
  return {
    ok: false,
    status,
    text: async () => body,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("RecraftProvider", () => {
  let provider: RecraftProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new RecraftProvider("recraft-key");
  });

  // --- metadata -----------------------------------------------------------

  it("has correct metadata", () => {
    expect(provider.name).toBe("recraft");
    expect(provider.models).toEqual([
      "recraft-v4",
      "recraft-v4-pro",
      "recraft-v3",
      "recraft-v2",
      "recraftv4_vector",
      "recraftv4_pro_vector",
      "recraftv3_vector",
      "recraftv2_vector",
    ]);
    expect(provider.defaultModel).toBe("recraft-v4");
    expect(provider.maxPromptLength).toBe(1000);
  });

  // --- ProviderDefinition default export -----------------------------------

  it("default export has correct definition", () => {
    expect(recraftDef.name).toBe("recraft");
    expect(recraftDef.models).toEqual([
      "recraft-v4",
      "recraft-v4-pro",
      "recraft-v3",
      "recraft-v2",
      "recraftv4_vector",
      "recraftv4_pro_vector",
      "recraftv3_vector",
      "recraftv2_vector",
    ]);
    expect(recraftDef.defaultModel).toBe("recraft-v4");
    expect(recraftDef.envKey).toBe("RECRAFT_API_TOKEN");
    expect(recraftDef.maxPromptLength).toBe(1000);
    expect(typeof recraftDef.factory).toBe("function");
  });

  // --- success -------------------------------------------------------------

  it("returns ImageData with base64 and mimeType on success", async () => {
    mockFetch.mockResolvedValue(
      okResponse({
        data: [{ b64_json: "aW1hZ2Ux" }, { b64_json: "aW1hZ2Uy" }],
      }),
    );

    const result = await provider.generate(REQUEST);

    expect(result.images).toHaveLength(2);
    expect(result.images[0]).toEqual({
      base64: "aW1hZ2Ux",
      mimeType: "image/png",
    });
    expect(result.images[1]).toEqual({
      base64: "aW1hZ2Uy",
      mimeType: "image/png",
    });
  });

  it("passes correct parameters to fetch (default model)", async () => {
    mockFetch.mockResolvedValue(
      okResponse({ data: [{ b64_json: "aW1hZ2Ux" }] }),
    );

    await provider.generate(REQUEST);

    expect(mockFetch).toHaveBeenCalledWith(
      "https://external.api.recraft.ai/v1/images/generations",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer recraft-key",
        },
        body: JSON.stringify({
          model: "recraftv4",
          prompt: "a dog",
          n: 2,
          width: 1024,
          height: 1024,
          response_format: "b64_json",
        }),
      },
    );
  });

  it("maps CLI model name to API model id", async () => {
    mockFetch.mockResolvedValue(
      okResponse({ data: [{ b64_json: "aW1hZ2Ux" }] }),
    );

    await provider.generate({ ...REQUEST, model: "recraft-v4-pro" });

    const callBody = JSON.parse(
      (mockFetch.mock.calls[0][1] as { body: string }).body,
    );
    expect(callBody.model).toBe("recraftv4_pro");
  });

  it("passes vector API model id directly (no map needed)", async () => {
    mockFetch.mockResolvedValue(
      okResponse({ data: [{ b64_json: "aW1hZ2Ux" }] }),
    );

    await provider.generate({ ...REQUEST, model: "recraftv4_vector" });

    const callBody = JSON.parse(
      (mockFetch.mock.calls[0][1] as { body: string }).body,
    );
    expect(callBody.model).toBe("recraftv4_vector");
  });

  // --- error: 0 images -----------------------------------------------------

  it("throws ProviderError when API returns 0 images", async () => {
    mockFetch.mockResolvedValue(okResponse({ data: [] }));

    await expect(provider.generate(REQUEST)).rejects.toThrow(ProviderError);
    await expect(provider.generate(REQUEST)).rejects.toThrow("0 images");
  });

  // --- error: 429 → RateLimitError -----------------------------------------

  it("maps 429 to RateLimitError", async () => {
    mockFetch.mockResolvedValue(errorResponse(429));

    await expect(provider.generate(REQUEST)).rejects.toThrow(RateLimitError);
  });

  // --- error: 401 → AuthError ----------------------------------------------

  it("maps 401 to AuthError", async () => {
    mockFetch.mockResolvedValue(errorResponse(401));

    await expect(provider.generate(REQUEST)).rejects.toThrow(AuthError);
  });

  // --- error: 403 → AuthError ----------------------------------------------

  it("maps 403 to AuthError", async () => {
    mockFetch.mockResolvedValue(errorResponse(403));

    await expect(provider.generate(REQUEST)).rejects.toThrow(AuthError);
  });

  // --- error: 500 → ProviderError ------------------------------------------

  it("maps 500 to ProviderError", async () => {
    mockFetch.mockResolvedValue(errorResponse(500));

    await expect(provider.generate(REQUEST)).rejects.toThrow(ProviderError);
  });

  // --- size validation -----------------------------------------------------

  it("throws ValidationError when size is too small", async () => {
    const badRequest: GenerateRequest = {
      ...REQUEST,
      size: { width: 32, height: 32 },
    };

    await expect(provider.generate(badRequest)).rejects.toThrow(
      ValidationError,
    );
    await expect(provider.generate(badRequest)).rejects.toThrow(
      "Size too small for recraft",
    );
  });

  it("throws ValidationError when size is too large", async () => {
    const badRequest: GenerateRequest = {
      ...REQUEST,
      size: { width: 4096, height: 4096 },
    };

    await expect(provider.generate(badRequest)).rejects.toThrow(
      ValidationError,
    );
    await expect(provider.generate(badRequest)).rejects.toThrow(
      "Size too large for recraft",
    );
  });

  it("accepts valid sizes within range", async () => {
    mockFetch.mockResolvedValue(
      okResponse({ data: [{ b64_json: "aW1hZ2Ux" }] }),
    );

    const result = await provider.generate({
      ...REQUEST,
      size: { width: 64, height: 2048 },
    });
    expect(result.images).toHaveLength(1);
  });

  // --- getBalance ----------------------------------------------------------

  describe("getBalance", () => {
    it("returns BalanceInfo with credits converted to USD", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ credits: 4210 }),
      });

      const balance = await provider.getBalance();

      expect(balance).toEqual({
        provider: "recraft",
        usd: 4.21,
        raw: 4210,
      });
      expect(mockFetch).toHaveBeenCalledWith(
        "https://external.api.recraft.ai/v1/users/me",
        expect.objectContaining({
          headers: { Authorization: "Bearer recraft-key" },
        }),
      );
    });

    it("returns null when API returns non-ok response", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
      });

      const balance = await provider.getBalance();

      expect(balance).toBeNull();
    });

    it("returns null when fetch throws", async () => {
      mockFetch.mockRejectedValue(new Error("network error"));

      const balance = await provider.getBalance();

      expect(balance).toBeNull();
    });
  });
});
