// Copyright (c) 2025 Alogram Inc.
// Example: Async Signal Ingestion
// 
// This example shows how to ingest behavioral signals asynchronously
// using standard Promise patterns in TypeScript.

import { AlogramRiskClient, SignalsRequest } from '@alogram/payrisk';

const client = new AlogramRiskClient({
  baseUrl: 'https://api.alogram.ai',
  apiKey: 'sk_test_...'
});

/**
 * Simulates a background signal sender.
 * In a real application, you might use a dedicated queue or worker.
 */
async function sendSignalInBackground(userId: string, type: 'page_view' | 'feature_use') {
  const request: SignalsRequest = {
    signalType: 'interaction',
    entities: {
      tenantId: 'tid_123',
      clientId: 'web_frontend',
      endCustomerId: userId
    },
    interactions: [
      {
        interactionType: type,
        timestamp: new Date().toISOString(),
        locationId: 'loc_browser'
      }
    ]
  };

  try {
    // Note: We don't await this in the main thread to keep UI responsive
    await client.ingestSignals(request);
    console.log(`✅ Signal ${type} ingested for ${userId}`);
  } catch (e) {
    console.error(`❌ Signal ingestion failed: ${e}`);
  }
}

// Simulated Express/Next.js handler
export function onUserClick(userId: string) {
  console.log(`👤 User ${userId} clicked a button.`);
  
  // Fire and forget - don't await the result
  sendSignalInBackground(userId, 'feature_use');
  
  return { status: 'success' };
}
