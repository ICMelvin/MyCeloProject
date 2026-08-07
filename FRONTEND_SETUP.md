# FalconGuard Frontend Setup Guide

## Overview

A React-based web UI has been created for the FalconGuard Scan-Agent in `src/frontend/`. It provides a clean interface for scanning smart contracts with x402 micropayments.

## (a) How to Run Locally

### Prerequisites

1. **Backend server must be running**:
```bash
# From project root
npm run dev
```

2. **Install frontend dependencies**:
```bash
cd src/frontend
npm install
```

3. **Configure WalletConnect Project ID**:
```bash
cp .env.example .env
```

Edit `.env` and add your WalletConnect Project ID from [cloud.walletconnect.com](https://cloud.walletconnect.com):
```
VITE_WALLETCONNECT_PROJECT_ID=your_actual_project_id_here
```

### Starting the Frontend

**Option 1: From project root (recommended)**
```bash
npm run frontend:dev
```

**Option 2: Direct in frontend directory**
```bash
cd src/frontend
npm run dev
```

The frontend will run on `http://localhost:5173` and automatically proxy API requests to the backend at `http://localhost:3000`.

### Building for Production

```bash
npm run frontend:build
```

Built files will be in `src/frontend/dist/`.

## (b) Assumptions About /scan Endpoint

The frontend assumes the following about your existing `/scan` endpoint:

### Request Format

**For contract address:**
```json
{
  "contractPath": "0x..."
}
```

**For source code:**
```json
{
  "sourceCode": "// Solidity code here"
}
```

### Response Format

**402 Payment Required:**
```json
{
  "accepts": [{
    "scheme": "exact",
    "network": "eip155:11142220",
    "amount": "10000",
    "asset": "0x...",
    "payTo": "0x...",
    "maxTimeoutSeconds": 300,
    "extra": {
      "name": "USDC",
      "version": "2"
    }
  }],
  "x402Version": 2
}
```

**Success Response:**
```json
{
  "scanId": "fg-...",
  "summary": {
    "totalFindings": 7,
    "critical": 1,
    "high": 1,
    "medium": 2,
    "low": 3
  }
}
```

### Payment Flow

1. Frontend sends initial POST request to `/scan`
2. Backend returns 402 with payment requirements
3. Frontend uses x402 SDK to sign EIP-3009 authorization
4. Frontend resends request with `PAYMENT-SIGNATURE` header
5. Backend processes payment and returns scan results

**Please verify:**
- Your backend accepts both `contractPath` and `sourceCode` in request body
- The response structure matches the expected format
- The payment flow works with the x402 SDK's signing approach

## (c) Safety Verification - No Hardcoded Test Data

**CONFIRMED: No hardcoded test contract addresses or files in frontend code.**

### Verification Results

✅ **No test contract addresses found:**
- Searched for `0x01C5C0122039549AD1493B8220cABEdD739BC44E` (Sepolia USDC) - **NOT FOUND**
- Searched for `0xcEBA9300f2b948710d2653dD7B07f33A8B32118C` (Mainnet USDC) - **NOT FOUND**
- Searched for test contract names like `VulnerableVault` - **NOT FOUND**
- Searched for `test-contracts` directory references - **NOT FOUND**

✅ **Only "0x" occurrences are:**
- Regex validation pattern: `/^0x[a-fA-F0-9]{40}$/` (for user input validation)
- Placeholder text: `placeholder="0x..."` (generic UI hint, not a real address)

✅ **Input fields are genuinely empty:**
- Contract address input has no pre-filled value
- File upload has no pre-selected files
- All contract data comes from user input at runtime

✅ **No test .sol files bundled:**
- Frontend only accepts user-uploaded .sol files
- No Solidity files are included in the frontend build
- File upload restricts to `.sol` extension only

✅ **Chain configuration is dynamic:**
- Celo Sepolia config pulled from `src/config/chain.ts`
- RPC URL matches backend configuration
- No hardcoded network-specific test addresses

## Architecture

### Tech Stack
- **React 18** with TypeScript
- **Vite** for development and building
- **Wagmi** for wallet connection and blockchain interactions
- **RainbowKit** for wallet UI (MetaMask + WalletConnect)
- **TailwindCSS** for styling with dark mode support
- **x402 SDK** for payment handling (same as CLI client)

### Project Structure
```
src/frontend/
├── src/
│   ├── components/
│   │   ├── Header.tsx          # Wallet connection + dark mode toggle
│   │   ├── ContractSubmission.tsx  # Address/file input + payment flow
│   │   └── ScanResults.tsx     # Results display
│   ├── config/
│   │   ├── chain.ts            # Celo Sepolia configuration
│   │   └── wagmi.ts            # Wagmi config with WalletConnect
│   ├── App.tsx                 # Main app component
│   ├── main.tsx                # Entry point
│   └── index.css               # Tailwind + CSS variables
├── package.json
├── vite.config.ts              # Vite config with proxy
├── tailwind.config.js
└── tsconfig.json
```

### Key Features

1. **Wallet Connection**
   - RainbowKit integration
   - MetaMask (browser extension)
   - WalletConnect (mobile wallets)
   - Shows CELO balance and address

2. **Contract Submission**
   - Toggle between address input and file upload
   - Address validation (0x prefix + 40 hex chars)
   - File upload restricted to .sol extension
   - Drag-and-drop support

3. **Payment Flow**
   - Reuses x402 SDK signing logic from CLI client
   - Client-side EIP-3009 signing
   - Automatic payment header generation
   - Loading states during signing and scanning

4. **Results Display**
   - Scan ID and findings count
   - Severity breakdown (Critical/High/Medium/Low)
   - Transaction hash link to Blockscout
   - User-friendly error messages

5. **Dark Mode**
   - Toggle in header
   - CSS variables for theming
   - Persists preference in localStorage

## Next Steps

1. Get WalletConnect Project ID from [cloud.walletconnect.com](https://cloud.walletconnect.com)
2. Add it to `src/frontend/.env`
3. Install dependencies: `cd src/frontend && npm install`
4. Start backend: `npm run dev` (from project root)
5. Start frontend: `npm run frontend:dev` (from project root)
6. Open `http://localhost:5173`
7. Connect wallet and test with a real contract address

## Troubleshooting

**Frontend won't connect to backend:**
- Ensure backend is running on port 3000
- Check Vite proxy configuration in `vite.config.ts`

**WalletConnect not working:**
- Verify `VITE_WALLETCONNECT_PROJECT_ID` is set in `.env`
- Make sure the project ID is valid and active

**Payment signing fails:**
- Ensure wallet has USDC on Celo Sepolia
- Check that wallet is on Celo Sepolia network
- Verify backend payment requirements match x402 SDK expectations
