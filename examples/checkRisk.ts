import { AlogramRiskClient } from '@alogram/payrisk';

async function main() {
  const client = new AlogramRiskClient({
    baseUrl: 'https://api.alogram.ai',
    apiKey: 'sk_test_12345'
  });

  const response = await client.checkRisk({
    eventType: 'purchase',
    entities: {
      tenantId: 'tid_test',
      clientId: 'cid_test',
      endCustomerId: 'ecid_test'
    },
    purchase: {
      amount: 10.50,
      currency: 'USD',
      transactionId: 'tx_test_123'
    }
  });

  console.log('Risk Decision:', response.decision);
}

main().catch(console.error);
