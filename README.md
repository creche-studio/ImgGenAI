<p align="center">
  <img src="logo.png" width="200" alt="ImgGenAI">
</p>

# ImgGenAI

Unified CLI for multi-provider AI image generation.

Generate images from multiple AI providers in parallel, compare results, and pick the best — all in one command.

## Setup

```bash
npm install -g imggenai
```

Set API keys for the providers you want to use:

```bash
export OPENAI_API_KEY=sk-...
export RECRAFT_API_TOKEN=...
export GEMINI_API_KEY=...
```

Only the keys for providers you actually use are required.

## Usage

```bash
# Generate with one provider
imggen "blue gradient mountain silhouette" -p openai

# Compare across providers (parallel execution)
imggen "blue gradient mountain" -p openai -p recraft -p gemini -c 3

# Specify image size directly
imggen "app icon" -p openai --size 1024x1024

# Use a preset
imggen "app icon" -p openai --preset icon

# Select model tier (premium / standard / economy)
imggen "mountain" -p gemini --tier premium

# Specify model directly
imggen "mountain" -p gemini --model gemini-pro

# Set quality level (openai only)
imggen "mountain" -p openai --quality high

# Recraft vector output
imggen "logo" -p recraft --vector

# JSON output for scripting
imggen "mountain" -p openai --json | jq '.results[0].outputs'

# Multiple prompts via stdin
cat prompts.txt | imggen -p openai -p recraft

# Dry run (no API calls, shows estimated cost)
imggen "mountain" -p openai --dry-run

# List available providers
imggen providers
```

## Providers

| Provider | Models | Quality | Balance | Env Variable |
|:--|:--|:--|:--|:--|
| `openai` | gpt-image-2 (default) | low, medium, high, auto (default) | N/A | `OPENAI_API_KEY` |
| `recraft` | recraft-v4 (default), recraft-v4-pro, recraft-v3, recraft-v2, recraftv4_vector, recraftv4_pro_vector, recraftv3_vector, recraftv2_vector | — | USD (via API) | `RECRAFT_API_TOKEN` |
| `gemini` | gemini-flash-lite, gemini-flash (default), gemini-pro | — | N/A | `GEMINI_API_KEY` |

Notes:

- `openai` sizes: gpt-image-2 accepts arbitrary resolutions — both edges multiples of 16, longest edge ≤ 3840, edge ratio ≤ 3:1, total pixels 655,360–8,294,400.
- `gemini` sizes: aspect ratio must be one of 1:1, 2:3, 3:2, 3:4, 4:3, 4:5, 5:4, 9:16, 16:9, 21:9. The longest edge picks the resolution class (≤1024 → 1K, ≤2048 → 2K, else 4K), which drives billing. `gemini-flash-lite` supports 1K only.

### Tier Aliases

Use `--tier` to select a model by tier instead of specifying the model id directly.
`--tier` and `--model` are mutually exclusive.

| Tier | openai | recraft | gemini |
|:--|:--|:--|:--|
| `premium` | — (falls back to gpt-image-2) | recraftv4_pro | gemini-3-pro-image |
| `standard` (default) | gpt-image-2 | recraftv4 | gemini-3.1-flash-image |
| `economy` | — (falls back to gpt-image-2) | recraftv2 | gemini-3.1-flash-lite-image |

openai has a single-model lineup, so its price/quality ladder is the `--quality` flag rather than the tier.

When `--vector` is specified, Recraft resolves to vector models instead:

| Tier | recraft (vector) |
|:--|:--|
| `premium` | recraftv4_pro_vector |
| `standard` | recraftv4_vector |
| `economy` | recraftv2_vector |

## Presets

Built-in size presets:

| Preset | Size | Use case |
|:--|:--|:--|
| `icon` | 1024x1024 | App icons |
| `og-image` | 1200x630 | Social sharing images |

`--preset` and `--size` are mutually exclusive.

## Flags

| Flag | Short | Description |
|:--|:--|:--|
| `--provider <name>` | `-p` | Provider (repeatable) |
| `--count <n>` | `-c` | Images per provider (default: 1) |
| `--preset <name>` | | Preset name |
| `--size <WxH>` | `-s` | Image size (e.g. 1024x1024) |
| `--output <dir>` | `-o` | Output directory |
| `--tier <tier>` | | Tier alias: premium, standard, economy (default: standard) |
| `--model <id>` | | Provider-internal model id (mutually exclusive with --tier) |
| `--quality <q>` | | Quality level (openai: low/medium/high/auto) |
| `--vector` | | Recraft vector tier alias (no-op on other providers) |
| `--json` | | JSON output |
| `--quiet` | `-q` | Suppress non-essential output |
| `--no-color` | | Disable colors |
| `--debug` | `-d` | Show debug information |
| `--dry-run` | `-n` | Show what would be done |

## Output

Each run creates a timestamped directory:

```
output/
└── blue-gradient-mountain_20260411/
    ├── openai_0.png
    ├── openai_1.png
    ├── recraft_0.png
    └── manifest.json
```

`manifest.json` records the prompt, parameters, timing, cost, and cost source for each provider.

### Cost and Balance

After generation, the CLI displays per-provider cost and a summary line:

```
  openai   ✓  1 image  1.2s  $0.042
  recraft  ✓  1 image  0.8s  $0.040

Total: 2 images, 1.2s
Cost: $0.082 | Balance: openai N/A, recraft $4.21
```

- **Cost** is derived from API response (actual) when available, falling back to static pricing tables (estimated).
- **Balance** shows remaining credit for providers that support it (currently Recraft only). Providers without balance API show `N/A`.
- In dry-run mode, cost is estimated from static pricing tables. Balance is not fetched.
- `costSource` in JSON/manifest output indicates `"actual"` or `"estimated"`.

### JSON Output

With `--json`, the full result is written to stdout:

```json
{
  "success": true,
  "outputDir": "...",
  "results": [
    {
      "provider": "openai",
      "model": "gpt-image-2",
      "quality": "low",
      "success": true,
      "outputs": ["..."],
      "duration": 1200,
      "cost": 0.042,
      "costSource": "actual"
    }
  ],
  "totalCost": 0.082,
  "balances": [
    { "provider": "openai", "usd": null },
    { "provider": "recraft", "usd": 4.21, "raw": 4210 }
  ]
}
```

## Environment Variables

Configuration follows the hierarchy: CLI flag > environment variable > default.

| Variable | Description | Default |
|:--|:--|:--|
| `OPENAI_API_KEY` | OpenAI API key | — |
| `RECRAFT_API_TOKEN` | Recraft API key | — |
| `GEMINI_API_KEY` | Google Gemini API key | — |
| `IMGGEN_PROVIDER` | Default provider(s), comma-separated | `openai` |
| `IMGGEN_COUNT` | Default image count (1-10) | `1` |
| `IMGGEN_OUTPUT_DIR` | Default output directory | `./output` |
| `IMGGEN_TIER` | Default tier alias | `standard` |
| `IMGGEN_QUALITY` | Default quality level (openai) | `auto` |

## Library API

Use as a library in your own code:

```typescript
import { createPipeline } from 'imggenai';

const pipeline = createPipeline();
const result = await pipeline.execute({
  prompt: 'blue gradient mountain',
  providers: [{ name: 'openai', model: 'gpt-image-2', quality: 'high' }],
  options: { count: 3, size: { width: 1024, height: 1024 } },
});

console.log(result.results[0].outputs);   // file paths
console.log(result.totalCost);            // USD or null
console.log(result.balances);             // per-provider balance
```

## Architecture

```
src/
├── catalog/          # Model catalog — single source of truth for model ids, tiers, pricing
├── cli/              # CLI layer (commander, flags, output formatting)
│   ├── commands/     # Subcommands (generate, providers)
│   ├── output/       # Human/JSON output formatters
│   └── aliases.ts    # Tier alias resolution (derived from the catalog)
├── core/             # Core layer (pipeline orchestration, config)
│   ├── pipeline.ts   # Generate → cost → balance → manifest flow
│   ├── config.ts     # Flag/env/default resolution
│   └── output-writer.ts  # I/O interface (DI for testability)
├── pricing/          # Cost calculation (static tables + dynamic token-based)
├── providers/        # Provider implementations (OpenAI, Recraft, Gemini)
├── presets/          # Size presets (icon, og-image)
├── manifest/         # Generation history recorder
├── errors/           # Typed errors with actionable hints
└── types/            # Shared type definitions
```

Key design decisions:

- **Model catalog**: every model's identifiers, tier, and pricing live in one table (`src/catalog`) — a model generation change only touches that file
- **Type-safe providers**: `ProviderName` literal union — invalid provider names are caught at compile time
- **I/O separation**: `OutputWriter` interface injected into Pipeline — testable without filesystem
- **Config hierarchy**: flag > env > default — consistent with 12 Factor CLI
- **Hybrid pricing**: API response cost (actual) preferred, static table fallback (estimated)
- **Dual output**: TTY gets human-readable stderr; pipes/`--json` get structured JSON on stdout

## Development

```bash
pnpm install
pnpm build
pnpm test
pnpm lint
```

## License

MIT
