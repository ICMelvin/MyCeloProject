# FalconGuard Scan-Agent API Documentation

## Overview

FalconGuard Scan-Agent is a smart contract security scanner powered by Slither and custom audit rules, integrated with x402 v2 payment protocol for metered access on Celo.

**Base URL:** `http://localhost:3000`
**Network:** Celo Sepolia (`eip155:11142220`)
**Payment:** x402 v2 with USDC

---

## Authentication

The scan endpoint uses x402 v2 payment protocol. Clients must:

1. Send initial request without payment headers
2. Receive HTTP 402 with payment requirements
3. Create EIP-3009 payment authorization
4. Include `PAYMENT-SIGNATURE` header in retry

See [Client Integration](#client-integration) for details.

---

## Endpoints

### POST /scan

Scan a smart contract for security vulnerabilities.

**Request Headers:**
- `Content-Type: application/json`
- `PAYMENT-SIGNATURE` (required after 402 response)

**Query Parameters:**
- `format` (optional): `json` (default) or `markdown`

**Request Body:**
```json
{
  "contractPath": "0x1234567890123456789012345678901234567890",
  "sourceCode": "pragma solidity ^0.8.0; ..."
}
```

**Note:** Either `contractPath` (valid 0x address) or `sourceCode` (raw Solidity string) must be provided. `contractPath` must be a valid 42-character hex address (0x...). Local file paths are not accepted for security reasons.

**Response (402 Payment Required):**
```json
{
  "accepts": [
    {
      "scheme": "exact",
      "network": "eip155:11142220",
      "amount": "10000",
      "asset": "0x01C5C0122039549AD1493B8220cABEdD739BC44E",
      "payTo": "0x41dbdBBB116C5eFb9c0290b9A4A61502361b5bB9",
      "maxTimeoutSeconds": 300,
      "extra": {
        "name": "USDC",
        "version": "2"
      }
    }
  ],
  "x402Version": 2
}
```

**Response (200 Success - JSON):**
```json
{
  "scanId": "fg-1785926649900-tagzb",
  "timestamp": "2026-08-05T10:44:17.671Z",
  "target": "./test-contracts/VulnerableVault.sol",
  "status": "SUCCESS",
  "summary": {
    "totalFindings": 7,
    "critical": 0,
    "high": 3,
    "medium": 0,
    "low": 2,
    "informational": 2,
    "riskScore": 32
  },
  "findings": [...],
  "scanDurationMs": 2186,
  "metadata": {
    "slitherRan": true,
    "customChecksRan": true,
    "scannerVersion": "FalconGuard-ScanEngine-v1.0.0",
    "engines": ["Slither v0.10+", "FalconGuard Custom Rules v1.0"]
  },
  "branding": {
    "product": "FalconGuard Pro — Smart Contract Security Scanner",
    "tagline": "Autonomous AI-powered vulnerability detection on Celo",
    "attributionTag": "celo_4d19a013cc70",
    "network": "celo-sepolia",
    "disclaimer": "Automated analysis only. Results should be reviewed by a qualified security auditor..."
  }
}
```

**Response (200 Success - Markdown):**
Returns formatted markdown report with risk badges, severity tables, and detailed findings.

---

## Client Integration

### Using x402 v2 Client

```typescript
import { x402HTTPClient, registerExactEvmScheme } from '@x402/core/client';
import { createWalletClient, createPublicClient, http } from 'viem';
import { celoSepolia } from 'viem/chains';

// Setup clients
const walletClient = createWalletClient({
  chain: celoSepolia,
  transport: http(),
  account: privateKeyToAccount('YOUR_PRIVATE_KEY'),
});

const publicClient = createPublicClient({
  chain: celoSepolia,
  transport: http(),
});

// Create x402 client
const httpClient = new x402HTTPClient();
registerExactEvmScheme(httpClient, walletClient);

// 1. Initial request
const initialRes = await fetch('http://localhost:3000/scan', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ sourceCode: 'pragma solidity ^0.8.0; contract Test { ... }' }),
});

if (initialRes.status === 402) {
  const paymentRequired = await initialRes.json();
  
  // 2. Create payment payload
  const paymentPayload = await httpClient.createPaymentPayload(paymentRequired);
  
  // 3. Encode payment signature
  const paymentHeaders = httpClient.encodePaymentSignatureHeader(paymentPayload);
  
  // 4. Retry with payment
  const paidRes = await fetch('http://localhost:3000/scan', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...paymentHeaders,
    },
    body: JSON.stringify({ sourceCode: 'pragma solidity ^0.8.0; contract Test { ... }' }),
  });
  
  // 5. Process result
  const result = await httpClient.processPaymentResult(
    paymentPayload,
    (name) => paidRes.headers.get(name),
    paidRes.status,
  );
  
  const report = await paidRes.json();
  console.log('Scan complete:', report.scanId);
}
```

### Using cURL

```bash
# 1. Initial request (will return 402)
curl -X POST http://localhost:3000/scan \
  -H "Content-Type: application/json" \
  -d '{"sourceCode": "pragma solidity ^0.8.0; contract Test { ... }"}'

# 2. Create payment signature using x402 client
# 3. Retry with PAYMENT-SIGNATURE header
curl -X POST http://localhost:3000/scan \
  -H "Content-Type: application/json" \
  -H "PAYMENT-SIGNATURE: <base64-encoded-payment>" \
  -d '{"sourceCode": "pragma solidity ^0.8.0; contract Test { ... }"}'
```

---

## Vulnerability Categories

| Category | Description |
|----------|-------------|
| REENTRANCY | Reentrancy attacks via external calls |
| ACCESS_CONTROL | Authorization and authentication issues |
| UNCHECKED_CALL | Unchecked return values from external calls |
| ARITHMETIC | Integer overflow/underflow issues |
| DELEGATECALL | Unsafe delegatecall usage |
| DENIAL_OF_SERVICE | Gas limit and DoS vulnerabilities |
| FLASH_LOAN | Flash loan attack vectors |
| FRONT_RUNNING | Transaction ordering dependencies |
| OTHER | Other security issues (timestamp, pragma, etc.) |

---

## Severity Levels

| Severity | Score Weight | Description |
|----------|--------------|-------------|
| CRITICAL | 25 | Exploitable vulnerabilities leading to asset loss |
| HIGH | 10 | Serious security issues requiring immediate attention |
| MEDIUM | 4 | Moderate security concerns |
| LOW | 1 | Minor issues with limited impact |
| INFORMATIONAL | 0 | Best practice suggestions |

**Risk Score Calculation:** `(CRITICAL × 25) + (HIGH × 10) + (MEDIUM × 4) + (LOW × 1)` (capped at 100)

---

## Environment Variables

```env
# Network Configuration
NETWORK=celo-sepolia
START_SERVER=true

# x402 Payment Configuration
X402_API_KEY=your_api_key_here
PAYTO_ADDRESS=0x41dbdBBB116C5eFb9c0290b9A4A61502361b5bB9
FACILITATOR_URL=https://x402.celo.org
PRICE_PER_SCAN=$0.01

# Client Agent Configuration
CLIENT_AGENT_PRIVATE_KEY=your_private_key_here
```

---

## Error Codes

| Status | Error | Description |
|--------|-------|-------------|
| 400 | Bad Request | Missing contractPath or sourceCode, or invalid contract path format |
| 402 | Payment Required | x402 payment signature needed |
| 500 | Internal Error | Scan execution failed |

---

## Examples

### Scan with Markdown Output

```bash
curl -X POST "http://localhost:3000/scan?format=markdown" \
  -H "Content-Type: application/json" \
  -H "PAYMENT-SIGNATURE: <payment>" \
  -d '{"sourceCode": "pragma solidity ^0.8.0; contract Test { ... }"}'
```

### Scan with Source Code String

```bash
curl -X POST http://localhost:3000/scan \
  -H "Content-Type: application/json" \
  -H "PAYMENT-SIGNATURE: <payment>" \
  -d '{"sourceCode": "pragma solidity ^0.8.0; contract Test { ... }"}'
```

---

## Support

- **Documentation:** See README.md
- **Issues:** Report bugs on GitHub
- **Network:** Celo Sepolia Testnet
- **Explorer:** https://explorer.sepolia.celo.org

---

## License

MIT License - See LICENSE file for details.
