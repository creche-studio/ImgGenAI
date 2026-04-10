// ---------------------------------------------------------------------------
// Error Hierarchy – ImgGenAI
// ---------------------------------------------------------------------------

export class AppError extends Error {
  readonly hint?: string;

  constructor(message: string, hint?: string) {
    super(message);
    this.name = "AppError";
    this.hint = hint;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ConfigError extends AppError {
  constructor(message: string, hint?: string) {
    super(message, hint);
    this.name = "ConfigError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, hint?: string) {
    super(message, hint);
    this.name = "ValidationError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ProviderError extends AppError {
  readonly statusCode?: number;

  constructor(message: string, statusCode?: number, hint?: string) {
    super(message, hint);
    this.name = "ProviderError";
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class RateLimitError extends ProviderError {
  constructor(message: string, hint?: string) {
    super(message, 429, hint);
    this.name = "RateLimitError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class AuthError extends ProviderError {
  constructor(message: string, statusCode = 401, hint?: string) {
    super(message, statusCode, hint);
    this.name = "AuthError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class FileSystemError extends AppError {
  constructor(message: string, hint?: string) {
    super(message, hint);
    this.name = "FileSystemError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
