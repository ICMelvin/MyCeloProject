# FalconGuard Scan-Agent 🛡️

**x402-Metered Smart Contract Security Scanner for Celo**

FalconGuard Scan-Agent is an autonomous security auditing agent built for the Celo Agentic Payments & DeFAI Hackathon (August 2026). It combines Slither static analysis and custom vulnerability rule engines behind an HTTP-native x402 payment gate, exposed via REST API and Model Context Protocol (MCP) server endpoints.

---

## 🚀 Key Features

1. **x402 Micropayment Metering**: Metered payment per scan using Celo stablecoins (USDC / USDT / USDm) via EIP-3009 transfer authorizations settled through `x402.celo.org`.
2. **Hybrid Audit Engine**: Runs Python-based Slither static analysis sandboxed alongside regex/AST rules for reentrancy, access control, delegatecall misuse, and unchecked calls.
3. **MCP Tool Integration**: Full Model Context Protocol spec compatibility for autonomous agent-to-agent discovery and execution.
4. **Autonomous Client Agent**: Includes a background queue worker for automated security monitoring and transaction volume generation.

---

## 🛠️ Project Structure

```
falconguard-scan-agent/
├── src/
│   ├── server.ts              # Express HTTP app & scan endpoint
│   ├── scanner/
│   │   ├── slitherRunner.ts   # Sandboxed Slither subprocess executor
│   │   ├── customChecks.ts    # Vulnerability pattern matching engine
│   │   └── reportBuilder.ts   # FalconGuard report formatting & severity tagging
│   ├── mcp/
│   │   └── mcpServer.ts       # MCP server tool wrapper
│   ├── payments/
│   │   └── x402Config.ts      # x402 payment configuration
│   ├── client-agent/
│   │   └── autoScanner.ts     # Autonomous batch scanning client agent
│   └── frontend/              # React web UI (optional)
│       ├── src/
│       │   ├── components/    # React components
│       │   ├── config/        # Chain & wagmi config
│       │   └── App.tsx        # Main app
│       └── package.json
├── test-contracts/            # Sample vulnerable Solidity contracts
├── .env.example
├── package.json
└── README.md
```

---

## 🏁 Quickstart

### 1. Build TypeScript
```bash
npm run build
```

### 2. Run REST Server
```bash
npm run dev
```

### 3. Run MCP Server
```bash
npm run mcp
```

### 4. Run Autonomous Client Agent
```bash
npm run client-agent
```

### 5. Run Web Frontend (Optional)
```bash
# First, configure WalletConnect Project ID in src/frontend/.env
# Then start the frontend
npm run frontend:dev
```

See [FRONTEND_SETUP.md](FRONTEND_SETUP.md) for detailed frontend setup instructions.

---

## 🌐 Network & Configuration

- **Default Network**: Celo Sepolia Testnet (Chain ID `11142220`)
- **Mainnet Support**: Celo Mainnet (Chain ID `42220`)
- **Facilitator**: `https://x402.celo.org` (mainnet) or `https://api.x402.sepolia.celo.org` (testnet)
- **Price per Scan**: `$0.10` (metered in Celo stablecoins)

### Switching Networks

**Backend (.env):**
```bash
# For Celo Sepolia Testnet
NETWORK=celoSepolia
RPC_URL=https://forno.celo-sepolia.celo-testnet.org

# For Celo Mainnet
NETWORK=celo
RPC_URL=https://forno.celo.org
```

**Frontend (src/frontend/.env):**
```bash
# For Celo Sepolia Testnet
VITE_NETWORK=testnet

# For Celo Mainnet
VITE_NETWORK=mainnet
```

The frontend and backend must be configured for the same network to work correctly.

---

## ⚖️ Hackathon Pitch Summary (Celo Agentic Payments & DeFAI)

FalconGuard Scan-Agent directly targets the **Most Revenue Generated** and **Most x402 Payments** tracks by turning every automated security audit into an on-chain, settled microtransaction on Celo.

---

## ✅ Project Status

### Completed Features

- ✅ **x402 v2 Integration**: Full payment protocol implementation with EIP-3009 authorizations
- ✅ **Slither Static Analysis**: Python-based static analysis engine integration
- ✅ **Custom Vulnerability Rules**: 12 custom security checks (reentrancy, delegatecall, timestamp, gas limits, etc.)
- ✅ **MCP Server**: Model Context Protocol compatibility for agent discovery
- ✅ **Autonomous Client Agent**: Background queue worker for automated scanning
- ✅ **Real Contract Scanning**: Support for Celo Sepolia ecosystem contracts
- ✅ **Markdown Reports**: Beautiful formatted reports with risk scoring
- ✅ **Transaction Logging**: On-chain transaction tracking with explorer links
- ✅ **API Documentation**: Comprehensive API reference (see API.md)
- ✅ **Web Frontend**: React UI with wallet connection and x402 payments

### Test Results

- ✅ **End-to-End Paid Scans**: Successfully tested with USDC payments on Celo Sepolia
- ✅ **Local Contracts**: 5 test contracts covering various vulnerability patterns
- ✅ **Real Ecosystem Contracts**: USDC and other Celo Sepolia contracts scanned successfully
- ✅ **Payment Flow**: x402 v2 facilitator integration working correctly

### Vulnerability Detection

| Category | Rules Implemented |
|----------|-------------------|
| Reentrancy | 2 rules (low-level calls, patterns) |
| Access Control | 3 rules (tx.origin, centralization, hardcoded addresses) |
| Delegatecall | 1 rule (unsafe delegatecall) |
| Unchecked Calls | 1 rule (return value verification) |
| Timestamp Manipulation | 1 rule (block.timestamp usage) |
| Gas Issues | 1 rule (loop over dynamic arrays) |
| Storage Issues | 1 rule (uninitialized pointers) |
| Pragma Issues | 1 rule (floating pragma) |
| Event Logging | 1 rule (missing events) |
| Selfdestruct | 1 rule (deprecated pattern) |

---

## 📊 Usage Statistics

- **Total Test Contracts**: 5 local + 1 real Celo Sepolia
- **Vulnerability Rules**: 12 custom rules + Slither defaults
- **Scan Duration**: ~2-3 seconds per contract
- **Payment Cost**: $0.01 USDC per scan
- **Risk Scoring**: 0-100 composite score based on severity weights

---

## 🔧 Configuration

### Environment Variables

```env
# Network
NETWORK=celo-sepolia
START_SERVER=true

# x402 Payment
X402_API_KEY=your_api_key
PAYTO_ADDRESS=0x41dbdBBB116C5eFb9c0290b9A4A61502361b5bB9
FACILITATOR_URL=https://x402.celo.org
PRICE_PER_SCAN=$0.01

# Client Agent
CLIENT_AGENT_PRIVATE_KEY=your_private_key
```

### Supported Networks

- **Celo Sepolia**: `eip155:11142220` (default)
- **USDC Address**: `0x01C5C0122039549AD1493B8220cABEdD739BC44E` (can be overridden via `USDC_ADDRESS` env var)
- **Celo Mainnet**: `eip155:42220` (set `NETWORK=celo-mainnet`)
- **USDC Address**: `0xcEBA9300f2b948710d2653dD7B07f33A8B32118C`

---

## 📚 Documentation

- **API Reference**: See [API.md](API.md) for detailed endpoint documentation
- **Client Integration**: TypeScript and cURL examples included
- **Payment Flow**: x402 v2 protocol implementation details

---

## 🎯 Next Steps

1. **Production Deployment**: Deploy to Celo Mainnet
2. **More Vulnerability Rules**: Expand custom rule set
3. **UI Dashboard**: Web interface for scan results
4. **Batch Processing**: Enhanced queue management
5. **Multi-Chain Support**: Extend to other EVM chains

---

## 📄 License

MIT License

---

## 👥 Team

Built for Celo Agentic Payments & DeFAI Hackathon (August 2026)
