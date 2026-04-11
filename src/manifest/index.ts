// ---------------------------------------------------------------------------
// Manifest Recorder – ImgGenAI
// ---------------------------------------------------------------------------

import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { ManifestEntry } from "../types/index.js";

const MANIFEST_FILE = "manifest.json";

/**
 * Record a manifest entry to `manifest.json` in the given output directory.
 * Appends to an existing file or creates a new one.
 *
 * @returns The absolute path to the manifest file.
 */
export async function record(
  entry: ManifestEntry,
  outputDir: string,
): Promise<string> {
  const filePath = path.resolve(outputDir, MANIFEST_FILE);

  let entries: ManifestEntry[] = [];

  try {
    const raw = await fs.readFile(filePath, "utf-8");
    entries = JSON.parse(raw) as ManifestEntry[];
  } catch {
    // File doesn't exist or is invalid – start fresh
  }

  entries.push(entry);

  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(entries, null, 2), "utf-8");

  return filePath;
}
