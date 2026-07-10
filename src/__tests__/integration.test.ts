// ---------------------------------------------------------------------------
// Integration Tests – ImgGenAI (Phase 7)
// ---------------------------------------------------------------------------

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OutputWriter } from "../core/output-writer.js";
import { Pipeline } from "../core/pipeline.js";
import { PresetRegistry } from "../presets/registry.js";
import { ProviderRegistry } from "../providers/registry.js";
import type {
  GenerateRequest,
  ManifestEntry,
  Provider,
  ProviderDefinition,
  ProviderName,
} from "../types/index.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FAKE_IMAGE_BASE64 = Buffer.from("fake-png-data").toString("base64");

function makeMockDef(
  overrides?: Partial<ProviderDefinition> & {
    generateFn?: (
      req: GenerateRequest,
    ) => Promise<{ images: { base64: string; mimeType: string }[] }>;
  },
): ProviderDefinition {
  const name = overrides?.name ?? "mock";
  const models = overrides?.models ?? ["mock-v1"];
  const maxPromptLength = overrides?.maxPromptLength ?? 10000;
  const envKey = overrides?.envKey ?? "MOCK_API_KEY";
  const generateFn = overrides?.generateFn;

  return {
    name,
    models,
    envKey,
    maxPromptLength,
    factory:
      overrides?.factory ??
      (() => ({
        name,
        models,
        maxPromptLength,
        generate:
          generateFn ??
          (async () => ({
            images: [{ base64: FAKE_IMAGE_BASE64, mimeType: "image/png" }],
          })),
      })),
  };
}

// ---------------------------------------------------------------------------
// In-memory OutputWriter for testing
// ---------------------------------------------------------------------------

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

const TEST_OUTPUT_DIR = "/tmp/integration-test-output";

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe("Integration: full pipeline", () => {
  beforeEach(() => {
    process.env.MOCK_API_KEY = "sk-test";
    process.env.ALPHA_KEY = "sk-alpha";
    process.env.BETA_KEY = "sk-beta";
  });

  afterEach(() => {
    for (const key of ["MOCK_API_KEY", "ALPHA_KEY", "BETA_KEY"]) {
      delete process.env[key];
    }
  });

  // -----------------------------------------------------------------------
  // 1. Normal flow
  // -----------------------------------------------------------------------

  it("generates images, saves files, records manifest, returns correct PipelineResult", async () => {
    const providerRegistry = new ProviderRegistry();
    providerRegistry.register(makeMockDef());

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

    // PipelineResult shape
    expect(result.success).toBe(true);
    expect(result.outputDir).toBe(TEST_OUTPUT_DIR);
    expect(result.results).toHaveLength(1);

    const pr = result.results[0];
    expect(pr.provider).toBe("mock");
    expect(pr.success).toBe(true);
    expect(pr.outputs).toHaveLength(1);
    expect(pr.duration).toBeGreaterThanOrEqual(0);

    // Image data was written via OutputWriter
    expect(writer.written.has(pr.outputs[0])).toBe(true);

    // Manifest was recorded
    expect(recorded).toHaveLength(1);
    expect(recorded[0].provider).toBe("mock");
    expect(recorded[0].prompt).toBe("a cute cat");
  });

  // -----------------------------------------------------------------------
  // 2. Partial failure
  // -----------------------------------------------------------------------

  it("partial failure: one provider succeeds, one fails → success=false with results for both", async () => {
    const goodDef = makeMockDef({ name: "alpha", envKey: "ALPHA_KEY" });
    const badDef = makeMockDef({
      name: "beta",
      envKey: "BETA_KEY",
      factory: () => ({
        name: "beta",
        models: ["beta-v1"],
        maxPromptLength: 10000,
        generate: async () => {
          throw new Error("provider exploded");
        },
      }),
    });

    const providerRegistry = new ProviderRegistry();
    providerRegistry.register(goodDef);
    providerRegistry.register(badDef);

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
        prompt: "partial test",
        providers: [{ name: pn("alpha") }, { name: pn("beta") }],
        outputDir: TEST_OUTPUT_DIR,
      },
      {},
    );

    expect(result.success).toBe(false);
    expect(result.results).toHaveLength(2);

    const good = result.results.find((r) => r.provider === "alpha");
    const bad = result.results.find((r) => r.provider === "beta");

    expect(good?.success).toBe(true);
    expect(good?.outputs.length).toBeGreaterThan(0);

    expect(bad?.success).toBe(false);
    expect(bad?.error).toContain("provider exploded");
    expect(bad?.outputs).toHaveLength(0);
  });

  // -----------------------------------------------------------------------
  // 3. Dry-run
  // -----------------------------------------------------------------------

  it("dry-run: no API calls, success=true", async () => {
    const generateFn = vi.fn();
    const def = makeMockDef({
      factory: () => ({
        name: "mock",
        models: ["mock-v1"],
        maxPromptLength: 10000,
        generate: generateFn,
      }),
    });

    const providerRegistry = new ProviderRegistry();
    providerRegistry.register(def);

    const presetRegistry = new PresetRegistry();
    const mockRecord = vi.fn(async () => "manifest.json");
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
    expect(mockRecord).not.toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // 4. Preset application
  // -----------------------------------------------------------------------

  it("preset icon → generate called with size=1024x1024", async () => {
    let capturedSize: { width: number; height: number } | undefined;

    const def = makeMockDef({
      generateFn: async (req) => {
        capturedSize = req.size;
        return {
          images: [{ base64: FAKE_IMAGE_BASE64, mimeType: "image/png" }],
        };
      },
    });

    const providerRegistry = new ProviderRegistry();
    providerRegistry.register(def);

    const presetRegistry = new PresetRegistry();
    presetRegistry.register({
      name: "icon",
      description: "Square icon generation",
      size: { width: 1024, height: 1024 },
    });

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
        prompt: "icon test",
        providers: [{ name: pn("mock") }],
        preset: "icon",
        outputDir: TEST_OUTPUT_DIR,
      },
      {},
    );

    expect(capturedSize).toEqual({ width: 1024, height: 1024 });
  });

  // -----------------------------------------------------------------------
  // 5. ProviderResult has model field
  // -----------------------------------------------------------------------

  it("ProviderResult contains model field", async () => {
    const def = makeMockDef({ models: ["super-model-v3"] });

    const providerRegistry = new ProviderRegistry();
    providerRegistry.register(def);

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
        prompt: "model field test",
        providers: [{ name: pn("mock") }],
        outputDir: TEST_OUTPUT_DIR,
      },
      {},
    );

    expect(result.results[0]).toHaveProperty("model");
    expect(result.results[0].model).toBe("super-model-v3");
  });

  it("ProviderResult model field uses entry.model when specified", async () => {
    const def = makeMockDef({ models: ["default-model"] });

    const providerRegistry = new ProviderRegistry();
    providerRegistry.register(def);

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
        prompt: "model override test",
        providers: [{ name: pn("mock"), model: "custom-model" }],
        outputDir: TEST_OUTPUT_DIR,
      },
      {},
    );

    expect(result.results[0].model).toBe("custom-model");
  });

  it("dry-run ProviderResult also contains model field", async () => {
    const def = makeMockDef({ models: ["dry-model"] });

    const providerRegistry = new ProviderRegistry();
    providerRegistry.register(def);

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
        prompt: "dry model test",
        providers: [{ name: pn("mock"), model: "specified-model" }],
        outputDir: TEST_OUTPUT_DIR,
      },
      { dryRun: true },
    );

    expect(result.results[0]).toHaveProperty("model");
    expect(result.results[0].model).toBe("specified-model");
  });
});
