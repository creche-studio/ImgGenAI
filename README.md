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

# JSON output for scripting
imggen "mountain" -p openai --json | jq '.results[0].outputs'

# Multiple prompts via stdin
cat prompts.txt | imggen -p openai -p recraft

# Dry run (no API calls)
imggen "mountain" -p openai --dry-run

# List available providers
imggen providers
```

## Providers

| Provider | Models | Env Variable |
|:--|:--|:--|
| `openai` | gpt-image-1-mini, gpt-image-1.5 | `OPENAI_API_KEY` |
| `recraft` | recraft-v4 | `RECRAFT_API_TOKEN` |
| `imagen` | imagen-4 | `GEMINI_API_KEY` |

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

`manifest.json` records the prompt, parameters, and timing for each provider.

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
