# Alogram Payrisk TypeScript SDK

[![npm version](https://img.shields.io/npm/v/@alogram/payrisk.svg?style=flat-square)](https://www.npmjs.com/package/@alogram/payrisk)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg?style=flat-square)](https://opensource.org/licenses/Apache-2.0)
[![Status](https://img.shields.io/badge/status-preview-orange.svg?style=flat-square)](#)

The official TypeScript client for the **Alogram Payments Risk API**. This SDK provides a robust, "smart" interface for checking fraud risk, ingesting behavioral signals, and managing payment lifecycle events in Node.js and Browser environments.

**Key Features:**
*   **Resilient:** Built-in retries with exponential backoff for transient errors.
*   **Traceable:** Automatic injection of `x-trace-id` and `x-idempotency-key` for every request.
*   **Observable:** First-class support for **OpenTelemetry** spans and attributes.
*   **Type-Safe:** Fully typed request/response models.
*   **Modern:** Supports ESM and CommonJS, works with Node.js 18+.

---

## 🏗️ Installation

```bash
npm install @alogram/payrisk
```

---

## 🚀 Quickstart

### 1. Initialize the Client

```typescript
import { AlogramRiskClient } from '@alogram/payrisk';

const client = new AlogramRiskClient({
  baseUrl: 'https://api.alogram.ai',
  apiKey: 'sk_live_...',
  tenantId: 'your_tenant_id', // Optional default
  debug: false
});
```

---

## 📊 Observability (OpenTelemetry)

The SDK automatically detects if `@opentelemetry/api` is configured in your project. It emits spans for all API calls with standard attributes:

*   `alogram.tenant_id`
*   `alogram.idempotency_key`
*   `alogram.trace_id`
*   `alogram.decision`

To enable, ensure the OTel API is installed:
```bash
npm install @opentelemetry/api
```

---

## 🧠 Core Concepts

### Idempotency & Tracing
Unique IDs are generated automatically for every request.

```typescript
// Manual override (Optional)
await client.checkRisk(request, {
  idempotencyKey: 'order_123',
  traceId: 'req_abc'
});
```

### Webhook Security
Always verify incoming webhooks using the built-in `WebhookVerifier`.

```typescript
import { WebhookVerifier } from '@alogram/payrisk';

const isValid = WebhookVerifier.verify(
  rawBody, 
  headers['x-alogram-signature'], 
  process.env.ALOGRAM_WEBHOOK_SECRET
);
```

---

## ⚠️ Error Handling

The SDK maps HTTP errors to specific TypeScript classes:

| Exception | HTTP Status | Description |
| :--- | :--- | :--- |
| `AuthenticationError` | 401, 403 | Invalid API Key or Permissions. |
| `ValidationError` | 400, 422 | Invalid request body or missing fields. |
| `RateLimitError` | 429 | Too many requests. **Automatically Retried.** |
| `InternalServerError` | 500+ | Server-side issues. **Automatically Retried.** |

---

## 📚 Cookbook Examples

Explore the `examples/` directory for production patterns:

*   [**Async Signal Ingestion**](examples/asyncSignalIngestion.ts): Non-blocking behavioral data collection.
*   [**Production Error Handling**](examples/productionErrorHandling.ts): Fail-open strategies.
*   [**Webhook Verification**](examples/webhookVerification.ts): Cryptographic signature checking.

---

## 📦 License

Apache 2.0
