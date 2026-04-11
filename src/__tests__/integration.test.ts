// ---------------------------------------------------------------------------
// Integration Tests – ImgGenAI (Phase 7)
// ---------------------------------------------------------------------------

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Pipeline } from "../core/pipeline.js";
import { PresetRegistry } from "../presets/registry.js";
import { ProviderRegistry } from "../providers/registry.js";
import type {
  GenerateRequest,
  ManifestEntry,
  Provider,
  ProviderDefinition,
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
// Suite
// ---------------------------------------------------------------------------

describe("Integration: full pipeline", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "integration-test-"));
    process.env.MOCK_API_KEY = "sk-test";
    process.env.ALPHA_KEY = "sk-alpha";
    process.env.BETA_KEY = "sk-beta";
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
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

    const pipeline = new Pipeline(providerRegistry, presetRegistry, mockRecord);

    const result = await pipeline.execute(
      {
        prompt: "a cute cat",
        providers: [{ name: "mock" }],
        outputDir: tmpDir,
      },
      {},
    );

    // PipelineResult shape
    expect(result.success).toBe(true);
    expect(result.outputDir).toBe(tmpDir);
    expect(result.results).toHaveLength(1);

    const pr = result.results[0];
    expect(pr.provider).toBe("mock");
    expect(pr.success).toBe(true);
    expect(pr.outputs).toHaveLength(1);
    expect(pr.duration).toBeGreaterThanOrEqual(0);

    // File was actually written
    expect(fs.existsSync(pr.outputs[0])).toBe(true);

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

    const pipeline = new Pipeline(providerRegistry, presetRegistry, mockRecord);

    const result = await pipeline.execute(
      {
        prompt: "partial test",
        providers: [{ name: "alpha" }, { name: "beta" }],
        outputDir: tmpDir,
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

    const pipeline = new Pipeline(providerRegistry, presetRegistry, mockRecord);

    const result = await pipeline.execute(
      {
        prompt: "dry test",
        providers: [{ name: "mock" }],
        outputDir: tmpDir,
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
    const pipeline = new Pipeline(providerRegistry, presetRegistry, mockRecord);

    await pipeline.execute(
      {
        prompt: "icon test",
        providers: [{ name: "mock" }],
        preset: "icon",
        outputDir: tmpDir,
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

    const pipeline = new Pipeline(providerRegistry, presetRegistry, mockRecord);

    const result = await pipeline.execute(
      {
        prompt: "model field test",
        providers: [{ name: "mock" }],
        outputDir: tmpDir,
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

    const pipeline = new Pipeline(providerRegistry, presetRegistry, mockRecord);

    const result = await pipeline.execute(
      {
        prompt: "model override test",
        providers: [{ name: "mock", model: "custom-model" }],
        outputDir: tmpDir,
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

    const pipeline = new Pipeline(providerRegistry, presetRegistry, mockRecord);

    const result = await pipeline.execute(
      {
        prompt: "dry model test",
        providers: [{ name: "mock", model: "specified-model" }],
        outputDir: tmpDir,
      },
      { dryRun: true },
    );

    expect(result.results[0]).toHaveProperty("model");
    expect(result.results[0].model).toBe("specified-model");
  });
});
