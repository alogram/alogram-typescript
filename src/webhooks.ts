// Copyright (c) 2025 Alogram Inc.
// All rights reserved.

import { createHmac, timingSafeEqual } from 'crypto';
import { ValidationError } from './exceptions';

export class WebhookVerifier {
  /**
   * Utility to verify the authenticity of webhooks sent by Alogram.
   * 
   * @param payload The raw string or Buffer of the request body.
   * @param signature The value of the 'x-alogram-signature' header.
   * @param secret Your Alogram Webhook Secret.
   */
  static verify(payload: string | Buffer, signature: string, secret: string): boolean {
    if (!signature || !secret) {
      throw new ValidationError('Missing signature or secret');
    }

    const expectedSignature = createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    // Use timing-safe comparison to prevent timing attacks
    const bufferExpected = Buffer.from(expectedSignature, 'utf8');
    const bufferActual = Buffer.from(signature, 'utf8');

    if (bufferExpected.length !== bufferActual.length || !timingSafeEqual(bufferExpected, bufferActual)) {
      throw new ValidationError('Invalid webhook signature');
    }

    return true;
  }
}
