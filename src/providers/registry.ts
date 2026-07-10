// ---------------------------------------------------------------------------
// Provider Registry – ImgGenAI
// ---------------------------------------------------------------------------

import { ConfigError, ValidationError } from "../errors/index.js";
import type {
  Provider,
  ProviderDefinition,
  ProviderName,
} from "../types/index.js";

/** Summary info returned by `list()`. */
export interface ProviderInfo {
  readonly name: string;
  readonly models: string[];
  readonly envKey: string;
}

export class ProviderRegistry {
  private readonly defs = new Map<string, ProviderDefinition>();

  /** Register a provider definition. */
  register(def: ProviderDefinition): void {
    this.defs.set(def.name, def);
  }

  /**
   * Resolve a provider by name.
   * Reads the API key from `env` (defaults to `process.env`).
   */
  resolve(
    name: ProviderName,
    env: Record<string, string | undefined> = process.env,
  ): Provider {
    const def = this.defs.get(name);

    if (!def) {
      const available = [...this.defs.keys()].join(", ");
      throw new ValidationError(
        `Unknown provider: "${name}"`,
        `Available providers: ${available}`,
      );
    }

    const apiKey = env[def.envKey];

    if (!apiKey) {
      throw new ConfigError(
        `API key not set for provider "${name}"`,
        `export ${def.envKey}=<your-api-key>`,
      );
    }

    return def.factory({ apiKey });
  }

  /** List all registered providers. */
  list(): ProviderInfo[] {
    return [...this.defs.values()].map(({ name, models, envKey }) => ({
      name,
      models,
      envKey,
    }));
  }

  /** Check whether a provider is registered. */
  has(name: ProviderName): boolean {
    return this.defs.has(name);
  }
}
