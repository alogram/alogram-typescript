// Copyright (c) 2025 Alogram Inc.
// Example: Production Error Handling
//
// Demonstrates robust error handling and the "Fail-Open" strategy in TypeScript.

import { 
  AlogramRiskClient, 
  ValidationError, 
  AuthenticationError, 
  RateLimitError,
  InternalServerError,
  CheckRequest
} from '@alogram/payrisk';

const client = new AlogramRiskClient({
  baseUrl: 'https://api.alogram.ai',
  apiKey: 'sk_test_...'
});

async function processPayment(request: CheckRequest) {
  try {
    const decision = await client.checkRisk(request);
    
    if (decision.decision === 'decline') {
      return { status: 'blocked', reason: decision.reasons };
    }
    
    return { status: 'approved', score: decision.riskScore };

  } catch (e) {
    if (e instanceof AuthenticationError) {
      // Logic error: Your keys are wrong. Notify Ops.
      console.error('🚨 AUTH FAILURE: Check API Keys');
      throw e;
    }

    if (e instanceof ValidationError) {
      // Integration error: You sent bad data.
      console.error('❌ INVALID DATA:', e.message);
      return { status: 'error', message: 'Internal validation failed' };
    }

    if (e instanceof RateLimitError || e instanceof InternalServerError) {
      // System issues: These were already retried by the SDK.
      // STRATEGY: Fail-Open. Don't block the user if Alogram is down.
      console.warn('⚠️ SYSTEM DEGRADED: Allowing via fail-open');
      return { status: 'approved', note: 'manual_review_required' };
    }

    throw e;
  }
}
