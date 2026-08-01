import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { executeScan } from '../server.js';

const mcpServer = new Server(
  {
    name: 'falconguard-scan-agent',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'scan_smart_contract',
        description:
          'Runs static analysis (Slither + FalconGuard rules) on Solidity smart contract source code or file path and returns a structured vulnerability report.',
        inputSchema: {
          type: 'object',
          properties: {
            contractPath: {
              type: 'string',
              description: 'Local file path to the .sol smart contract file to scan',
            },
            sourceCode: {
              type: 'string',
              description: 'Raw Solidity source code string to scan directly',
            },
          },
        },
      },
    ],
  };
});

mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === 'scan_smart_contract') {
    const { contractPath, sourceCode } = (request.params.arguments as any) || {};

    if (!contractPath && !sourceCode) {
      return {
        content: [{ type: 'text', text: 'Error: Must provide contractPath or sourceCode argument' }],
        isError: true,
      };
    }

    try {
      const isCode = Boolean(sourceCode);
      const target = sourceCode || contractPath;
      const report = await executeScan(target, isCode);

      return {
        content: [{ type: 'text', text: JSON.stringify(report, null, 2) }],
      };
    } catch (err: any) {
      return {
        content: [{ type: 'text', text: `Scan execution failed: ${err.message}` }],
        isError: true,
      };
    }
  }

  throw new Error(`Tool not found: ${request.params.name}`);
});

async function main() {
  const transport = new StdioServerTransport();
  await mcpServer.connect(transport);
  console.error('[FalconGuard MCP Server] Running on stdio transport');
}

main().catch((err) => {
  console.error('[FalconGuard MCP Server] Fatal error:', err);
  process.exit(1);
});
