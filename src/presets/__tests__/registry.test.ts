import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ValidationError } from "../../errors/index.js";
import { PresetRegistry } from "../registry.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "preset-test-"));
}

function writeYaml(dir: string, filename: string, content: string): void {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, filename), content, "utf-8");
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("PresetRegistry", () => {
  let dirs: string[] = [];

  beforeEach(() => {
    dirs = [];
  });

  afterEach(() => {
    for (const d of dirs) {
      fs.rmSync(d, { recursive: true, force: true });
    }
  });

  // -----------------------------------------------------------------------
  // register + resolve
  // -----------------------------------------------------------------------
  it("register + resolve returns the preset", () => {
    const registry = new PresetRegistry();
    registry.register({
      name: "icon",
      description: "Square icon",
      size: { width: 1024, height: 1024 },
    });

    const preset = registry.resolve("icon");
    expect(preset.name).toBe("icon");
    expect(preset.size).toEqual({ width: 1024, height: 1024 });
  });

  // -----------------------------------------------------------------------
  // Unknown preset → ValidationError
  // -----------------------------------------------------------------------
  it("throws ValidationError for unknown preset", () => {
    const registry = new PresetRegistry();
    registry.register({
      name: "icon",
      size: { width: 1024, height: 1024 },
    });

    expect(() => registry.resolve("nope")).toThrow(ValidationError);

    try {
      registry.resolve("nope");
    } catch (err) {
      const ve = err as ValidationError;
      expect(ve.message).toContain("nope");
      expect(ve.hint).toContain("icon");
    }
  });

  // -----------------------------------------------------------------------
  // list()
  // -----------------------------------------------------------------------
  it("list() returns all registered presets", () => {
    const registry = new PresetRegistry();
    registry.register({ name: "a", size: { width: 100, height: 100 } });
    registry.register({ name: "b", size: { width: 200, height: 200 } });

    const list = registry.list();
    expect(list).toHaveLength(2);
    expect(list.map((p) => p.name)).toEqual(["a", "b"]);
  });

  // -----------------------------------------------------------------------
  // YAML loading
  // -----------------------------------------------------------------------
  it("loads presets from YAML files in a directory", () => {
    const dir = tmpDir();
    dirs.push(dir);

    writeYaml(
      dir,
      "icon.yaml",
      `name: icon\ndescription: "Icon"\nparams:\n  size: { width: 512, height: 512 }\n`,
    );

    const registry = new PresetRegistry();
    registry.loadFromDirectories([dir]);

    const preset = registry.resolve("icon");
    expect(preset.name).toBe("icon");
    expect(preset.size).toEqual({ width: 512, height: 512 });
  });

  // -----------------------------------------------------------------------
  // 3-tier priority (first wins)
  // -----------------------------------------------------------------------
  it("first directory wins when same preset name appears in multiple dirs", () => {
    const projectDir = tmpDir();
    const userDir = tmpDir();
    const builtinDir = tmpDir();
    dirs.push(projectDir, userDir, builtinDir);

    writeYaml(
      projectDir,
      "icon.yaml",
      "name: icon\nparams:\n  size: { width: 111, height: 111 }\n",
    );
    writeYaml(
      userDir,
      "icon.yaml",
      "name: icon\nparams:\n  size: { width: 222, height: 222 }\n",
    );
    writeYaml(
      builtinDir,
      "icon.yaml",
      "name: icon\nparams:\n  size: { width: 333, height: 333 }\n",
    );

    const registry = new PresetRegistry();
    registry.loadFromDirectories([projectDir, userDir, builtinDir]);

    const preset = registry.resolve("icon");
    expect(preset.size).toEqual({ width: 111, height: 111 });
  });

  // -----------------------------------------------------------------------
  // Non-existent directory is skipped
  // -----------------------------------------------------------------------
  it("skips non-existent directories gracefully", () => {
    const registry = new PresetRegistry();
    registry.loadFromDirectories(["/non/existent/path"]);
    expect(registry.list()).toHaveLength(0);
  });
});
