// ---------------------------------------------------------------------------
// Tests – Library API (Phase 5)
// ---------------------------------------------------------------------------

import { describe, expect, it } from "vitest";
import {
  Pipeline,
  PresetRegistry,
  ProviderRegistry,
  ValidationError,
  createPipeline,
  formatTimestamp,
  record,
  registerBuiltinProviders,
  resolveConfig,
  slugify,
} from "../index.js";

describe("Library API", () => {
  // -----------------------------------------------------------------------
  // createPipeline
  // -----------------------------------------------------------------------

  it("createPipeline() returns a Pipeline instance", () => {
    const pipeline = createPipeline();
    expect(pipeline).toBeInstanceOf(Pipeline);
  });

  // -----------------------------------------------------------------------
  // Exports
  // -----------------------------------------------------------------------

  it("exports Pipeline class", () => {
    expect(Pipeline).toBeDefined();
  });

  it("exports ProviderRegistry class", () => {
    expect(ProviderRegistry).toBeDefined();
  });

  it("exports PresetRegistry class", () => {
    expect(PresetRegistry).toBeDefined();
  });

  it("exports registerBuiltinProviders function", () => {
    expect(registerBuiltinProviders).toBeTypeOf("function");
  });

  it("exports resolveConfig function", () => {
    expect(resolveConfig).toBeTypeOf("function");
  });

  it("exports record function", () => {
    expect(record).toBeTypeOf("function");
  });

  it("exports slugify and formatTimestamp helpers", () => {
    expect(slugify).toBeTypeOf("function");
    expect(formatTimestamp).toBeTypeOf("function");
  });

  it("exports error classes", () => {
    expect(ValidationError).toBeDefined();
  });

  // -----------------------------------------------------------------------
  // Built-in presets resolved via createPipeline
  // -----------------------------------------------------------------------

  it("resolves built-in preset 'icon'", () => {
    const pipeline = createPipeline();
    // We can verify presets work by doing a dry-run with the preset
    // But first let's test via a direct approach: create our own PresetRegistry
    // and load the same directory the factory uses.
    // Instead, we test end-to-end via Pipeline dry-run.
    const result = pipeline.execute(
      {
        prompt: "test icon",
        providers: [{ name: "openai" }],
        preset: "icon",
      },
      { dryRun: true },
    );
    return expect(result).resolves.toMatchObject({ success: true });
  });

  it("resolves built-in preset 'og-image'", () => {
    const pipeline = createPipeline();
    const result = pipeline.execute(
      {
        prompt: "test og",
        providers: [{ name: "openai" }],
        preset: "og-image",
      },
      { dryRun: true },
    );
    return expect(result).resolves.toMatchObject({ success: true });
  });
});
