import { describe, expect, it } from "vitest";
import { ConfigError, ValidationError } from "../../errors/index.js";
import type { Provider, ProviderDefinition } from "../../types/index.js";
import { ProviderRegistry } from "../registry.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDef(overrides?: Partial<ProviderDefinition>): ProviderDefinition {
  return {
    name: "mock",
    models: ["mock-v1"],
    envKey: "MOCK_API_KEY",
    maxPromptLength: 1000,
    factory: ({ apiKey }) =>
      ({
        name: "mock",
        models: ["mock-v1"],
        maxPromptLength: 1000,
        generate: async () => ({ images: [] }),
        _apiKey: apiKey, // stash for assertions
      }) as Provider & { _apiKey: string },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ProviderRegistry", () => {
  // -----------------------------------------------------------------------
  // register + resolve
  // -----------------------------------------------------------------------
  it("register + resolve returns a Provider instance", () => {
    const registry = new ProviderRegistry();
    registry.register(makeDef());

    const provider = registry.resolve("mock", { MOCK_API_KEY: "sk-test" });

    expect(provider.name).toBe("mock");
    expect(provider.models).toEqual(["mock-v1"]);
    expect((provider as Provider & { _apiKey: string })._apiKey).toBe(
      "sk-test",
    );
  });

  // -----------------------------------------------------------------------
  // Unknown provider → ValidationError
  // -----------------------------------------------------------------------
  it("throws ValidationError for unknown provider with available list in hint", () => {
    const registry = new ProviderRegistry();
    registry.register(makeDef({ name: "alpha" }));
    registry.register(makeDef({ name: "beta" }));

    expect(() => registry.resolve("nope")).toThrow(ValidationError);

    try {
      registry.resolve("nope");
    } catch (err) {
      const ve = err as ValidationError;
      expect(ve.message).toContain("nope");
      expect(ve.hint).toContain("alpha");
      expect(ve.hint).toContain("beta");
    }
  });

  // -----------------------------------------------------------------------
  // Missing API key → ConfigError
  // -----------------------------------------------------------------------
  it("throws ConfigError when API key is missing with export hint", () => {
    const registry = new ProviderRegistry();
    registry.register(makeDef({ envKey: "MY_SECRET" }));

    expect(() => registry.resolve("mock", {})).toThrow(ConfigError);

    try {
      registry.resolve("mock", {});
    } catch (err) {
      const ce = err as ConfigError;
      expect(ce.hint).toContain("export MY_SECRET=");
    }
  });

  // -----------------------------------------------------------------------
  // list()
  // -----------------------------------------------------------------------
  it("list() returns ProviderInfo for all registered providers", () => {
    const registry = new ProviderRegistry();
    registry.register(makeDef({ name: "a", models: ["a1"], envKey: "A_KEY" }));
    registry.register(makeDef({ name: "b", models: ["b1"], envKey: "B_KEY" }));

    const infos = registry.list();
    expect(infos).toHaveLength(2);
    expect(infos).toEqual(
      expect.arrayContaining([
        { name: "a", models: ["a1"], envKey: "A_KEY" },
        { name: "b", models: ["b1"], envKey: "B_KEY" },
      ]),
    );
  });

  // -----------------------------------------------------------------------
  // has()
  // -----------------------------------------------------------------------
  it("has() returns true for registered and false for unregistered", () => {
    const registry = new ProviderRegistry();
    registry.register(makeDef({ name: "exists" }));

    expect(registry.has("exists")).toBe(true);
    expect(registry.has("nope")).toBe(false);
  });
});
