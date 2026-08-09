/**
 * Fetch verified source code from Blockscout API for Celo contracts
 */

import { getNetworkConfigFromEnv } from '../config/networkConfig.js';

export interface SourceCodeResult {
  sourceCode: string;
  contractName: string;
}

/**
 * Fetch verified source code from Blockscout Etherscan-compatible API
 * Returns null if contract is unverified or fetch fails
 */
export async function fetchVerifiedSourceCode(
  address: string
): Promise<SourceCodeResult | null> {
  const networkConfig = getNetworkConfigFromEnv();
  // Use the correct Blockscout API endpoints for Celo
  const BLOCKSCOUT_API_URL = networkConfig.networkName === 'celoMainnet'
    ? 'https://celoscan.io/api'
    : 'https://sepolia.celoscan.io/api';

  try {
    // 10-second timeout using AbortController
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(
      `${BLOCKSCOUT_API_URL}?module=contract&action=getsourcecode&address=${address}`,
      {
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`⚠️  Blockscout API returned ${response.status} for ${address}`);
      return null;
    }

    const data = await response.json();

    // Blockscout returns { status: "1", message: "OK", result: [...] }
    if (!data.result || !Array.isArray(data.result) || data.result.length === 0) {
      return null;
    }

    const contractData = data.result[0];
    const sourceCode = contractData.SourceCode;
    const contractName = contractData.ContractName || 'Contract';

    // If source code is empty or missing, contract is unverified
    if (!sourceCode || sourceCode.trim() === '') {
      return null;
    }

    // Handle multi-file JSON format (starts with '{')
    // Some verified contracts use the standard-input-JSON format with multiple files
    // For simplicity, we extract the main contract file if available, otherwise concatenate all sources
    if (sourceCode.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(sourceCode);
        
        // If it's the standard-input format, it has a 'sources' object mapping filenames to content
        if (parsed.sources && typeof parsed.sources === 'object') {
          const sourceFiles = Object.entries(parsed.sources);
          
          // Try to find a file that matches the contract name
          const mainFile = sourceFiles.find(([filename]) => 
            filename.includes(contractName) || filename.endsWith('.sol')
          );
          
          if (mainFile) {
            // Extract content from the main file (standard-input format has { content: "..." })
            const fileData = mainFile[1] as any;
            const fileContent = fileData?.content || fileData;
            return {
              sourceCode: typeof fileContent === 'string' ? fileContent : JSON.stringify(fileContent),
              contractName,
            };
          }
          
          // Fallback: concatenate all source files with separators
          const concatenated = sourceFiles
            .map(([filename, fileData]) => {
              const data = fileData as any;
              const content = data?.content || data;
              return `// File: ${filename}\n${typeof content === 'string' ? content : JSON.stringify(content)}`;
            })
            .join('\n\n');
          
          return {
            sourceCode: concatenated,
            contractName,
          };
        }
      } catch (parseError) {
        // If JSON parsing fails, treat as flat source code
        console.warn(`⚠️  Failed to parse multi-file JSON for ${address}, treating as flat source`);
      }
    }

    // Treat as single flat .sol file
    return {
      sourceCode,
      contractName,
    };
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.warn(`⚠️  Blockscout API timeout for ${address}`);
    } else {
      console.warn(`⚠️  Blockscout API fetch failed for ${address}: ${error.message}`);
    }
    return null;
  }
}
