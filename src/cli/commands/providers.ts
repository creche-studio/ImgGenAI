// ---------------------------------------------------------------------------
// providers subcommand – ImgGenAI
// ---------------------------------------------------------------------------

import {
  ProviderRegistry,
  registerBuiltinProviders,
} from "../../providers/index.js";

export interface ProvidersOptions {
  json?: boolean;
}

export function runProviders(opts: ProvidersOptions): void {
  const registry = new ProviderRegistry();
  registerBuiltinProviders(registry);
  const providers = registry.list();

  if (opts.json) {
    process.stdout.write(`${JSON.stringify(providers, null, 2)}\n`);
    return;
  }

  for (const p of providers) {
    const models = p.models.join(", ");
    process.stdout.write(
      `  ${p.name.padEnd(9)} ${models.padEnd(35)} ${p.envKey}\n`,
    );
  }
}
