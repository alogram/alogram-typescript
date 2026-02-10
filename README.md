# Alogram PayRisk SDK for TypeScript & JavaScript

[![NPM version](https://img.shields.io/npm/v/@alogram/payrisk.svg)](https://www.npmjs.com/package/@alogram/payrisk)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

The official Alogram PayRisk 'Smart' SDK for TypeScript and Node.js. Designed for high-performance financial systems that require resilient risk intelligence and native observability.

## 🚀 Features

-   **🏢 Smart Client Architecture**: Dedicated clients for server-side (`AlogramRiskClient`) and browser (`AlogramPublicClient`).
-   **🛡️ Automated Identity**: Automatic injection of `x-api-key`, `Authorization`, and tenant headers.
-   **🔄 Built-in Resiliency**: Transparent exponential backoff and jittered retries (3 retries on 429/5xx).
-   **🕵️ OpenTelemetry Native**: Built-in tracing for monitoring risk decision latency and outcomes.
-   **📐 Type Safety**: Deeply typed models for all request/response payloads.

## 📦 Installation

```bash
npm install @alogram/payrisk
```

## 🛠️ Quick Start

### Evaluate Risk (Server-Side)

```typescript
import { AlogramRiskClient } from '@alogram/payrisk';

const client = new AlogramRiskClient({
  apiKey: 'sk_live_your_secret_key',
  tenantId: 'tenant_123'
});

async function runCheck() {
  const decision = await client.checkRisk({
    purchase: { amount: 99.99, currency: 'USD' },
    identity: { email: 'customer@example.com' }
  });
  console.log(`Decision: ${decision.decision}`);
}
```

---

## 🛡️ Error Handling

Catch specific errors to manage your checkout flow gracefully:

```typescript
import { RateLimitError, ValidationError, AlogramError } from '@alogram/payrisk';

try {
  const decision = await client.checkRisk(request);
} catch (error) {
  if (error instanceof RateLimitError) {
    // 🔄 SDK handles retries, but you can add custom logging here
  } else if (error instanceof ValidationError) {
    // ❌ Handle invalid input data
    console.error(error.message);
  } else if (error instanceof AlogramError) {
    // 🚨 Generic API error
  }
}
```

## 🔑 Authentication & Keys

Obtain your keys from the [Alogram Dashboard](https://dashboard.alogram.ai/keys).

| Key Type | Prefix | Client | Use Case |
| :--- | :--- | :--- | :--- |
| **Secret Key** | `sk_live_...` | `AlogramRiskClient` | Server-side risk checks. **Never expose.** |
| **Publishable Key** | `pk_live_...` | `AlogramPublicClient` | Frontend behavioral signals. |

## 🤖 For AI Agents (Integration Context)

If you are using an AI agent (like ChatGPT, Claude, or Gemini), provide this context:

> "I am integrating the Alogram PayRisk TypeScript SDK. I need to call `checkRisk` in my backend service. Use the `AlogramRiskClient`, handle `RateLimitError` gracefully, and ensure you use the `idempotencyKey` parameter."

---

## 🧪 Local Testing & Mocking

Use the zero-dependency `MockRiskClient` for your test suite:

```typescript
import { MockRiskClient } from '@alogram/payrisk/testing';

const mock = new MockRiskClient();
mock.queueDecision('decline', 0.99, 'high_risk_ip');

const decision = await myApp.process(mock);
console.log(decision.decision); // 'decline'
```

## 🏗️ Environment Testing

### Alogram Sandbox
For safe integration testing, point your client to the Sandbox environment:
```typescript
const client = new AlogramRiskClient({
  apiKey: 'sk_test_...',
  baseUrl: 'https://api-sandbox.alogram.ai'
});
```

### Local Emulator
For hermetic local testing, run the **Alogram Local Emulator**:
```bash
docker run -p 8080:8080 alogram/payrisk-emulator
```
Point your client to the local instance:
```typescript
const client = new AlogramRiskClient({
  baseUrl: 'http://localhost:8080',
  apiKey: 'test'
});
```

---

## 📚 Documentation

For full API reference, visit [docs.alogram.ai](https://docs.alogram.ai).

## ⚖️ License

Apache License 2.0. See [LICENSE](LICENSE) for details.
