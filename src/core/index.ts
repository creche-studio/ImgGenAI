// ---------------------------------------------------------------------------
// Library API – ImgGenAI
// ---------------------------------------------------------------------------

import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { record } from "../manifest/index.js";
import { PresetRegistry } from "../presets/registry.js";
import {
  ProviderRegistry,
  registerBuiltinProviders,
} from "../providers/index.js";
import { Pipeline } from "./pipeline.js";

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a ready-to-use Pipeline with built-in providers, presets, and
 * manifest recorder pre-configured.
 */
export function createPipeline(): Pipeline {
  // 1. Provider registry + built-in providers
  const providerRegistry = new ProviderRegistry();
  registerBuiltinProviders(providerRegistry);

  // 2. Preset registry + built-in presets
  const presetRegistry = new PresetRegistry();
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const builtinPresetsDir = path.resolve(currentDir, "../../presets");
  presetRegistry.loadFromDirectories([builtinPresetsDir]);

  // 3. Pipeline
  return new Pipeline(providerRegistry, presetRegistry, record);
}

// ---------------------------------------------------------------------------
// Re-exports – classes & functions
// ---------------------------------------------------------------------------

export { Pipeline, slugify, formatTimestamp } from "./pipeline.js";
export { resolveConfig } from "./config.js";
export {
  ProviderRegistry,
  registerBuiltinProviders,
} from "../providers/index.js";
export { PresetRegistry } from "../presets/registry.js";
export { record } from "../manifest/index.js";

// ---------------------------------------------------------------------------
// Re-exports – types
// ---------------------------------------------------------------------------

export type { FlagValues, ResolvedConfig } from "./config.js";
export type {
  PipelineInput,
  PipelineResult,
  ProviderResult,
  Provider,
  ProviderDefinition,
  ProviderEntry,
  PresetParams,
  PipelineOptions,
  GenerateRequest,
  GenerateResult,
  ImageData,
  ManifestEntry,
} from "../types/index.js";
export type { ProviderInfo } from "../providers/index.js";
export {
  AppError,
  ConfigError,
  ValidationError,
  ProviderError,
  RateLimitError,
  AuthError,
  FileSystemError,
} from "../errors/index.js";
