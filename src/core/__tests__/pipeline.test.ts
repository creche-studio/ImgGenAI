import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ValidationError } from "../../errors/index.js";
import { PresetRegistry } from "../../presets/registry.js";
import { ProviderRegistry } from "../../providers/registry.js";
import type {
  ManifestEntry,
  Provider,
  ProviderDefinition,
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

    const pipeline = new Pipeline(providerRegistry, presetRegistry, mockRecord, writer);
    const result = await pipeline.execute(
      {
        prompt: "a cute cat",
        providers: [{ name: "mock" }],
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

    const pipeline = new Pipeline(providerRegistry, presetRegistry, mockRecord, writer);
    const result = await pipeline.execute(
      {
        prompt: "a dog",
        providers: [{ name: "alpha" }, { name: "beta" }],
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

    const pipeline = new Pipeline(providerRegistry, presetRegistry, mockRecord, writer);
    const result = await pipeline.execute(
      {
        prompt: "test",
        providers: [{ name: "good" }, { name: "bad" }],
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

    const pipeline = new Pipeline(providerRegistry, presetRegistry, mockRecord, writer);

    await expect(
      pipeline.execute({
        prompt: "this is way too long",
        providers: [{ name: "mock" }],
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
        providers: [{ name: "mock" }],
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

    const pipeline = new Pipeline(providerRegistry, presetRegistry, mockRecord, writer);
    const result = await pipeline.execute(
      {
        prompt: "dry test",
        providers: [{ name: "mock" }],
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

    const pipeline = new Pipeline(providerRegistry, presetRegistry, mockRecord, writer);
    const result = await pipeline.execute(
      {
        prompt: "model test",
        providers: [{ name: "mock" }],
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

    const pipeline = new Pipeline(providerRegistry, presetRegistry, mockRecord, writer);

    await expect(
      pipeline.execute({
        prompt: "",
        providers: [{ name: "mock" }],
      }),
    ).rejects.toThrow(ValidationError);
  });

  it("throws ValidationError when no providers given", async () => {
    const providerRegistry = makeProviderRegistry(makeDef());
    const presetRegistry = new PresetRegistry();
    const mockRecord = async () => "manifest.json";
    const writer = new InMemoryOutputWriter();

    const pipeline = new Pipeline(providerRegistry, presetRegistry, mockRecord, writer);

    await expect(
      pipeline.execute({
        prompt: "test",
        providers: [],
      }),
    ).rejects.toThrow(ValidationError);
  });
});
