// Copyright (c) 2025 Alogram Inc.
// All rights reserved.

import { DecisionResponse, FraudScore, RiskLevelEnum, ReasonDetail } from './_generated';

/**
 * 🛠️ **MockRiskClient**
 * 
 * A zero-dependency mock implementation of the Alogram Risk Client for local testing.
 */
export class MockRiskClient {
  private _calls: Array<{ method: string; request: any; timestamp: number }> = [];
  private _queuedResponses: Array<DecisionResponse | Error> = [];
  private _defaultDecision = 'approve';
  private _defaultScore = 0.1;
  private _delayMs = 0;

  setDefaultDecision(decision: string, score: number = 0.1): void {
    this._defaultDecision = decision.toLowerCase();
    this._defaultScore = score;
  }

  private getTimestamp(): string {
    return new Date().toISOString();
  }

  queueDecision(decision: string, score: number = 0.1, reason?: string): void {
    const resp: DecisionResponse = {
      assessmentId: `mock-${Math.random().toString(36).substring(2, 14)}`,
      decision: decision.toLowerCase() as any,
      decisionAt: this.getTimestamp(),
      riskScore: score,
      fraudScore: {
        riskLevel: 'low' as RiskLevelEnum,
        score: score,
        explanation: 'Mocked response',
      },
      reasons: reason ? [{
        code: 'MOCK_CODE',
        category: 'behavior' as any,
        displayName: 'Mock Reason',
        description: reason,
      }] : [],
    };
    this._queuedResponses.push(resp);
  }

  queueError(error: Error): void {
    this._queuedResponses.push(error);
  }

  setDelay(ms: number): void {
    this._delayMs = ms;
  }

  get callCount(): number {
    return this._calls.length;
  }

  get calls(): Array<any> {
    return this._calls;
  }

  private async _handleCall(method: string, request: any): Promise<DecisionResponse | undefined> {
    this._calls.push({ method, request, timestamp: Date.now() });

    if (this._delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this._delayMs));
    }

    if (this._queuedResponses.length > 0) {
      const item = this._queuedResponses.shift();
      if (item instanceof Error) {
        throw item;
      }
      return item;
    }
    return undefined;
  }

  async checkRisk(request: any): Promise<DecisionResponse> {
    const res = await this._handleCall('checkRisk', request);
    if (res) return res;

    return {
      assessmentId: `mock-${Math.random().toString(36).substring(2, 14)}`,
      decision: this._defaultDecision as any,
      decisionAt: this.getTimestamp(),
      riskScore: this._defaultScore,
      fraudScore: {
        riskLevel: 'low' as RiskLevelEnum,
        score: this._defaultScore,
      },
      reasons: [{
        code: 'DEFAULT',
        category: 'behavior' as any,
        displayName: 'Default',
        description: 'default_mock_response',
      }],
    };
  }

  async ingestSignals(request: any): Promise<void> {
    await this._handleCall('ingestSignals', request);
  }

  async ingestEvent(event: any): Promise<void> {
    await this._handleCall('ingestEvent', event);
  }
}