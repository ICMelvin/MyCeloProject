/**
 * FalconGuard MCP Server
 *
 * Exposes the FalconGuard smart contract scanner as MCP tools so other
 * AI agents can discover and call it via the Model Context Protocol.
 *
 * Tools:
 *  - scan_smart_contract  : Runs full Slither + custom analysis on Solidity code
 *  - get_scan_info        : Returns pricing, network, and attribution tag info
 *
 * Transport: stdio (compatible with Claude Desktop, Cursor, Cline, etc.)
 * MCP SDK  : @modelcontextprotocol/sdk
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { executeScan } from '../server.js';
import { X402_CONFIG } from '../payments/x402Config.js';

// ─── MCP Server Instance ──────────────────────────────────────────────────────
const mcpServer = new Server(
  {
    name: 'falconguard-scan-agent',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

// ─── Tool Registry ────────────────────────────────────────────────────────────
mcpServer.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'scan_smart_contract',
      description:
        'Runs static security analysis (Slither + FalconGuard custom rules) on a ' +
        'Solidity smart contract. Detects reentrancy, delegatecall misuse, unchecked ' +
        'returns, tx.origin auth, selfdestruct, and more. Returns a structured JSON ' +
        'vulnerability report with severity levels and remediation notes.\n\n' +
        'This tool is metered via x402 on Celo Sepolia — each call costs ' +
        `${X402_CONFIG.pricePerScan} USDC. Attribution tag: ${X402_CONFIG.attributionTag}`,
      inputSchema: {
        type: 'object' as const,
        properties: {
          contractPath: {
            type: 'string',
            description:
              'Local file path to a .sol smart contract file. Use this for files on disk.',
          },
          sourceCode: {
            type: 'string',
            description:
              'Raw Solidity source code string. Use this to scan code inline without a file.',
          },
        },
        // At least one of contractPath or sourceCode must be provided
      },
    },
    {
      name: 'get_scan_info',
      description:
        'Returns FalconGuard Scan-Agent service information: current pricing, ' +
        'network, payment facilitator URL, and ERC-8021 attribution tag. ' +
        'Use this before calling scan_smart_contract to understand cost and config.',
      inputSchema: {
        type: 'object' as const,
        properties: {},
      },
    },
  ],
}));

// ─── Tool Handlers ────────────────────────────────────────────────────────────
mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  // ── Tool: get_scan_info ────────────────────────────────────────────────────
  if (name === 'get_scan_info') {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              service: 'FalconGuard Scan-Agent',
              version: '1.0.0',
              description:
                'x402-metered smart contract security scanner on Celo. ' +
                'Combines Slither static analysis with custom vulnerability rules.',
              pricing: {
                pricePerScan: X402_CONFIG.pricePerScan,
                asset: 'USDC',
                network: X402_CONFIG.network,
                facilitator: X402_CONFIG.facilitatorUrl,
              },
              attribution: {
                erc8021Tag: X402_CONFIG.attributionTag,
                dataSuffix: X402_CONFIG.dataSuffix,
              },
              capabilities: [
                'Reentrancy detection',
                'Unsafe delegatecall detection',
                'Unchecked return values',
                'tx.origin authentication misuse',
                'Selfdestruct / suicide usage',
                'Full Slither detector suite',
              ],
            },
            null,
            2,
          ),
        },
      ],
    };
  }

  // ── Tool: scan_smart_contract ──────────────────────────────────────────────
  if (name === 'scan_smart_contract') {
    const { contractPath, sourceCode } = (args as any) || {};

    if (!contractPath && !sourceCode) {
      return {
        content: [
          {
            type: 'text',
            text: 'Error: Provide either contractPath (local .sol file path) or sourceCode (raw Solidity string).',
          },
        ],
        isError: true,
      };
    }

    // ── Security: contractPath must be a valid 0x address only ────────────────
    // Reject any non-address contractPath to prevent path traversal attacks
    if (contractPath && !/^0x[a-fA-F0-9]{40}$/.test(contractPath)) {
      return {
        content: [
          {
            type: 'text',
            text: 'Error: contractPath must be a valid 42-character hex address (0x...). For scanning local files, use the sourceCode parameter instead.',
          },
        ],
        isError: true,
      };
    }

    try {
      const isCode = Boolean(sourceCode);
      const target = (sourceCode || contractPath) as string;
      const report = await executeScan(target, isCode);

      // Return compact summary + full JSON
      const summaryLines = [
        `## FalconGuard Scan Report`,
        `**Scan ID:** ${report.scanId}`,
        `**Target:** ${report.target}`,
        `**Duration:** ${report.scanDurationMs}ms`,
        `**Slither:** ${report.metadata.slitherRan ? '✅ ran' : '⚠️ not available'}`,
        ``,
        `### Summary`,
        `- Total Findings: ${report.summary.totalFindings}`,
        `- 🔴 Critical: ${report.summary.critical}`,
        `- 🟠 High: ${report.summary.high}`,
        `- 🟡 Medium: ${report.summary.medium}`,
        `- 🟢 Low: ${report.summary.low}`,
        `- ℹ️  Informational: ${report.summary.informational}`,
        ``,
        `### Findings`,
      ];

      for (const finding of report.findings) {
        summaryLines.push(
          `- **[${finding.severity}] ${finding.title}** (${finding.category})` +
            (finding.location ? ` — Line ${finding.location.line ?? '?'}` : ''),
        );
        summaryLines.push(`  > ${finding.description}`);
        summaryLines.push(`  💡 *${finding.remediation}*`);
        summaryLines.push('');
      }

      if (report.findings.length === 0) {
        summaryLines.push('✅ No vulnerabilities detected by automated checks.');
      }

      summaryLines.push('---');
      summaryLines.push('```json');
      summaryLines.push(JSON.stringify(report, null, 2));
      summaryLines.push('```');

      return {
        content: [{ type: 'text', text: summaryLines.join('\n') }],
      };
    } catch (err: any) {
      return {
        content: [{ type: 'text', text: `❌ Scan execution failed: ${err.message}` }],
        isError: true,
      };
    }
  }

  throw new Error(`Unknown tool: ${name}`);
});

// ─── Bootstrap ────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await mcpServer.connect(transport);
  console.error('[FalconGuard MCP] Server running on stdio transport');
  console.error(`[FalconGuard MCP] Tools: scan_smart_contract, get_scan_info`);
  console.error(`[FalconGuard MCP] Attribution: ${X402_CONFIG.attributionTag}`);
}

main().catch((err) => {
  console.error('[FalconGuard MCP] Fatal error:', err);
  process.exit(1);
});
