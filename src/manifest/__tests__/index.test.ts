import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ManifestEntry } from "../../types/index.js";
import { record } from "../index.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEntry(overrides?: Partial<ManifestEntry>): ManifestEntry {
  return {
    timestamp: "20260101120000",
    provider: "mock",
    prompt: "test prompt",
    params: { count: 1, size: { width: 1024, height: 1024 } },
    outputs: ["out/mock_0.png"],
    duration: 123,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("manifest record()", () => {
  let tmpDirPath: string;

  beforeEach(() => {
    tmpDirPath = fs.mkdtempSync(path.join(os.tmpdir(), "manifest-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDirPath, { recursive: true, force: true });
  });

  it("writes a new manifest.json with a single entry", async () => {
    const entry = makeEntry();
    const filePath = await record(entry, tmpDirPath);

    expect(filePath).toContain("manifest.json");

    const raw = fs.readFileSync(filePath, "utf-8");
    const data = JSON.parse(raw) as ManifestEntry[];
    expect(data).toHaveLength(1);
    expect(data[0].provider).toBe("mock");
  });

  it("appends to existing manifest.json", async () => {
    const entry1 = makeEntry({ provider: "alpha" });
    const entry2 = makeEntry({ provider: "beta" });

    await record(entry1, tmpDirPath);
    await record(entry2, tmpDirPath);

    const filePath = path.join(tmpDirPath, "manifest.json");
    const raw = fs.readFileSync(filePath, "utf-8");
    const data = JSON.parse(raw) as ManifestEntry[];
    expect(data).toHaveLength(2);
    expect(data[0].provider).toBe("alpha");
    expect(data[1].provider).toBe("beta");
  });
});
