// ---------------------------------------------------------------------------
// Provider barrel + built-in registration – ImgGenAI
// ---------------------------------------------------------------------------

import type { ProviderDefinition } from "../types/index.js";
import type { ProviderRegistry } from "./registry.js";

import imagenDef from "./imagen.js";
import openaiDef from "./openai.js";
import recraftDef from "./recraft.js";

export { ProviderRegistry } from "./registry.js";
export type { ProviderInfo } from "./registry.js";

/** All built-in provider definitions, in registration order. */
export const BUILTIN_PROVIDER_DEFS: readonly ProviderDefinition[] = [
  openaiDef,
  recraftDef,
  imagenDef,
];

/** Register all built-in providers into the given registry. */
export function registerBuiltinProviders(registry: ProviderRegistry): void {
  for (const def of BUILTIN_PROVIDER_DEFS) {
    registry.register(def);
  }
}
