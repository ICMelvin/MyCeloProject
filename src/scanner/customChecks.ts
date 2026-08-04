import { SecurityFinding } from './reportBuilder.js';

export function runCustomChecks(sourceCode: string, fileName: string = 'Contract.sol'): SecurityFinding[] {
  const findings: SecurityFinding[] = [];
  const lines = sourceCode.split('\n');

  lines.forEach((line, index) => {
    const lineNumber = index + 1;

    // 1. Reentrancy: call.value / call{value:} before state modification check
    if (/call\s*\{?\s*value\s*:/.test(line) || /\.call\.value/.test(line)) {
      findings.push({
        id: `FG-CUSTOM-REENT-01`,
        title: 'Potential Reentrancy Pattern (Low-level Call with Value)',
        severity: 'HIGH',
        category: 'REENTRANCY',
        description: `Low-level external call sending ether/tokens detected. Ensure state variables are updated prior to execution (Checks-Effects-Interactions pattern) or reentrancy guard is applied.`,
        location: { file: fileName, line: lineNumber },
        remediation: 'Apply OpenZeppelin ReentrancyGuard and strictly adhere to Checks-Effects-Interactions pattern.',
      });
    }

    // 2. Delegatecall misuse
    if (/delegatecall\s*\(/.test(line)) {
      findings.push({
        id: `FG-CUSTOM-DEL-01`,
        title: 'Use of Unsafe Delegatecall',
        severity: 'CRITICAL',
        category: 'DELEGATECALL',
        description: `Delegatecall preserves caller context and execution state. Untrusted target parameter allows arbitrary code execution in contract context.`,
        location: { file: fileName, line: lineNumber },
        remediation: 'Ensure delegatecall target is immutable, hardcoded, or restricted via strict access control controls.',
      });
    }

    // 3. Unchecked return value of external call
    if (/\.call\(/.test(line) && !line.includes('require') && !line.includes('bool success') && !line.includes('if')) {
      findings.push({
        id: `FG-CUSTOM-UNCHECKED-01`,
        title: 'Unchecked Return Value of External Call',
        severity: 'MEDIUM',
        category: 'UNCHECKED_CALL',
        description: `Return value of low-level .call() is not verified for success.`,
        location: { file: fileName, line: lineNumber },
        remediation: 'Store boolean success status (e.g. (bool success, ) = target.call(...)) and require success.',
      });
    }

    // 4. Missing or loose Access Control (tx.origin usage)
    if (/tx\.origin/.test(line)) {
      findings.push({
        id: `FG-CUSTOM-AUTH-01`,
        title: 'Use of tx.origin for Authentication',
        severity: 'HIGH',
        category: 'ACCESS_CONTROL',
        description: `Authentication using tx.origin is vulnerable to phishing attacks via contract proxies.`,
        location: { file: fileName, line: lineNumber },
        remediation: 'Use msg.sender instead of tx.origin for access control checks.',
      });
    }

    // 5. Selfdestruct usage
    if (/selfdestruct\s*\(/.test(line) || /suicide\s*\(/.test(line)) {
      findings.push({
        id: `FG-CUSTOM-SELF-01`,
        title: 'Use of Selfdestruct / Suicide',
        severity: 'HIGH',
        category: 'ACCESS_CONTROL',
        description: `Selfdestruct can result in contract code erasure and total asset lock if misconfigured.`,
        location: { file: fileName, line: lineNumber },
        remediation: 'Avoid selfdestruct in modern Solidity (deprecated in EIP-6049). Use pause / vault migration patterns.',
      });
    }

    // 6. Timestamp manipulation
    if (/block\.timestamp/.test(line) || /now\s*\(/.test(line)) {
      findings.push({
        id: `FG-CUSTOM-TIMESTAMP-01`,
        title: 'Use of Block Timestamp',
        severity: 'MEDIUM',
        category: 'OTHER',
        description: `Block timestamp can be manipulated by miners within ~15 seconds. Critical time-sensitive logic should use block number or external oracle.`,
        location: { file: fileName, line: lineNumber },
        remediation: 'Use block.number for approximate timing or integrate with decentralized oracle (Chainlink) for precise time.',
      });
    }

    // 7. Floating pragma
    if (/pragma\s+solidity\s+\^/.test(line)) {
      findings.push({
        id: `FG-CUSTOM-PRAGMA-01`,
        title: 'Floating Pragma Directive',
        severity: 'LOW',
        category: 'OTHER',
        description: `Using floating pragma (^0.x.x) allows compilation with different compiler versions, potentially introducing bugs.`,
        location: { file: fileName, line: lineNumber },
        remediation: 'Lock pragma to specific version (e.g., pragma solidity 0.8.19) for production contracts.',
      });
    }

    // 8. Uninitialized storage pointer
    if (/mapping\s*\([^)]+\)\s+public\s+\w+\s*;/.test(line) && !line.includes('=')) {
      findings.push({
        id: `FG-CUSTOM-STORAGE-01`,
        title: 'Potential Uninitialized Storage Pointer',
        severity: 'HIGH',
        category: 'OTHER',
        description: `Storage variables without explicit initialization may default to slot 0, potentially overwriting critical contract state.`,
        location: { file: fileName, line: lineNumber },
        remediation: 'Explicitly initialize storage variables or ensure proper slot assignment.',
      });
    }

    // 9. Gas limit issues in loops
    if (/for\s*\([^)]*\)\s*\{/.test(line) || /while\s*\([^)]*\)\s*\{/.test(line)) {
      // Check if loop might iterate over dynamic arrays
      if (line.includes('.length') || line.includes('push') || line.includes('pop')) {
        findings.push({
          id: `FG-CUSTOM-GAS-01`,
          title: 'Potential Gas Limit Issue in Loop',
          severity: 'MEDIUM',
          category: 'DENIAL_OF_SERVICE',
          description: `Loop over dynamic array may exceed block gas limit if array grows too large. Consider pagination or off-chain processing.`,
          location: { file: fileName, line: lineNumber },
          remediation: 'Use pagination (e.g., process 100 items per transaction) or move heavy computation off-chain.',
        });
      }
    }

    // 10. Hardcoded sensitive values
    if (/0x[a-fA-F0-9]{40}/.test(line) && (line.includes('private') || line.includes('address'))) {
      findings.push({
        id: `FG-CUSTOM-HARDCODE-01`,
        title: 'Hardcoded Sensitive Address',
        severity: 'MEDIUM',
        category: 'ACCESS_CONTROL',
        description: `Hardcoded addresses reduce flexibility and may contain sensitive data (private keys, admin addresses).`,
        location: { file: fileName, line: lineNumber },
        remediation: 'Use constructor parameters or environment variables for sensitive addresses. Consider using immutable variables.',
      });
    }

    // 11. Missing events for state changes
    if (/function\s+\w+\s*\([^)]*\)\s+public\s+payable/.test(line) && !sourceCode.substring(index, index + 500).includes('emit')) {
      findings.push({
        id: `FG-CUSTOM-EVENT-01`,
        title: 'Missing Event for State Change',
        severity: 'LOW',
        category: 'OTHER',
        description: `Payable function without event emission makes off-chain monitoring difficult and reduces transparency.`,
        location: { file: fileName, line: lineNumber },
        remediation: 'Emit events for all state-changing functions, especially those involving value transfers.',
      });
    }

    // 12. Centralization risk (single owner)
    if (/onlyOwner/.test(line) || /onlyAdmin/.test(line)) {
      findings.push({
        id: `FG-CUSTOM-CENTRAL-01`,
        title: 'Centralization Risk Detected',
        severity: 'MEDIUM',
        category: 'ACCESS_CONTROL',
        description: `Single owner/admin control creates centralization risk. Compromise of private key could result in total loss.`,
        location: { file: fileName, line: lineNumber },
        remediation: 'Consider multi-sig governance, time locks, or DAO governance for critical functions.',
      });
    }
  });

  return findings;
}
