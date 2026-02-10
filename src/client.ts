// Copyright (c) 2025 Alogram Inc.
// All rights reserved.

import { v4 as uuidv4 } from 'uuid';
import retry from 'async-retry';
import * as generated from './_generated';
import {
  AlogramError,
  AuthenticationError,
  RateLimitError,
  ValidationError,
  InternalServerError,
  ScopedAccessError
} from './exceptions';

// --- OpenTelemetry Support (Optional) ---
let tracer: any = null;
try {
  const { trace } = require('@opentelemetry/api');
  if (trace) {
    tracer = trace.getTracer('@alogram/payrisk', '0.1.6-rc.4');
  }
} catch (e) {
  // OTel not available, skip telemetry
}

export interface AlogramClientOptions {
  baseUrl?: string;
  apiKey?: string;
  accessToken?: string;
  tenantId?: string;
  clientId?: string;
  debug?: boolean;
}

/**
 * 🔒 Internal base class for shared SDK logic.
 */
abstract class AlogramBaseClient {
  protected config: generated.Configuration;
  protected api: generated.PayriskApi;

  constructor(protected options: AlogramClientOptions) {
    const baseUrl = options.baseUrl || 'https://api.alogram.ai';
    const headers: Record<string, string> = {};
    if (options.apiKey) {
      headers['x-api-key'] = options.apiKey;
    }
    if (options.accessToken) {
      headers['Authorization'] = `Bearer ${options.accessToken}`;
    }
    if (options.tenantId) {
      headers['x-trusted-tenant-id'] = options.tenantId;
    }
    if (options.clientId) {
      headers['x-trusted-client-id'] = options.clientId;
    }

    this.config = new generated.Configuration({
      basePath: baseUrl,
      headers: headers,
    });

    this.api = new generated.PayriskApi(this.config);
  }

  protected generateId(prefix: string): string {
    return `${prefix}_${uuidv4().replace(/-/g, '')}`;
  }

  protected mapError(error: any): Error {
    if (error instanceof generated.ResponseError) {
      const status = error.response.status;
      const message = `API Error: ${error.response.statusText}`;
      
      if (status === 401 || status === 403) {
        return new AuthenticationError(message, status);
      }
      if (status === 429) {
        return new RateLimitError(message, status);
      }
      if (status === 400 || status === 422) {
        return new ValidationError(message, status);
      }
      if (status >= 500) {
        return new InternalServerError(message, status);
      }
      return new AlogramError(message, status);
    }
    // If it's already one of our custom error types, return it directly
    if (
      error instanceof AuthenticationError ||
      error instanceof RateLimitError ||
      error instanceof ValidationError ||
      error instanceof InternalServerError ||
      error instanceof AlogramError
    ) {
      return error;
    }
    return error;
  }

  protected async withTelemetry<T>(
    name: string,
    tags: { tid: string; ik: string },
    fn: () => Promise<T>
  ): Promise<T> {
    if (!tracer) return fn();

    return tracer.startActiveSpan(name, async (span: any) => {
      try {
        span.setAttribute('alogram.trace_id', tags.tid);
        span.setAttribute('alogram.idempotency_key', tags.ik);
        const result = await fn();
        if (typeof result === 'object' && result !== null && 'decision' in result) {
          span.setAttribute('alogram.decision', (result as any).decision);
        }
        span.setStatus({ code: 1 }); // Ok
        return result;
      } catch (err: any) {
        span.setStatus({ code: 2, message: err.message }); // Error
        span.recordException(err);
        throw err;
      } finally {
        span.end();
      }
    });
  }
}

/**
 * 🏢 **AlogramRiskClient** (Secret Client)
 * Designed for server-side environments using a Secret Key (`sk_...`).
 * Provides full access to risk decisioning and score retrieval.
 */
export class AlogramRiskClient extends AlogramBaseClient {
  constructor(options: AlogramClientOptions) {
    if (options.apiKey && options.apiKey.startsWith('pk_')) {
      throw new ScopedAccessError(
        'Cannot initialize AlogramRiskClient with a Publishable Key (pk_...). ' +
        'Please use AlogramPublicClient for client-side ingestion or provide a Secret Key (sk_...).'
      );
    }
    super(options);
  }

  /**
   * 📥 Evaluate risk for a purchase or entity.
   */
  async checkRisk(
    request: generated.CheckRequest,
    overrides?: { idempotencyKey?: string; traceId?: string }
  ): Promise<generated.DecisionResponse> {
    const ik = overrides?.idempotencyKey || this.generateId('idk');
    const tid = overrides?.traceId || this.generateId('trc');

    return this.withTelemetry('alogram.check_risk', { tid, ik }, async () => {
      const headers: Record<string, string> = { ...(this.config.headers || {}) };
      if (request.entities?.tenantId) {
        headers['x-trusted-tenant-id'] = request.entities.tenantId;
      }
      if (request.entities?.clientId) {
        headers['x-trusted-client-id'] = request.entities.clientId;
      }

      try {
        return await retry(
          async (bail) => {
            try {
              // Re-construct headers for every attempt to ensure consistent state
              const attemptHeaders: Record<string, string> = { ...(this.config.headers || {}) };
      if (request.entities?.tenantId) {
        attemptHeaders['x-trusted-tenant-id'] = request.entities.tenantId;
      }
      if (request.entities?.clientId) {
        attemptHeaders['x-trusted-client-id'] = request.entities.clientId;
      }

              return await this.api.riskCheck({
                xIdempotencyKey: ik,
                xTraceId: tid,
                checkRequest: request,
              }, { headers: attemptHeaders });
            } catch (err: any) {
              const mapped = this.mapError(err);
              if (mapped instanceof RateLimitError || mapped instanceof InternalServerError) {
                throw mapped; // retry
              }
              bail(mapped);
              throw mapped; 
            }
          },
          {
            retries: 2,
            minTimeout: 500,
            maxTimeout: 5000,
            randomize: true,
          }
        );
      } catch (e) {
        throw this.mapError(e);
      }
    });
  }

  /**
   * 📡 Ingest behavioral signals.
   */
  async ingestSignals(
    request: generated.SignalsRequest,
    overrides?: { idempotencyKey?: string; traceId?: string }
  ): Promise<void> {
    const ik = overrides?.idempotencyKey || this.generateId('idk');
    const tid = overrides?.traceId || this.generateId('trc');

    return this.withTelemetry('alogram.ingest_signals', { tid, ik }, async () => {
      const headers: Record<string, string> = { ...(this.config.headers || {}) };
      const actualRequest = (request as any).actualInstance || request;
      if (actualRequest.entities?.tenantId) {
        headers['x-trusted-tenant-id'] = actualRequest.entities.tenant_id || actualRequest.entities.tenantId;
      }

      try {
        await this.api.ingestSignals({
          xIdempotencyKey: ik,
          xTraceId: tid,
          signalsRequest: request,
        }, { headers });
      } catch (err) {
        throw this.mapError(err);
      }
    });
  }

  /**
   * 📡 Ingest payment lifecycle events.
   */
  async ingestEvent(
    event: generated.PaymentEvent,
    overrides?: { idempotencyKey?: string; traceId?: string }
  ): Promise<void> {
    const ik = overrides?.idempotencyKey || this.generateId('idk');
    const tid = overrides?.traceId || this.generateId('trc');

    return this.withTelemetry('alogram.ingest_event', { tid, ik }, async () => {
      try {
        await this.api.ingestPaymentEvent({
          xIdempotencyKey: ik,
          xTraceId: tid,
          paymentEvent: event,
        }, { headers: this.config.headers });
      } catch (err) {
        throw this.mapError(err);
      }
    });
  }
}

/**
 * 🌐 **AlogramPublicClient** (Public Client)
 * Designed for client-side environments (Browsers, Mobile) using a Publishable Key (`pk_...`).
 * Strictly restricted to non-sensitive ingestion methods.
 */
export class AlogramPublicClient extends AlogramBaseClient {
  constructor(options: AlogramClientOptions) {
    if (options.apiKey && options.apiKey.startsWith('sk_')) {
      throw new ScopedAccessError(
        'Cannot initialize AlogramPublicClient with a Secret Key (sk_...). ' +
        'Please use AlogramRiskClient for server-side operations.'
      );
    }
    super(options);
  }

  /**
   * 📡 Ingest behavioral signals from the frontend.
   */
  async ingestSignals(
    request: generated.SignalsRequest,
    overrides?: { idempotencyKey?: string; traceId?: string }
  ): Promise<void> {
    const ik = overrides?.idempotencyKey || this.generateId('idk');
    const tid = overrides?.traceId || this.generateId('trc');

    return this.withTelemetry('alogram.ingest_signals', { tid, ik }, async () => {
      try {
        await this.api.ingestSignals({
          xIdempotencyKey: ik,
          xTraceId: tid,
          signalsRequest: request,
        }, { headers: this.config.headers });
      } catch (err) {
        throw this.mapError(err);
      }
    });
  }
}
