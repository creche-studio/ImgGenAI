// ---------------------------------------------------------------------------
// OutputWriter – ImgGenAI
// ---------------------------------------------------------------------------

import * as fs from "node:fs/promises";
import * as path from "node:path";

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** Abstraction for writing generated images to storage. */
export interface OutputWriter {
  /** Ensure the output directory exists. */
  ensureDir(dir: string): Promise<void>;
  /** Write image data to the given path. Returns the resolved absolute path. */
  write(dir: string, filename: string, data: Buffer): Promise<string>;
}

// ---------------------------------------------------------------------------
// Default implementation: local filesystem
// ---------------------------------------------------------------------------

export class FsOutputWriter implements OutputWriter {
  async ensureDir(dir: string): Promise<void> {
    await fs.mkdir(dir, { recursive: true });
  }

  async write(dir: string, filename: string, data: Buffer): Promise<string> {
    const filePath = path.join(dir, filename);
    await fs.writeFile(filePath, data);
    return filePath;
  }
}
