import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ValidationError } from "../../errors/index.js";
import { PresetRegistry } from "../../presets/registry.js";
import { ProviderRegistry } from "../../providers/registry.js";
import type {
  BalanceInfo,
  ManifestEntry,
  Provider,
  ProviderDefinition,
  ProviderName,
} from "../../types/index.js";
import type { OutputWriter } from "../output-writer.js";
import { Pipeline, formatTimestamp, slugify } from "../pipeline.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDef(overrides?: Partial<ProviderDefinition>): ProviderDefinition {
  const name = overrides?.name ?? "mock";
  const models = overrides?.models ?? ["mock-v1"];
  const maxPromptLength = overrides?.maxPromptLength ?? 1000;

  return {
    name,
    models,
    envKey: "MOCK_API_KEY",
    maxPromptLength,
    factory:
      overrides?.factory ??
      (({ apiKey: _apiKey }) =>
        ({
          name,
          models,
          maxPromptLength,
          generate: async () => ({
            images: [
              {
                base64: Buffer.from("fake-image-data").toString("base64"),
                mimeType: "image/png",
              },
            ],
          }),
        }) as Provider),
    ...overrides,
  };
}

function makeProviderRegistry(...defs: ProviderDefinition[]): ProviderRegistry {
  const registry = new ProviderRegistry();
  for (const def of defs) {
    registry.register(def);
  }
  return registry;
}

/** In-memory OutputWriter for testing – no filesystem access. */
class InMemoryOutputWriter implements OutputWriter {
  readonly written = new Map<string, Buffer>();

  async ensureDir(_dir: string): Promise<void> {
    // no-op
  }

  async write(dir: string, filename: string, data: Buffer): Promise<string> {
    const filePath = `${dir}/${filename}`;
    this.written.set(filePath, data);
    return filePath;
  }
}

/** Cast a test provider name to ProviderName for type compatibility. */
const pn = (name: string) => name as ProviderName;

const TEST_OUTPUT_DIR = "/tmp/pipeline-test-output";

beforeEach(() => {
  // Set mock API keys so ProviderRegistry.resolve() works
  process.env.MOCK_API_KEY = "sk-test";
  process.env.ALPHA_KEY = "sk-test";
  process.env.BETA_KEY = "sk-test";
  process.env.GOOD_KEY = "sk-test";
  process.env.BAD_KEY = "sk-test";
});

afterEach(() => {
  process.env.MOCK_API_KEY = undefined;
  process.env.ALPHA_KEY = undefined;
  process.env.BETA_KEY = undefined;
  process.env.GOOD_KEY = undefined;
  process.env.BAD_KEY = undefined;
});

// ---------------------------------------------------------------------------
// slugify / formatTimestamp
// ---------------------------------------------------------------------------

describe("slugify", () => {
  it("converts text to a lowercase hyphenated slug", () => {
    expect(slugify("Hello World")).toBe("hello-world");
  });

  it("truncates to max 40 characters", () => {
    const long = "a".repeat(60);
    expect(slugify(long).length).toBeLessThanOrEqual(40);
  });

  it("strips leading/trailing hyphens", () => {
    expect(slugify("  --hello-- ")).toBe("hello");
  });
});

describe("formatTimestamp", () => {
  it("formats a date as YYYYMMDDHHmmss", () => {
    const date = new Date(2026, 0, 15, 9, 5, 3); // Jan 15, 2026 09:05:03
    expect(formatTimestamp(date)).toBe("20260115090503");
  });
});

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

describe("Pipeline", () => {
  it("full flow: generate + save image + record manifest", async () => {
    const providerRegistry = makeProviderRegistry(makeDef());
    const presetRegistry = new PresetRegistry();
    const recorded: ManifestEntry[] = [];
    const mockRecord = async (entry: ManifestEntry, _dir: string) => {
      recorded.push(entry);
      return "manifest.json";
    };
    const writer = new InMemoryOutputWriter();

    const pipeline = new Pipeline(
      providerRegistry,
      presetRegistry,
      mockRecord,
      writer,
    );
    const result = await pipeline.execute(
      {
        prompt: "a cute cat",
        providers: [{ name: pn("mock") }],
        outputDir: TEST_OUTPUT_DIR,
      },
      {},
    );

    expect(result.success).toBe(true);
    expect(result.results).toHaveLength(1);
    expect(result.results[0].success).toBe(true);
    expect(result.results[0].outputs).toHaveLength(1);
    expect(result.results[0].model).toBe("mock-v1");

    // Image data was written via OutputWriter
    const imgPath = result.results[0].outputs[0];
    expect(writer.written.has(imgPath)).toBe(true);

    // Manifest was recorded
    expect(recorded).toHaveLength(1);
    expect(recorded[0].provider).toBe("mock");
  });

  it("runs multiple providers in parallel", async () => {
    const defA = makeDef({ name: "alpha", envKey: "ALPHA_KEY" });
    const defB = makeDef({ name: "beta", envKey: "BETA_KEY" });
    const providerRegistry = makeProviderRegistry(defA, defB);
    const presetRegistry = new PresetRegistry();
    const mockRecord = async () => "manifest.json";
    const writer = new InMemoryOutputWriter();

    const pipeline = new Pipeline(
      providerRegistry,
      presetRegistry,
      mockRecord,
      writer,
    );
    const result = await pipeline.execute(
      {
        prompt: "a dog",
        providers: [{ name: pn("alpha") }, { name: pn("beta") }],
        outputDir: TEST_OUTPUT_DIR,
      },
      {},
    );

    expect(result.success).toBe(true);
    expect(result.results).toHaveLength(2);
    expect(result.results.map((r) => r.provider).sort()).toEqual([
      "alpha",
      "beta",
    ]);
  });

  it("handles partial failure (one success, one failure)", async () => {
    const goodDef = makeDef({ name: "good", envKey: "GOOD_KEY" });
    const badDef = makeDef({
      name: "bad",
      envKey: "BAD_KEY",
      factory: () => ({
        name: "bad",
        models: ["bad-v1"],
        maxPromptLength: 1000,
        generate: async () => {
          throw new Error("provider exploded");
        },
      }),
    });

    const providerRegistry = makeProviderRegistry(goodDef, badDef);
    const presetRegistry = new PresetRegistry();
    const mockRecord = async () => "manifest.json";
    const writer = new InMemoryOutputWriter();

    const pipeline = new Pipeline(
      providerRegistry,
      presetRegistry,
      mockRecord,
      writer,
    );
    const result = await pipeline.execute(
      {
        prompt: "test",
        providers: [{ name: pn("good") }, { name: pn("bad") }],
        outputDir: TEST_OUTPUT_DIR,
      },
      {},
    );

    expect(result.success).toBe(false);
    expect(result.results).toHaveLength(2);

    const good = result.results.find((r) => r.provider === "good");
    const bad = result.results.find((r) => r.provider === "bad");

    expect(good?.success).toBe(true);
    expect(bad?.success).toBe(false);
    expect(bad?.error).toContain("provider exploded");
  });

  it("throws ValidationError when prompt exceeds maxPromptLength", async () => {
    const shortDef = makeDef({ maxPromptLength: 5 });
    const providerRegistry = makeProviderRegistry(shortDef);
    const presetRegistry = new PresetRegistry();
    const mockRecord = async () => "manifest.json";
    const writer = new InMemoryOutputWriter();

    const pipeline = new Pipeline(
      providerRegistry,
      presetRegistry,
      mockRecord,
      writer,
    );

    await expect(
      pipeline.execute({
        prompt: "this is way too long",
        providers: [{ name: pn("mock") }],
        outputDir: TEST_OUTPUT_DIR,
      }),
    ).rejects.toThrow(ValidationError);
  });

  it("applies size from preset when specified", async () => {
    const providerRegistry = makeProviderRegistry(makeDef());
    const presetRegistry = new PresetRegistry();
    presetRegistry.register({
      name: "icon",
      size: { width: 512, height: 512 },
    });

    let capturedSize: { width: number; height: number } | undefined;
    const customDef = makeDef({
      factory: () => ({
        name: "mock",
        models: ["mock-v1"],
        maxPromptLength: 1000,
        generate: async (req) => {
          capturedSize = req.size;
          return {
            images: [
              {
                base64: Buffer.from("x").toString("base64"),
                mimeType: "image/png",
              },
            ],
          };
        },
      }),
    });
    const reg2 = makeProviderRegistry(customDef);
    const mockRecord = async () => "manifest.json";
    const writer = new InMemoryOutputWriter();

    const pipeline = new Pipeline(reg2, presetRegistry, mockRecord, writer);
    await pipeline.execute(
      {
        prompt: "icon test",
        providers: [{ name: pn("mock") }],
        preset: "icon",
        outputDir: TEST_OUTPUT_DIR,
      },
      {},
    );

    expect(capturedSize).toEqual({ width: 512, height: 512 });
  });

  it("dry-run does not call provider generate", async () => {
    const generateFn = vi.fn();
    const dryDef = makeDef({
      factory: () => ({
        name: "mock",
        models: ["mock-v1"],
        maxPromptLength: 1000,
        generate: generateFn,
      }),
    });
    const providerRegistry = makeProviderRegistry(dryDef);
    const presetRegistry = new PresetRegistry();
    const mockRecord = async () => "manifest.json";
    const writer = new InMemoryOutputWriter();

    const pipeline = new Pipeline(
      providerRegistry,
      presetRegistry,
      mockRecord,
      writer,
    );
    const result = await pipeline.execute(
      {
        prompt: "dry test",
        providers: [{ name: pn("mock") }],
        outputDir: TEST_OUTPUT_DIR,
      },
      { dryRun: true },
    );

    expect(result.success).toBe(true);
    expect(generateFn).not.toHaveBeenCalled();
  });

  it("ProviderResult contains model field", async () => {
    const providerRegistry = makeProviderRegistry(
      makeDef({ models: ["my-model-v2"] }),
    );
    const presetRegistry = new PresetRegistry();
    const mockRecord = async () => "manifest.json";
    const writer = new InMemoryOutputWriter();

    const pipeline = new Pipeline(
      providerRegistry,
      presetRegistry,
      mockRecord,
      writer,
    );
    const result = await pipeline.execute(
      {
        prompt: "model test",
        providers: [{ name: pn("mock") }],
        outputDir: TEST_OUTPUT_DIR,
      },
      {},
    );

    expect(result.results[0].model).toBe("my-model-v2");
  });

  it("throws ValidationError when prompt is empty", async () => {
    const providerRegistry = makeProviderRegistry(makeDef());
    const presetRegistry = new PresetRegistry();
    const mockRecord = async () => "manifest.json";
    const writer = new InMemoryOutputWriter();

    const pipeline = new Pipeline(
      providerRegistry,
      presetRegistry,
      mockRecord,
      writer,
    );

    await expect(
      pipeline.execute({
        prompt: "",
        providers: [{ name: pn("mock") }],
      }),
    ).rejects.toThrow(ValidationError);
  });

  it("throws ValidationError when no providers given", async () => {
    const providerRegistry = makeProviderRegistry(makeDef());
    const presetRegistry = new PresetRegistry();
    const mockRecord = async () => "manifest.json";
    const writer = new InMemoryOutputWriter();

    const pipeline = new Pipeline(
      providerRegistry,
      presetRegistry,
      mockRecord,
      writer,
    );

    await expect(
      pipeline.execute({
        prompt: "test",
        providers: [],
      }),
    ).rejects.toThrow(ValidationError);
  });
});

// ---------------------------------------------------------------------------
// Pipeline – Cost & Balance Integration
// ---------------------------------------------------------------------------

describe("Pipeline – cost resolution", () => {
  it("uses actualCost from provider when available (costSource=actual)", async () => {
    const def = makeDef({
      factory: () => ({
        name: "mock",
        models: ["mock-v1"],
        maxPromptLength: 1000,
        generate: async () => ({
          images: [
            {
              base64: Buffer.from("x").toString("base64"),
              mimeType: "image/png",
            },
          ],
          actualCost: 0.055,
        }),
      }),
    });
    const providerRegistry = makeProviderRegistry(def);
    const presetRegistry = new PresetRegistry();
    const mockRecord = async () => "manifest.json";
    const writer = new InMemoryOutputWriter();
    const mockPricing = () => 0.042; // static estimate should be ignored

    const pipeline = new Pipeline(
      providerRegistry,
      presetRegistry,
      mockRecord,
      writer,
      mockPricing,
    );
    const result = await pipeline.execute(
      {
        prompt: "cost test",
        providers: [{ name: pn("mock") }],
        outputDir: TEST_OUTPUT_DIR,
      },
      {},
    );

    expect(result.results[0].cost).toBe(0.055);
    expect(result.results[0].costSource).toBe("actual");
  });

  it("falls back to static estimate when actualCost is null (costSource=estimated)", async () => {
    const def = makeDef({
      factory: () => ({
        name: "mock",
        models: ["mock-v1"],
        maxPromptLength: 1000,
        generate: async () => ({
          images: [
            {
              base64: Buffer.from("x").toString("base64"),
              mimeType: "image/png",
            },
          ],
          actualCost: null,
        }),
      }),
    });
    const providerRegistry = makeProviderRegistry(def);
    const presetRegistry = new PresetRegistry();
    const mockRecord = async () => "manifest.json";
    const writer = new InMemoryOutputWriter();
    const mockPricing = () => 0.042;

    const pipeline = new Pipeline(
      providerRegistry,
      presetRegistry,
      mockRecord,
      writer,
      mockPricing,
    );
    const result = await pipeline.execute(
      {
        prompt: "cost test",
        providers: [{ name: pn("mock") }],
        outputDir: TEST_OUTPUT_DIR,
      },
      {},
    );

    expect(result.results[0].cost).toBe(0.042);
    expect(result.results[0].costSource).toBe("estimated");
  });

  it("returns cost=null when both actual and static are unavailable", async () => {
    const def = makeDef({
      factory: () => ({
        name: "mock",
        models: ["mock-v1"],
        maxPromptLength: 1000,
        generate: async () => ({
          images: [
            {
              base64: Buffer.from("x").toString("base64"),
              mimeType: "image/png",
            },
          ],
        }),
      }),
    });
    const providerRegistry = makeProviderRegistry(def);
    const presetRegistry = new PresetRegistry();
    const mockRecord = async () => "manifest.json";
    const writer = new InMemoryOutputWriter();
    const mockPricing = () => null;

    const pipeline = new Pipeline(
      providerRegistry,
      presetRegistry,
      mockRecord,
      writer,
      mockPricing,
    );
    const result = await pipeline.execute(
      {
        prompt: "no cost",
        providers: [{ name: pn("mock") }],
        outputDir: TEST_OUTPUT_DIR,
      },
      {},
    );

    expect(result.results[0].cost).toBeNull();
    expect(result.results[0].costSource).toBeUndefined();
  });

  it("ignores actualCost <= 0 and uses static estimate", async () => {
    const def = makeDef({
      factory: () => ({
        name: "mock",
        models: ["mock-v1"],
        maxPromptLength: 1000,
        generate: async () => ({
          images: [
            {
              base64: Buffer.from("x").toString("base64"),
              mimeType: "image/png",
            },
          ],
          actualCost: 0,
        }),
      }),
    });
    const providerRegistry = makeProviderRegistry(def);
    const presetRegistry = new PresetRegistry();
    const mockRecord = async () => "manifest.json";
    const writer = new InMemoryOutputWriter();
    const mockPricing = () => 0.03;

    const pipeline = new Pipeline(
      providerRegistry,
      presetRegistry,
      mockRecord,
      writer,
      mockPricing,
    );
    const result = await pipeline.execute(
      {
        prompt: "zero cost",
        providers: [{ name: pn("mock") }],
        outputDir: TEST_OUTPUT_DIR,
      },
      {},
    );

    expect(result.results[0].cost).toBe(0.03);
    expect(result.results[0].costSource).toBe("estimated");
  });

  it("computes totalCost as sum of all non-null costs", async () => {
    const defA = makeDef({
      name: "alpha",
      envKey: "ALPHA_KEY",
      factory: () => ({
        name: "alpha",
        models: ["a-v1"],
        maxPromptLength: 1000,
        generate: async () => ({
          images: [
            {
              base64: Buffer.from("x").toString("base64"),
              mimeType: "image/png",
            },
          ],
          actualCost: 0.05,
        }),
      }),
    });
    const defB = makeDef({
      name: "beta",
      envKey: "BETA_KEY",
      factory: () => ({
        name: "beta",
        models: ["b-v1"],
        maxPromptLength: 1000,
        generate: async () => ({
          images: [
            {
              base64: Buffer.from("x").toString("base64"),
              mimeType: "image/png",
            },
          ],
          actualCost: 0.03,
        }),
      }),
    });

    const providerRegistry = makeProviderRegistry(defA, defB);
    const presetRegistry = new PresetRegistry();
    const mockRecord = async () => "manifest.json";
    const writer = new InMemoryOutputWriter();

    const pipeline = new Pipeline(
      providerRegistry,
      presetRegistry,
      mockRecord,
      writer,
    );
    const result = await pipeline.execute(
      {
        prompt: "total cost",
        providers: [{ name: pn("alpha") }, { name: pn("beta") }],
        outputDir: TEST_OUTPUT_DIR,
      },
      {},
    );

    expect(result.totalCost).toBeCloseTo(0.08);
  });

  it("totalCost is null when all provider costs are null", async () => {
    const providerRegistry = makeProviderRegistry(makeDef());
    const presetRegistry = new PresetRegistry();
    const mockRecord = async () => "manifest.json";
    const writer = new InMemoryOutputWriter();
    const mockPricing = () => null;

    const pipeline = new Pipeline(
      providerRegistry,
      presetRegistry,
      mockRecord,
      writer,
      mockPricing,
    );
    const result = await pipeline.execute(
      {
        prompt: "null cost",
        providers: [{ name: pn("mock") }],
        outputDir: TEST_OUTPUT_DIR,
      },
      {},
    );

    expect(result.totalCost).toBeNull();
  });

  it("passes model and quality to provider.generate()", async () => {
    let capturedModel: string | undefined;
    let capturedQuality: string | undefined;

    const def = makeDef({
      factory: () => ({
        name: "mock",
        models: ["mock-v1", "mock-v2"],
        defaultModel: "mock-v1",
        qualities: ["low", "high"],
        defaultQuality: "low",
        maxPromptLength: 1000,
        generate: async (req) => {
          capturedModel = req.model;
          capturedQuality = req.quality;
          return {
            images: [
              {
                base64: Buffer.from("x").toString("base64"),
                mimeType: "image/png",
              },
            ],
          };
        },
      }),
    });
    const providerRegistry = makeProviderRegistry(def);
    const presetRegistry = new PresetRegistry();
    const mockRecord = async () => "manifest.json";
    const writer = new InMemoryOutputWriter();

    const pipeline = new Pipeline(
      providerRegistry,
      presetRegistry,
      mockRecord,
      writer,
    );
    await pipeline.execute(
      {
        prompt: "propagation test",
        providers: [{ name: pn("mock"), model: "mock-v2", quality: "high" }],
        outputDir: TEST_OUTPUT_DIR,
      },
      {},
    );

    expect(capturedModel).toBe("mock-v2");
    expect(capturedQuality).toBe("high");
  });

  it("uses provider defaultModel/defaultQuality when entry does not specify", async () => {
    let capturedModel: string | undefined;
    let capturedQuality: string | undefined;

    const def = makeDef({
      factory: () => ({
        name: "mock",
        models: ["mock-v1", "mock-v2"],
        defaultModel: "mock-v2",
        qualities: ["low", "high"],
        defaultQuality: "high",
        maxPromptLength: 1000,
        generate: async (req) => {
          capturedModel = req.model;
          capturedQuality = req.quality;
          return {
            images: [
              {
                base64: Buffer.from("x").toString("base64"),
                mimeType: "image/png",
              },
            ],
          };
        },
      }),
    });
    const providerRegistry = makeProviderRegistry(def);
    const presetRegistry = new PresetRegistry();
    const mockRecord = async () => "manifest.json";
    const writer = new InMemoryOutputWriter();

    const pipeline = new Pipeline(
      providerRegistry,
      presetRegistry,
      mockRecord,
      writer,
    );
    await pipeline.execute(
      {
        prompt: "default test",
        providers: [{ name: pn("mock") }],
        outputDir: TEST_OUTPUT_DIR,
      },
      {},
    );

    expect(capturedModel).toBe("mock-v2");
    expect(capturedQuality).toBe("high");
  });

  it("manifest entry contains cost and costSource", async () => {
    const recorded: ManifestEntry[] = [];
    const def = makeDef({
      factory: () => ({
        name: "mock",
        models: ["mock-v1"],
        maxPromptLength: 1000,
        generate: async () => ({
          images: [
            {
              base64: Buffer.from("x").toString("base64"),
              mimeType: "image/png",
            },
          ],
          actualCost: 0.123,
        }),
      }),
    });
    const providerRegistry = makeProviderRegistry(def);
    const presetRegistry = new PresetRegistry();
    const mockRecord = async (entry: ManifestEntry, _dir: string) => {
      recorded.push(entry);
      return "manifest.json";
    };
    const writer = new InMemoryOutputWriter();

    const pipeline = new Pipeline(
      providerRegistry,
      presetRegistry,
      mockRecord,
      writer,
    );
    await pipeline.execute(
      {
        prompt: "manifest cost",
        providers: [{ name: pn("mock") }],
        outputDir: TEST_OUTPUT_DIR,
      },
      {},
    );

    expect(recorded[0].cost).toBe(0.123);
    expect(recorded[0].costSource).toBe("actual");
  });

  it("dry-run computes estimated cost without calling generate", async () => {
    const generateFn = vi.fn();
    const def = makeDef({
      factory: () => ({
        name: "mock",
        models: ["mock-v1"],
        defaultModel: "mock-v1",
        maxPromptLength: 1000,
        generate: generateFn,
      }),
    });
    const providerRegistry = makeProviderRegistry(def);
    const presetRegistry = new PresetRegistry();
    const mockRecord = async () => "manifest.json";
    const writer = new InMemoryOutputWriter();
    const mockPricing = () => 0.042;

    const pipeline = new Pipeline(
      providerRegistry,
      presetRegistry,
      mockRecord,
      writer,
      mockPricing,
    );
    const result = await pipeline.execute(
      {
        prompt: "dry cost",
        providers: [{ name: pn("mock") }],
        outputDir: TEST_OUTPUT_DIR,
      },
      { dryRun: true },
    );

    expect(generateFn).not.toHaveBeenCalled();
    expect(result.results[0].cost).toBe(0.042);
    expect(result.results[0].costSource).toBe("estimated");
    expect(result.totalCost).toBe(0.042);
  });
});

// ---------------------------------------------------------------------------
// Pipeline – Balance resolution
// ---------------------------------------------------------------------------

describe("Pipeline – balance resolution", () => {
  it("resolves balances from providers that implement getBalance()", async () => {
    const def = makeDef({
      factory: () => ({
        name: "mock",
        models: ["mock-v1"],
        maxPromptLength: 1000,
        generate: async () => ({
          images: [
            {
              base64: Buffer.from("x").toString("base64"),
              mimeType: "image/png",
            },
          ],
        }),
        getBalance: async (): Promise<BalanceInfo> => ({
          provider: "mock",
          usd: 4.21,
          raw: 4210,
        }),
      }),
    });
    const providerRegistry = makeProviderRegistry(def);
    const presetRegistry = new PresetRegistry();
    const mockRecord = async () => "manifest.json";
    const writer = new InMemoryOutputWriter();

    const pipeline = new Pipeline(
      providerRegistry,
      presetRegistry,
      mockRecord,
      writer,
    );
    const result = await pipeline.execute(
      {
        prompt: "balance test",
        providers: [{ name: pn("mock") }],
        outputDir: TEST_OUTPUT_DIR,
      },
      {},
    );

    expect(result.balances).toHaveLength(1);
    expect(result.balances?.[0]).toEqual({
      provider: "mock",
      usd: 4.21,
      raw: 4210,
    });
  });

  it("returns usd=null for providers without getBalance", async () => {
    const def = makeDef({
      factory: () => ({
        name: "mock",
        models: ["mock-v1"],
        maxPromptLength: 1000,
        generate: async () => ({
          images: [
            {
              base64: Buffer.from("x").toString("base64"),
              mimeType: "image/png",
            },
          ],
        }),
        // No getBalance method
      }),
    });
    const providerRegistry = makeProviderRegistry(def);
    const presetRegistry = new PresetRegistry();
    const mockRecord = async () => "manifest.json";
    const writer = new InMemoryOutputWriter();

    const pipeline = new Pipeline(
      providerRegistry,
      presetRegistry,
      mockRecord,
      writer,
    );
    const result = await pipeline.execute(
      {
        prompt: "no balance",
        providers: [{ name: pn("mock") }],
        outputDir: TEST_OUTPUT_DIR,
      },
      {},
    );

    expect(result.balances).toHaveLength(1);
    expect(result.balances?.[0]).toEqual({ provider: "mock", usd: null });
  });

  it("handles getBalance() throwing an error gracefully", async () => {
    const def = makeDef({
      factory: () => ({
        name: "mock",
        models: ["mock-v1"],
        maxPromptLength: 1000,
        generate: async () => ({
          images: [
            {
              base64: Buffer.from("x").toString("base64"),
              mimeType: "image/png",
            },
          ],
        }),
        getBalance: async (): Promise<BalanceInfo | null> => {
          throw new Error("network timeout");
        },
      }),
    });
    const providerRegistry = makeProviderRegistry(def);
    const presetRegistry = new PresetRegistry();
    const mockRecord = async () => "manifest.json";
    const writer = new InMemoryOutputWriter();

    const pipeline = new Pipeline(
      providerRegistry,
      presetRegistry,
      mockRecord,
      writer,
    );
    const result = await pipeline.execute(
      {
        prompt: "error balance",
        providers: [{ name: pn("mock") }],
        outputDir: TEST_OUTPUT_DIR,
      },
      {},
    );

    expect(result.balances).toHaveLength(1);
    expect(result.balances?.[0].provider).toBe("mock");
    expect(result.balances?.[0].usd).toBeNull();
    expect(result.balances?.[0].error).toBe("network timeout");
  });

  it("deduplicates balances when same provider appears multiple times", async () => {
    let balanceCalls = 0;
    const def = makeDef({
      factory: () => ({
        name: "mock",
        models: ["mock-v1"],
        maxPromptLength: 1000,
        generate: async () => ({
          images: [
            {
              base64: Buffer.from("x").toString("base64"),
              mimeType: "image/png",
            },
          ],
        }),
        getBalance: async (): Promise<BalanceInfo> => {
          balanceCalls++;
          return { provider: "mock", usd: 10.0 };
        },
      }),
    });
    const providerRegistry = makeProviderRegistry(def);
    const presetRegistry = new PresetRegistry();
    const mockRecord = async () => "manifest.json";
    const writer = new InMemoryOutputWriter();

    const pipeline = new Pipeline(
      providerRegistry,
      presetRegistry,
      mockRecord,
      writer,
    );
    const result = await pipeline.execute(
      {
        prompt: "dedup balance",
        providers: [{ name: pn("mock") }, { name: pn("mock") }],
        outputDir: TEST_OUTPUT_DIR,
      },
      {},
    );

    // Should only call getBalance once even though provider appears twice
    expect(balanceCalls).toBe(1);
    expect(result.balances).toHaveLength(1);
  });

  it("handles getBalance() returning null", async () => {
    const def = makeDef({
      factory: () => ({
        name: "mock",
        models: ["mock-v1"],
        maxPromptLength: 1000,
        generate: async () => ({
          images: [
            {
              base64: Buffer.from("x").toString("base64"),
              mimeType: "image/png",
            },
          ],
        }),
        getBalance: async (): Promise<BalanceInfo | null> => null,
      }),
    });
    const providerRegistry = makeProviderRegistry(def);
    const presetRegistry = new PresetRegistry();
    const mockRecord = async () => "manifest.json";
    const writer = new InMemoryOutputWriter();

    const pipeline = new Pipeline(
      providerRegistry,
      presetRegistry,
      mockRecord,
      writer,
    );
    const result = await pipeline.execute(
      {
        prompt: "null balance",
        providers: [{ name: pn("mock") }],
        outputDir: TEST_OUTPUT_DIR,
      },
      {},
    );

    expect(result.balances).toHaveLength(1);
    expect(result.balances?.[0]).toEqual({ provider: "mock", usd: null });
  });

  it("dry-run does not resolve balances", async () => {
    let balanceCalled = false;
    const def = makeDef({
      factory: () => ({
        name: "mock",
        models: ["mock-v1"],
        maxPromptLength: 1000,
        generate: async () => ({
          images: [
            {
              base64: Buffer.from("x").toString("base64"),
              mimeType: "image/png",
            },
          ],
        }),
        getBalance: async (): Promise<BalanceInfo> => {
          balanceCalled = true;
          return { provider: "mock", usd: 5.0 };
        },
      }),
    });
    const providerRegistry = makeProviderRegistry(def);
    const presetRegistry = new PresetRegistry();
    const mockRecord = async () => "manifest.json";
    const writer = new InMemoryOutputWriter();

    const pipeline = new Pipeline(
      providerRegistry,
      presetRegistry,
      mockRecord,
      writer,
    );
    const result = await pipeline.execute(
      {
        prompt: "dry balance",
        providers: [{ name: pn("mock") }],
        outputDir: TEST_OUTPUT_DIR,
      },
      { dryRun: true },
    );

    expect(balanceCalled).toBe(false);
    expect(result.balances).toBeUndefined();
  });
});

describe("Pipeline – model id resolution (catalog)", () => {
  it("resolves a catalog shortName to its apiId for provider, pricing, and result", async () => {
    let modelSeenByProvider: string | undefined;
    const def = makeDef({
      name: "imagen",
      models: ["imagen-4-fast", "imagen-4", "imagen-4-ultra"],
      factory: () => ({
        name: "imagen",
        models: ["imagen-4-fast", "imagen-4", "imagen-4-ultra"],
        maxPromptLength: 480,
        generate: async (req) => {
          modelSeenByProvider = req.model;
          return {
            images: [
              {
                base64: Buffer.from("x").toString("base64"),
                mimeType: "image/png",
              },
            ],
          };
        },
      }),
    });
    const providerRegistry = makeProviderRegistry(def);
    const presetRegistry = new PresetRegistry();
    const mockRecord = async () => "manifest.json";
    const writer = new InMemoryOutputWriter();
    const pricingQueries: string[] = [];
    const mockPricing = (query: { model: string }) => {
      pricingQueries.push(query.model);
      return 0.04;
    };

    const pipeline = new Pipeline(
      providerRegistry,
      presetRegistry,
      mockRecord,
      writer,
      mockPricing,
    );
    const result = await pipeline.execute(
      {
        prompt: "shortname cost regression",
        providers: [{ name: pn("imagen"), model: "imagen-4" }],
        outputDir: TEST_OUTPUT_DIR,
      },
      {},
    );

    // Regression: pricing used to receive the pre-resolution shortName
    // ("imagen-4"), which is not a pricing-table key → cost silently null.
    expect(pricingQueries).toEqual(["imagen-4.0-generate-001"]);
    expect(modelSeenByProvider).toBe("imagen-4.0-generate-001");
    expect(result.results[0].model).toBe("imagen-4.0-generate-001");
    expect(result.results[0].cost).toBe(0.04);
  });

  it("resolves shortName in dry-run cost estimation too", async () => {
    const def = makeDef({
      name: "imagen",
      models: ["imagen-4-fast", "imagen-4", "imagen-4-ultra"],
    });
    const providerRegistry = makeProviderRegistry(def);
    const presetRegistry = new PresetRegistry();
    const mockRecord = async () => "manifest.json";
    const writer = new InMemoryOutputWriter();
    const pricingQueries: string[] = [];
    const mockPricing = (query: { model: string }) => {
      pricingQueries.push(query.model);
      return 0.04;
    };

    const pipeline = new Pipeline(
      providerRegistry,
      presetRegistry,
      mockRecord,
      writer,
      mockPricing,
    );
    const result = await pipeline.execute(
      {
        prompt: "dry-run shortname",
        providers: [{ name: pn("imagen"), model: "imagen-4" }],
        outputDir: TEST_OUTPUT_DIR,
      },
      { dryRun: true },
    );

    expect(pricingQueries).toEqual(["imagen-4.0-generate-001"]);
    expect(result.results[0].model).toBe("imagen-4.0-generate-001");
    expect(result.results[0].cost).toBe(0.04);
  });

  it("passes non-catalog model names through unchanged", async () => {
    const def = makeDef();
    const providerRegistry = makeProviderRegistry(def);
    const presetRegistry = new PresetRegistry();
    const mockRecord = async () => "manifest.json";
    const writer = new InMemoryOutputWriter();

    const pipeline = new Pipeline(
      providerRegistry,
      presetRegistry,
      mockRecord,
      writer,
    );
    const result = await pipeline.execute(
      {
        prompt: "passthrough",
        providers: [{ name: pn("mock"), model: "mock-v1" }],
        outputDir: TEST_OUTPUT_DIR,
      },
      {},
    );

    expect(result.results[0].model).toBe("mock-v1");
  });
});
