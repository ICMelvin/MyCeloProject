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
│   └── client-agent/
│       └── autoScanner.ts     # Autonomous batch scanning client agent
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

---

## 🌐 Network & Configuration

- **Default Network**: Celo Sepolia Testnet (Chain ID `11142220`)
- **Facilitator**: `https://x402.celo.org`
- **Price per Scan**: `$0.01` (metered in Celo stablecoins)

---

## ⚖️ Hackathon Pitch Summary (Celo Agentic Payments & DeFAI)

FalconGuard Scan-Agent directly targets the **Most Revenue Generated** and **Most x402 Payments** tracks by turning every automated security audit into an on-chain, settled microtransaction on Celo.
