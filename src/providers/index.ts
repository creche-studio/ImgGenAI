// ---------------------------------------------------------------------------
// Provider barrel + built-in registration – ImgGenAI
// ---------------------------------------------------------------------------

import type { ProviderRegistry } from "./registry.js";

import imagenDef from "./imagen.js";
import openaiDef from "./openai.js";
import recraftDef from "./recraft.js";

export { ProviderRegistry } from "./registry.js";
export type { ProviderInfo } from "./registry.js";

/** Register all built-in providers into the given registry. */
export function registerBuiltinProviders(registry: ProviderRegistry): void {
  registry.register(openaiDef);
  registry.register(recraftDef);
  registry.register(imagenDef);
}
