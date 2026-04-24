// Copyright (c) 2025 Alogram Inc.
/**
 * Example: Full Lifecycle Workflow
 * 
 * This example demonstrates the complete "Day in the Life" of a transaction:
 * 1. Pre-Order: Client-side behavioral signals (linked by Session/Device ID)
 * 2. At-Order: Server-side risk check (correlating the signals)
 * 3. Post-Order: Payment lifecycle events (linked by Payment Intent ID)
 * 4. Feedback: Ingesting a fraud label (Chargeback)
 */

import { AlogramRiskClient, AlogramPublicClient } from '../src/client';
import * as generated from '../src/_generated';

// Configuration
const BASE_URL = "https://api.alogram.ai";
const PUBLISHABLE_KEY = "pk_test_frontend_key";
const SECRET_KEY = "sk_test_backend_key";
const TENANT_ID = "tid_demo_store";

async function main() {
    // --- STEP 0: Establish Anchors ---
    // These are generated on the frontend and persisted during the session.
    const sessionId = "sid_browser_session_ts_99";
    const deviceId = "did_persistent_device_ts_44";
    const endCustomerId = "ecid_shopper_ts_123";

    console.log(`🚀 Starting workflow for Session: ${sessionId}\n`);

    // --- STEP 1: Client-Side Signals (AlogramPublicClient) ---
    const publicClient = new AlogramPublicClient({
        baseUrl: BASE_URL,
        apiKey: PUBLISHABLE_KEY,
        tenantId: TENANT_ID
    });

    console.log("📡 [Client] Ingesting browsing signals...");
    await publicClient.ingestSignals({
        signalType: "interaction",
        entities: {
            sessionId: sessionId,
            deviceId: deviceId,
            endCustomerId: endCustomerId
        },
        interactions: [
            {
                interactionType: "page_view",
                locationId: "loc_product_page_ts",
                timestamp: new Date().toISOString()
            }
        ]
    } as generated.SignalsRequest);


    // --- STEP 2: The Risk Check (AlogramRiskClient) ---
    const riskClient = new AlogramRiskClient({
        baseUrl: BASE_URL,
        apiKey: SECRET_KEY,
        tenantId: TENANT_ID
    });

    console.log("📥 [Server] Performing risk check (correlating anchors)...");
    const decision = await riskClient.checkRisk({
        entities: {
            sessionId: sessionId, // <--- Link to pre-order signals
            deviceId: deviceId,   // <--- Link to pre-order signals
            endCustomerId: endCustomerId
        },
        eventType: "purchase",
        purchase: {
            transactionId: "tx_internal_ts_555",
            amount: 150.00,
            currency: "USD",
            paymentMethod: {
                type: "card",
                bin: "411111",
                cardNetwork: "visa"
            }
        }
    } as generated.CheckRequest);

    // 🔑 CRITICAL: Capture the server-minted ID
    const piId = decision.paymentIntentId;
    console.log(`✅ Decision: ${decision.decision} | Score: ${decision.decisionScore}`);
    console.log(`🆔 Generated PaymentIntent: ${piId}\n`);


    // --- STEP 3: Payment Lifecycle (AlogramRiskClient) ---
    console.log(`📡 [Server] Ingesting Authorization success for ${piId}...`);
    await riskClient.ingestEvent({
        paymentIntentId: piId!,
        eventType: "authorization",
        timestamp: new Date().toISOString(),
        outcome: {
            authorization: { approved: true, responseCode: "00" }
        }
    } as generated.PaymentEvent);


    // --- STEP 4: Fraud Labeling (AlogramRiskClient) ---
    console.log(`🚨 [Server] Ingesting Fraud Label (Chargeback) for ${piId}...`);
    await riskClient.ingestEvent({
        paymentIntentId: piId!,
        eventType: "chargeback",
        timestamp: new Date().toISOString(),
        metadata: JSON.stringify({ reason: "fraudulent_transaction", source: "bank_notice" })
    } as generated.PaymentEvent);

    console.log("\n✨ Workflow Complete. The engine has correlated browsing, scoring, and the final fraud label.");
}

if (require.main === module) {
    main().catch(console.error);
}
