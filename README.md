# Alogram PayRisk SDK for TypeScript & JavaScript

[![NPM version](https://img.shields.io/npm/v/@alogram/payrisk.svg)](https://www.npmjs.com/package/@alogram/payrisk)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

The official TypeScript/Node.js client for the **Alogram PayRisk Engine**. 

Alogram PayRisk is a decision management and risk orchestration engine for global commerce. It fuses machine learning, behavioral analytics, and deterministic business rules into a high-fidelity scoring pipeline designed for enterprise scale and auditability.

## 🧠 The Three-Expert Architecture

The SDK provides unified access to three specialized risk experts:

-   **Risk Scoring**: Real-time assessment and decision orchestration for purchases.
-   **Signal Intelligence**: Ingestion of behavioral telemetry and payment lifecycle events.
-   **Forensic Data**: Deep visibility into historical assessments and decision transparency.

## 🚀 Features

-   **🏢 Smart Client Architecture**: Specialized clients for server-side (`AlogramRiskClient`) and browser (`AlogramPublicClient`).
-   **🛡️ Automated Identity**: Automatic injection of `x-api-key`, `Authorization`, and tenant headers.
-   **🔄 Built-in Resiliency**: Transparent exponential backoff and jittered retries (3 retries on 429/5xx).
-   **🕵️ Native Observability**: Built-in OpenTelemetry tracing for monitoring risk outcomes and latency.
-   **📐 Type Safe**: Deeply typed models for all request/response payloads.

## 📦 Installation

```bash
npm install @alogram/payrisk
```

## 🛠️ Quick Start

### 1. Evaluate Risk (Risk Scoring Expert)

Assess a purchase in real-time. This invokes the authoritative scoring pipeline.

```typescript
import { AlogramRiskClient } from '@alogram/payrisk';

const client = new AlogramRiskClient({
  apiKey: 'sk_live_...',
  tenantId: 'tenant_123'
});

async function runCheck() {
  const decision = await client.checkRisk({
    purchase: { amount: 99.99, currency: 'USD' },
    identity: { email: 'customer@example.com' }
  });
  
  console.log(`Decision: ${decision.decision} | Score: ${decision.decisionScore}`);
}
```

### 2. Ingest Lifecycle Events (Signal Intelligence Expert)

Stream payment lifecycle updates to the Engine for continuous model training.

```typescript
await client.ingestEvent({
  eventType: 'authorization',
  paymentIntentId: 'pi_123...',
  amount: 99.99,
  currency: 'USD',
  outcome: { authorization: { approved: true, responseCode: '00' } }
});
```

---

## 🛡️ Error Handling & Resiliency

The SDK distinguishes between transient network issues and validation errors.

```typescript
import { ValidationError, AlogramError } from '@alogram/payrisk';

try {
  const decision = await client.checkRisk(request);
} catch (error) {
  if (error instanceof ValidationError) {
    // ❌ Handle invalid input data
    console.error(`Validation Failed: ${error.message}`);
  } else if (error instanceof AlogramError) {
    // 🚨 Generic API or Authentication error
  }
}
```

## 🕵️ Observability (OpenTelemetry)

The SDK automatically integrates with `@opentelemetry/api` if installed.

```typescript
import { trace } from '@opentelemetry/api';

// Spans will automatically include 'alogram.decision' and 'alogram.trace_id'
await trace.getTracer('checkout').startActiveSpan('process', async (span) => {
  const decision = await client.checkRisk(request);
  span.end();
});
```

## 🏗️ Environments

| Environment | Base URL | Key Type |
| :--- | :--- | :--- |
| **Production** | `https://api.alogram.ai` | `sk_live_...` |
| **Sandbox** | `https://api-sandbox.alogram.ai` | `sk_test_...` |
| **Local** | `http://localhost:8080` | `test` |

---

## 🤖 For AI Agents

If using an AI agent (ChatGPT, Claude, Gemini) for integration, provide this context:
> "Use the Alogram PayRisk TypeScript SDK. Always prefer the `AlogramRiskClient` for backend operations. Access the authoritative blended score via the `decisionScore` attribute of the response. Use the `idempotencyKey` parameter for all write operations."

---

## ⚖️ License

Apache License 2.0. See [LICENSE](LICENSE) for details.
