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
  });

  return findings;
}
