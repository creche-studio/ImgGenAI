// ---------------------------------------------------------------------------
// Preset Registry – ImgGenAI
// ---------------------------------------------------------------------------

import * as fs from "node:fs";
import * as path from "node:path";
import { parse as parseYaml } from "yaml";
import { ValidationError } from "../errors/index.js";
import type { PresetParams } from "../types/index.js";

export class PresetRegistry {
  private readonly presets = new Map<string, PresetParams>();

  /** Register a preset. First registration wins (no overwrite). */
  register(preset: PresetParams): void {
    if (!this.presets.has(preset.name)) {
      this.presets.set(preset.name, preset);
    }
  }

  /** Resolve a preset by name. Throws ValidationError if not found. */
  resolve(name: string): PresetParams {
    const preset = this.presets.get(name);
    if (!preset) {
      const available = [...this.presets.keys()].join(", ");
      throw new ValidationError(
        `Unknown preset: "${name}"`,
        available ? `Available presets: ${available}` : "No presets registered",
      );
    }
    return preset;
  }

  /** List all registered presets. */
  list(): PresetParams[] {
    return [...this.presets.values()];
  }

  /**
   * Load presets from directories in priority order (first wins).
   * Each directory is scanned for .yaml / .yml files.
   */
  loadFromDirectories(dirs: string[]): void {
    for (const dir of dirs) {
      if (!fs.existsSync(dir)) continue;

      const files = fs
        .readdirSync(dir)
        .filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"));

      for (const file of files) {
        const filePath = path.join(dir, file);
        const content = fs.readFileSync(filePath, "utf-8");
        const parsed = parseYaml(content) as {
          name: string;
          description?: string;
          params: { size: { width: number; height: number } };
        };

        this.register({
          name: parsed.name,
          description: parsed.description,
          size: parsed.params.size,
        });
      }
    }
  }
}
