import { describe, expect, it } from "vitest";
import {
  AppError,
  AuthError,
  ConfigError,
  FileSystemError,
  ProviderError,
  RateLimitError,
  ValidationError,
} from "../index.js";

// ---------------------------------------------------------------------------
// AppError
// ---------------------------------------------------------------------------
describe("AppError", () => {
  it("is an instance of Error", () => {
    const err = new AppError("boom");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AppError);
  });

  it("has name = 'AppError'", () => {
    expect(new AppError("x").name).toBe("AppError");
  });

  it("carries an optional hint", () => {
    expect(new AppError("x").hint).toBeUndefined();
    expect(new AppError("x", "try this").hint).toBe("try this");
  });

  it("stores the message", () => {
    expect(new AppError("hello").message).toBe("hello");
  });
});

// ---------------------------------------------------------------------------
// ConfigError
// ---------------------------------------------------------------------------
describe("ConfigError", () => {
  it("extends AppError and Error", () => {
    const err = new ConfigError("bad config");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AppError);
    expect(err).toBeInstanceOf(ConfigError);
  });

  it("has name = 'ConfigError'", () => {
    expect(new ConfigError("x").name).toBe("ConfigError");
  });

  it("propagates hint", () => {
    const err = new ConfigError("x", "check env");
    expect(err.hint).toBe("check env");
  });
});

// ---------------------------------------------------------------------------
// ValidationError
// ---------------------------------------------------------------------------
describe("ValidationError", () => {
  it("extends AppError and Error", () => {
    const err = new ValidationError("invalid");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AppError);
    expect(err).toBeInstanceOf(ValidationError);
  });

  it("has name = 'ValidationError'", () => {
    expect(new ValidationError("x").name).toBe("ValidationError");
  });

  it("propagates hint", () => {
    const err = new ValidationError("x", "fix input");
    expect(err.hint).toBe("fix input");
  });
});

// ---------------------------------------------------------------------------
// ProviderError
// ---------------------------------------------------------------------------
describe("ProviderError", () => {
  it("extends AppError and Error", () => {
    const err = new ProviderError("fail");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AppError);
    expect(err).toBeInstanceOf(ProviderError);
  });

  it("has name = 'ProviderError'", () => {
    expect(new ProviderError("x").name).toBe("ProviderError");
  });

  it("stores optional statusCode", () => {
    expect(new ProviderError("x").statusCode).toBeUndefined();
    expect(new ProviderError("x", 500).statusCode).toBe(500);
  });

  it("propagates hint", () => {
    const err = new ProviderError("x", 500, "retry later");
    expect(err.hint).toBe("retry later");
  });
});

// ---------------------------------------------------------------------------
// RateLimitError
// ---------------------------------------------------------------------------
describe("RateLimitError", () => {
  it("extends ProviderError, AppError, and Error", () => {
    const err = new RateLimitError("slow down");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AppError);
    expect(err).toBeInstanceOf(ProviderError);
    expect(err).toBeInstanceOf(RateLimitError);
  });

  it("has name = 'RateLimitError'", () => {
    expect(new RateLimitError("x").name).toBe("RateLimitError");
  });

  it("defaults statusCode to 429", () => {
    expect(new RateLimitError("x").statusCode).toBe(429);
  });

  it("propagates hint", () => {
    const err = new RateLimitError("x", "wait 60s");
    expect(err.hint).toBe("wait 60s");
  });
});

// ---------------------------------------------------------------------------
// AuthError
// ---------------------------------------------------------------------------
describe("AuthError", () => {
  it("extends ProviderError, AppError, and Error", () => {
    const err = new AuthError("denied");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AppError);
    expect(err).toBeInstanceOf(ProviderError);
    expect(err).toBeInstanceOf(AuthError);
  });

  it("has name = 'AuthError'", () => {
    expect(new AuthError("x").name).toBe("AuthError");
  });

  it("defaults statusCode to 401", () => {
    expect(new AuthError("x").statusCode).toBe(401);
  });

  it("accepts custom statusCode (e.g. 403)", () => {
    expect(new AuthError("x", 403).statusCode).toBe(403);
  });

  it("propagates hint", () => {
    const err = new AuthError("x", 401, "check API key");
    expect(err.hint).toBe("check API key");
  });
});

// ---------------------------------------------------------------------------
// FileSystemError
// ---------------------------------------------------------------------------
describe("FileSystemError", () => {
  it("extends AppError and Error", () => {
    const err = new FileSystemError("no access");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AppError);
    expect(err).toBeInstanceOf(FileSystemError);
  });

  it("has name = 'FileSystemError'", () => {
    expect(new FileSystemError("x").name).toBe("FileSystemError");
  });

  it("propagates hint", () => {
    const err = new FileSystemError("x", "check permissions");
    expect(err.hint).toBe("check permissions");
  });
});
