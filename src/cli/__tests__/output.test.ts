// ---------------------------------------------------------------------------
// Human output format tests – ImgGenAI
// ---------------------------------------------------------------------------

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PipelineResult, ProviderEntry } from "../../types/index.js";
import { printDryRun, printGeneratingHeader, printResult } from "../output/human.js";

// Capture stderr/stdout writes
let stderrOutput: string;
let stdoutOutput: string;

beforeEach(() => {
  stderrOutput = "";
  stdoutOutput = "";
  vi.spyOn(process.stderr, "write").mockImplementation((chunk: string | Uint8Array) => {
    stderrOutput += String(chunk);
    return true;
  });
  vi.spyOn(process.stdout, "write").mockImplementation((chunk: string | Uint8Array) => {
    stdoutOutput += String(chunk);
    return true;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("printGeneratingHeader", () => {
  it("includes model info", () => {
    const providers: ProviderEntry[] = [
      { name: "openai", model: "gpt-image-1", quality: "low" },
      { name: "recraft", model: "recraftv4" },
    ];
    printGeneratingHeader(providers, 1);
    expect(stderrOutput).toContain("openai (gpt-image-1, low)");
    expect(stderrOutput).toContain("recraft (recraftv4)");
    expect(stderrOutput).toContain("Generating with");
  });

  it("shows count suffix when count > 1", () => {
    const providers: ProviderEntry[] = [
      { name: "openai", model: "gpt-image-1" },
    ];
    printGeneratingHeader(providers, 3);
    expect(stderrOutput).toContain("(3 images each)");
  });

  it("shows plain name when no model/quality", () => {
    const providers: ProviderEntry[] = [{ name: "recraft" }];
    printGeneratingHeader(providers, 1);
    expect(stderrOutput).toContain("Generating with recraft...");
  });
});

describe("printResult", () => {
  it("shows cost per provider", () => {
    const result: PipelineResult = {
      success: true,
      outputDir: "/tmp/test",
      results: [
        {
          provider: "openai",
          model: "gpt-image-1",
          quality: "low",
          success: true,
          outputs: ["/tmp/test/openai_0.png"],
          duration: 1200,
          cost: 0.042,
          costSource: "actual",
        },
      ],
      balances: [{ provider: "openai", usd: null }],
      totalCost: 0.042,
    };
    printResult(result);
    expect(stderrOutput).toContain("$0.042");
    expect(stderrOutput).toContain("openai");
  });

  it("shows Cost: N/A when all costs null", () => {
    const result: PipelineResult = {
      success: true,
      outputDir: "/tmp/test",
      results: [
        {
          provider: "openai",
          model: "gpt-image-1",
          success: true,
          outputs: ["/tmp/test/openai_0.png"],
          duration: 1200,
          cost: null,
        },
      ],
      totalCost: null,
    };
    printResult(result);
    expect(stderrOutput).toContain("Cost: N/A");
  });

  it("shows partial when some costs null", () => {
    const result: PipelineResult = {
      success: true,
      outputDir: "/tmp/test",
      results: [
        {
          provider: "openai",
          model: "gpt-image-1",
          success: true,
          outputs: ["/tmp/test/openai_0.png"],
          duration: 1200,
          cost: 0.042,
          costSource: "actual",
        },
        {
          provider: "recraft",
          model: "recraftv4",
          success: true,
          outputs: ["/tmp/test/recraft_0.png"],
          duration: 800,
          cost: null,
        },
      ],
      totalCost: 0.042,
    };
    printResult(result);
    expect(stderrOutput).toContain("(partial)");
  });

  it("shows balance info", () => {
    const result: PipelineResult = {
      success: true,
      outputDir: "/tmp/test",
      results: [
        {
          provider: "openai",
          model: "gpt-image-1",
          success: true,
          outputs: ["/tmp/test/openai_0.png"],
          duration: 1200,
          cost: 0.042,
          costSource: "actual",
        },
      ],
      balances: [
        { provider: "openai", usd: null },
        { provider: "recraft", usd: 4.21, raw: 4210 },
      ],
      totalCost: 0.042,
    };
    printResult(result);
    expect(stderrOutput).toContain("Balance: openai N/A, recraft $4.21");
  });

  it("outputs file paths to stdout", () => {
    const result: PipelineResult = {
      success: true,
      outputDir: "/tmp/test",
      results: [
        {
          provider: "openai",
          model: "gpt-image-1",
          success: true,
          outputs: ["/tmp/test/openai_0.png"],
          duration: 1200,
          cost: 0.042,
        },
      ],
      totalCost: 0.042,
    };
    printResult(result);
    expect(stdoutOutput).toContain("/tmp/test/openai_0.png");
  });

  it("shows failed provider", () => {
    const result: PipelineResult = {
      success: false,
      outputDir: "/tmp/test",
      results: [
        {
          provider: "openai",
          model: "gpt-image-1",
          success: false,
          outputs: [],
          duration: 0,
          error: "API error",
          cost: null,
        },
      ],
      totalCost: null,
    };
    printResult(result);
    expect(stderrOutput).toContain("✗  failed");
    expect(stderrOutput).toContain("API error");
  });
});

describe("printDryRun", () => {
  it("shows provider model details and estimated cost", () => {
    const providers: ProviderEntry[] = [
      { name: "openai", model: "gpt-image-1.5", quality: "high" },
      { name: "recraft", model: "recraftv4_pro" },
    ];
    const result: PipelineResult = {
      success: true,
      outputDir: "./output",
      results: [
        { provider: "openai", model: "gpt-image-1.5", quality: "high", success: true, outputs: [], duration: 0, cost: 0.13, costSource: "estimated" },
        { provider: "recraft", model: "recraftv4_pro", success: true, outputs: [], duration: 0, cost: 0.25, costSource: "estimated" },
      ],
      totalCost: 0.38,
    };
    printDryRun("mountain", providers, 1, undefined, result);
    expect(stderrOutput).toContain("Dry run");
    expect(stderrOutput).toContain('"mountain"');
    expect(stderrOutput).toContain("openai (gpt-image-1.5, high)");
    expect(stderrOutput).toContain("recraft (recraftv4_pro)");
    expect(stderrOutput).toContain("$0.38");
    expect(stderrOutput).toContain("estimated");
  });

  it("omits cost line when totalCost is null", () => {
    const providers: ProviderEntry[] = [{ name: "openai" }];
    const result: PipelineResult = {
      success: true,
      outputDir: "./output",
      results: [
        { provider: "openai", model: "gpt-image-1", success: true, outputs: [], duration: 0, cost: null },
      ],
      totalCost: null,
    };
    printDryRun("test", providers, 1, undefined, result);
    expect(stderrOutput).not.toContain("Cost:");
  });

  it("shows preset when provided", () => {
    const providers: ProviderEntry[] = [{ name: "openai", model: "gpt-image-1" }];
    const result: PipelineResult = {
      success: true,
      outputDir: "./output",
      results: [],
      totalCost: null,
    };
    printDryRun("test", providers, 1, "icon", result);
    expect(stderrOutput).toContain("Preset:    icon");
  });
});
