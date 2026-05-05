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
imggen "blue gradient mountain" -p openai -p recraft -p imagen -c 3

# Specify image size directly
imggen "app icon" -p openai --size 1024x1024

# Use a preset
imggen "app icon" -p openai --preset icon

# Select model tier (premium / standard / economy)
imggen "mountain" -p openai --tier premium

# Specify model directly
imggen "mountain" -p openai --model gpt-image-1.5

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
| `openai` | gpt-image-1 (default), gpt-image-1-mini, gpt-image-1.5 | low, medium, high, auto (default) | N/A | `OPENAI_API_KEY` |
| `recraft` | recraft-v4 (default), recraft-v4-pro, recraft-v3, recraft-v2, recraftv4_vector, recraftv4_pro_vector, recraftv3_vector, recraftv2_vector | — | USD (via API) | `RECRAFT_API_TOKEN` |
| `imagen` | imagen-4-fast, imagen-4 (default), imagen-4-ultra | — | N/A | `GEMINI_API_KEY` |

### Tier Aliases

Use `--tier` to select a model by tier instead of specifying the model id directly.
`--tier` and `--model` are mutually exclusive.

| Tier | openai | recraft | imagen |
|:--|:--|:--|:--|
| `premium` | gpt-image-1.5 | recraftv4_pro | imagen-4.0-ultra-generate-001 |
| `standard` (default) | gpt-image-1 | recraftv4 | imagen-4.0-generate-001 |
| `economy` | gpt-image-1-mini | recraftv2 | imagen-4.0-fast-generate-001 |

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
      "model": "gpt-image-1",
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

## Library API

Use as a library in your own code:

```typescript
import { createPipeline } from 'imggenai';

const pipeline = createPipeline();
const result = await pipeline.execute({
  prompt: 'blue gradient mountain',
  providers: [{ name: 'openai' }],
  options: { count: 3, size: { width: 1024, height: 1024 } },
});

console.log(result.results[0].outputs);
```

## Development

```bash
pnpm install
pnpm build
pnpm test
pnpm lint
```

## License

MIT
