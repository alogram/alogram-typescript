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
    tracer = trace.getTracer('@alogram/payrisk', '0.2.10');
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
  
  // Multi-Expert APIs (Tag-based organization in 0.2.5+)
  public riskScoring: generated.RiskScoringApi;
  public signals: generated.SignalIntelligenceApi;
  public forensics: generated.ForensicDataApi;
  public system: generated.SystemApi;

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

    this.riskScoring = new generated.RiskScoringApi(this.config);
    this.signals = new generated.SignalIntelligenceApi(this.config);
    this.forensics = new generated.ForensicDataApi(this.config);
    this.system = new generated.SystemApi(this.config);
  }

  /**
   * 🚀 Intelligent Handshake: Wait for the infrastructure to wake up.
   * This sends lightweight health checks with exponential backoff to warm up
   * Cloud Run instances and Load Balancer proxies before actual testing.
   */
  public async waitForReady(timeoutSecs: number = 60): Promise<boolean> {
    const startTime = Date.now();
    let attempt = 1;
    
    console.info(`⏳ Performing TypeScript infrastructure handshake (timeout: ${timeoutSecs}s)...`);
    
    while ((Date.now() - startTime) < (timeoutSecs * 1000)) {
      try {
        // Lightweight GET /v1/health
        await this.system.healthCheck();
        console.info('✅ Infrastructure is READY.');
        return true;
      } catch (err: any) {
        const waitTime = Math.min(Math.pow(2, attempt), 10);
        console.warn(`⚠️ Handshake attempt ${attempt} failed: ${err.message}. Retrying in ${waitTime}s...`);
        await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
        attempt++;
      }
    }

    console.error('❌ Infrastructure handshake TIMEOUT.');
    return false;
  }

  protected generateId(prefix: string): string {
    const hex = uuidv4().replace(/-/g, '');
    return `${prefix}_${hex}`;
  }

  protected mapError(error: any): Error {
    if (error instanceof generated.ResponseError) {
      const status = error.response.status;
      const statusText = error.response.statusText || 'Unknown Status';
      const message = `API Error: ${status} ${statusText}`;
      
      if (status === 401 || status === 403) {
        return new AuthenticationError(message, status);
      }
      if (status === 409) {
        return new AlogramError(message, status);
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
    return this.withTelemetry('alogram.check_risk', { tid: 'pending', ik: 'pending' }, async () => {
      try {
        return await retry(
          async (bail) => {
            const ik = overrides?.idempotencyKey || this.generateId('idk');
            const tid = overrides?.traceId || this.generateId('trc');

            try {
              // Re-construct headers for every attempt to ensure consistent state
              const attemptHeaders: Record<string, string> = { 
                ...(this.config.headers || {}),
                'x-idempotency-key': ik,
                'x-trace-id': tid
              };
              if (request.entities?.tenantId) {
                attemptHeaders['x-trusted-tenant-id'] = request.entities.tenantId;
              }
              if (request.entities?.clientId) {
                attemptHeaders['x-trusted-client-id'] = request.entities.clientId;
              }

              return await this.riskScoring.riskCheck({
                xIdempotencyKey: ik,
                xTraceId: tid,
                checkRequest: request,
              }, { headers: attemptHeaders });
            } catch (err: any) {
              const mapped = this.mapError(err);
              if (this.options.debug) {
                console.error('❌ API Error Detail:', err);
                if (err.response) {
                  try {
                    const body = await err.response.json();
                    console.error('📦 Error Body:', JSON.stringify(body, null, 2));
                  } catch (e) {}
                }
              }
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
      const headers: Record<string, string> = { 
        ...(this.config.headers || {}),
        'x-idempotency-key': ik,
        'x-trace-id': tid
      };
      const actualRequest = (request as any).actualInstance || request;
      if (actualRequest.entities?.tenantId) {
        headers['x-trusted-tenant-id'] = actualRequest.entities.tenant_id || actualRequest.entities.tenantId;
      }

      try {
        await this.signals.ingestSignals({
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
        const headers: Record<string, string> = { 
          ...(this.config.headers || {}),
          'x-idempotency-key': ik,
          'x-trace-id': tid
        };
        // @ts-ignore - access raw for debug
        await this.signals.ingestPaymentEventRaw({
          xIdempotencyKey: ik,
          xTraceId: tid,
          paymentEvent: event,
        }, { headers });
      } catch (err: any) {
        if (this.options.debug) {
          console.error('❌ API Error Detail:', err);
          if (err.response) {
            try {
              const body = await err.response.json();
              console.error('📦 Error Body:', JSON.stringify(body, null, 2));
            } catch (e) {}
          }
        }
        throw this.mapError(err);
      }
    });
  }

  /**
   * 🔍 Query historical risk assessments and scores.
   */
  async getFraudScores(
    tenantId: string,
    options?: { 
      startTime?: string; 
      endTime?: string; 
      traceId?: string; 
      idempotencyKey?: string;
      pageSize?: number;
      pageToken?: string;
    }
  ): Promise<generated.ScoresSuccessResponse> {
    const tid = options?.traceId || this.generateId('trc');
    const ik = options?.idempotencyKey || this.generateId('idk');

    try {
      return await retry(
        async (bail) => {
          try {
            const headers: Record<string, string> = { 
              ...(this.config.headers || {}),
              'x-idempotency-key': ik,
              'x-trace-id': tid
            };
            const req = {
              tenantId,
              startTime: options?.startTime,
              endTime: options?.endTime,
              pageSize: options?.pageSize,
              pageToken: options?.pageToken,
            };
            return await this.forensics.getFraudScores(req, { headers });
          } catch (err: any) {
            const mapped = this.mapError(err);
            if (mapped instanceof RateLimitError || mapped instanceof InternalServerError) {
              throw mapped; // retry
            }
            bail(mapped);
            throw mapped;
          }
        },
        { retries: 2 }
      );
    } catch (e) {
      throw this.mapError(e);
    }
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
        const headers: Record<string, string> = { 
          ...(this.config.headers || {}),
          'x-idempotency-key': ik,
          'x-trace-id': tid
        };
        await this.signals.ingestSignals({
          xIdempotencyKey: ik,
          xTraceId: tid,
          signalsRequest: request,
        }, { headers });
      } catch (err) {
        throw this.mapError(err);
      }
    });
  }
}
