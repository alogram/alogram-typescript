// Copyright (c) 2025 Alogram Inc.
// All rights reserved.

export class AlogramError extends Error {
  constructor(
    message: string,
    public status?: number,
    public body?: any
  ) {
    super(message);
    this.name = 'AlogramError';
    Object.setPrototypeOf(this, AlogramError.prototype);
  }
}

export class AuthenticationError extends AlogramError {
  constructor(message: string, status?: number, body?: any) {
    super(message, status, body);
    this.name = 'AuthenticationError';
    Object.setPrototypeOf(this, AuthenticationError.prototype);
  }
}

export class RateLimitError extends AlogramError {
  constructor(message: string, status?: number, body?: any) {
    super(message, status, body);
    this.name = 'RateLimitError';
    Object.setPrototypeOf(this, RateLimitError.prototype);
  }
}

export class ValidationError extends AlogramError {
  constructor(message: string, status?: number, body?: any) {
    super(message, status, body);
    this.name = 'ValidationError';
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

export class InternalServerError extends AlogramError {
  constructor(message: string, status?: number, body?: any) {
    super(message, status, body);
    this.name = 'InternalServerError';
    Object.setPrototypeOf(this, InternalServerError.prototype);
  }
}

/**
 * 🔒 Thrown when an SDK method is called using a key that does not have the required trust scope.
 * (e.g., calling checkRisk with a pk_... key)
 */
export class ScopedAccessError extends AlogramError {
  constructor(message: string) {
    super(message, 403);
    this.name = 'ScopedAccessError';
    Object.setPrototypeOf(this, ScopedAccessError.prototype);
  }
}
