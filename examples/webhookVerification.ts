// Copyright (c) 2025 Alogram Inc.
// Example: Webhook Verification
//
// Secures your Node.js endpoint by verifying Alogram's cryptographic signatures.

import { WebhookVerifier } from '@alogram/payrisk';

// In a real app, this comes from process.env
const WEBHOOK_SECRET = 'whsec_...';

/**
 * Example handler for an Express.js route
 */
export async function handleWebhook(req: any, res: any) {
  const signature = req.headers['x-alogram-signature'];
  const rawBody = req.body; // Ensure you have access to the raw buffer

  try {
    WebhookVerifier.verify(rawBody, signature, WEBHOOK_SECRET);
    
    console.log('✅ Webhook Verified!');
    // Handle the event (e.g. chargeback.updated)
    
    res.status(200).send('OK');
  } catch (e) {
    console.error('🛑 Invalid Signature:', e);
    res.status(401).send('Unauthorized');
  }
}
