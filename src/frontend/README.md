# FalconGuard Frontend

React-based web UI for the FalconGuard smart contract security scanner.

## Setup

1. Install dependencies:
```bash
cd src/frontend
npm install
```

2. Configure environment variables:
```bash
cp .env.example .env
```

Edit `.env` and add your WalletConnect Project ID:
```
VITE_WALLETCONNECT_PROJECT_ID=your_project_id_here
```

Get your project ID from [WalletConnect Cloud](https://cloud.walletconnect.com).

## Running

Start the frontend development server:
```bash
npm run dev
```

The frontend will run on `http://localhost:5173` and proxy requests to the backend at `http://localhost:3000`.

Make sure the backend server is running:
```bash
# From the project root
npm run dev
```

## Building for Production

```bash
npm run build
```

The built files will be in the `dist/` directory.

## Features

- **Wallet Connection**: RainbowKit integration with MetaMask and WalletConnect
- **Contract Submission**: Support for both contract addresses and .sol file uploads
- **x402 Payments**: Client-side EIP-3009 signing for gasless USDC payments
- **Results Display**: Clear scan results with severity breakdown and transaction links
- **Dark Mode**: Toggle between light and dark themes

## Architecture

- **React 18** with TypeScript
- **Vite** for fast development and building
- **Wagmi** for wallet connection and blockchain interactions
- **RainbowKit** for wallet UI
- **TailwindCSS** for styling
- **x402 SDK** for payment handling

## Security Notes

- No hardcoded test contract addresses or files are included
- All contract inputs come from user input at runtime
- WalletConnect Project ID is configured via environment variable
- Chain configuration matches the backend's x402Config.ts
