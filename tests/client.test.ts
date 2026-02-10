// Copyright (c) 2025 Alogram Inc.
// Comprehensive test suite for the Alogram Payrisk TypeScript SDK

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AlogramRiskClient, AlogramPublicClient } from '../src/client';
import { AuthenticationError, RateLimitError, ScopedAccessError } from '../src/exceptions';

const BASE_URL = 'https://api.alogram.ai';
const SECRET_KEY = 'sk_test_12345';
const PUBLIC_KEY = 'pk_test_12345';

describe('Dual-Trust SDK Architecture', () => {
  
  describe('AlogramRiskClient (Secret)', () => {
    let client: AlogramRiskClient;

    beforeEach(() => {
      client = new AlogramRiskClient({
        baseUrl: BASE_URL,
        apiKey: SECRET_KEY,
        tenantId: 'tid_default'
      });
      vi.restoreAllMocks();
    });

    const validDecision = {
      decision: 'approve',
      riskScore: 0.1,
      assessmentId: 'as_12345678901234567890123456789012',
      decisionAt: new Date().toISOString(),
      paymentIntentId: 'pi_00000000000000000000000000000000'
    };

    const validRequest = {
      eventType: 'purchase',
      entities: { tenantId: 'tid_test', clientId: 'cid_test', endCustomerId: 'ecid_test' },
      purchase: { amount: 10, currency: 'USD' }
    };

    it('should allow initialization with sk_ key', () => {
      expect(() => new AlogramRiskClient({ baseUrl: BASE_URL, apiKey: SECRET_KEY })).not.toThrow();
    });

    it('should block initialization with pk_ key', () => {
      expect(() => new AlogramRiskClient({ baseUrl: BASE_URL, apiKey: PUBLIC_KEY })).toThrow(ScopedAccessError);
    });

    it('should propagate headers correctly', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => (validDecision),
        headers: new Headers({ 'content-type': 'application/json' }),
      } as Response);

      await client.checkRisk(validRequest as any);

      const lastCall = fetchSpy.mock.calls[0];
      const headers = lastCall[1]?.headers as Record<string, string>;
      const getHeader = (name: string) => headers[name] || headers[name.toLowerCase()];

      expect(getHeader('x-api-key')).toBe(SECRET_KEY);
      expect(getHeader('x-trusted-tenant-id')).toBe('tid_test');
    });

    it('should map 401 to AuthenticationError', async () => {
      const mockResponse = {
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({ code: 401, message: 'Invalid Key' }),
        headers: new Headers({ 'content-type': 'application/json' }),
      };

      vi.spyOn(global, 'fetch').mockResolvedValue(mockResponse as Response);

      await expect(client.checkRisk(validRequest as any)).rejects.toThrow(AuthenticationError);
    });

    it('should retry on 500 errors and eventually succeed', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch')
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          json: async () => ({ code: 500 }),
          headers: new Headers({ 'content-type': 'application/json' }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => (validDecision),
          headers: new Headers({ 'content-type': 'application/json' }),
        } as Response);

      const result = await client.checkRisk(validRequest as any);
      
      expect(result.decision).toBe('approve');
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    }, 15000);
  });

  describe('AlogramPublicClient (Public)', () => {
    it('should allow initialization with pk_ key', () => {
      expect(() => new AlogramPublicClient({ baseUrl: BASE_URL, apiKey: PUBLIC_KEY })).not.toThrow();
    });

    it('should block initialization with sk_ key', () => {
      expect(() => new AlogramPublicClient({ baseUrl: BASE_URL, apiKey: SECRET_KEY })).toThrow(ScopedAccessError);
    });

    it('should not have checkRisk or ingestEvent methods', () => {
      const client = new AlogramPublicClient({ baseUrl: BASE_URL, apiKey: PUBLIC_KEY });
      expect((client as any).checkRisk).toBeUndefined();
      expect((client as any).ingestEvent).toBeUndefined();
    });

    it('should allow ingestSignals', async () => {
      const client = new AlogramPublicClient({ baseUrl: BASE_URL, apiKey: PUBLIC_KEY });
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        status: 202,
        json: async () => ({}),
        headers: new Headers({ 'content-type': 'application/json' }),
      } as Response);

      await client.ingestSignals({} as any);
      expect(fetchSpy).toHaveBeenCalled();
    });
  });
});
