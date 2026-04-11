// ---------------------------------------------------------------------------
// history subcommand – ImgGenAI
// ---------------------------------------------------------------------------

import * as fs from "node:fs";
import * as path from "node:path";
import type { ManifestEntry } from "../../types/index.js";

export interface HistoryOptions {
  json?: boolean;
  output?: string;
}

interface HistoryEntry {
  dir: string;
  entries: ManifestEntry[];
}

function findManifests(baseDir: string): HistoryEntry[] {
  const results: HistoryEntry[] = [];
  const resolved = path.resolve(baseDir);

  if (!fs.existsSync(resolved)) {
    return results;
  }

  let dirents: fs.Dirent[];
  try {
    dirents = fs.readdirSync(resolved, { withFileTypes: true });
  } catch {
    return results;
  }

  for (const d of dirents) {
    if (!d.isDirectory()) continue;
    const manifestPath = path.join(resolved, d.name, "manifest.json");
    try {
      const raw = fs.readFileSync(manifestPath, "utf-8");
      const entries = JSON.parse(raw) as ManifestEntry[];
      results.push({ dir: d.name, entries });
    } catch {
      // no manifest or invalid – skip
    }
  }

  return results;
}

export function runHistory(opts: HistoryOptions): void {
  const baseDir = opts.output ?? "./output";
  const history = findManifests(baseDir);

  if (opts.json) {
    process.stdout.write(`${JSON.stringify(history, null, 2)}\n`);
    return;
  }

  if (history.length === 0) {
    process.stderr.write("No generation history found.\n");
    return;
  }

  for (const h of history) {
    process.stdout.write(`${h.dir}/\n`);
    for (const e of h.entries) {
      const outputs = e.outputs.map((o) => o.split("/").pop() ?? o).join(", ");
      process.stdout.write(
        `  ${e.provider.padEnd(9)} ${e.timestamp}  ${outputs}\n`,
      );
    }
  }
}
