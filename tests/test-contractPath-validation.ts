import { isValidContractAddress } from '../src/server.js';

console.log('Running contract address validation unit tests...\n');

const tests = [
  { input: '../../.env', expected: false, description: 'Relative path traversal (../../.env)' },
  { input: '/app/.env', expected: false, description: 'Absolute path (/app/.env)' },
  { input: '../../../../etc/passwd', expected: false, description: 'Deep relative path traversal (../../../../etc/passwd)' },
  { input: '0x1234567890123456789012345678901234567890', expected: true, description: 'Valid 0x address' },
  { input: '0xnothex', expected: false, description: 'Invalid hex string (0xnothex)' },
  { input: '', expected: false, description: 'Empty string' },
  { input: '0x123456789012345678901234567890123456789', expected: false, description: 'Too short (39 chars)' },
  { input: '0x12345678901234567890123456789012345678901', expected: false, description: 'Too long (43 chars)' },
  { input: '0x123456789012345678901234567890123456789G', expected: false, description: 'Invalid character (G)' },
  { input: '1234567890123456789012345678901234567890', expected: false, description: 'Missing 0x prefix' },
  { input: null as any, expected: false, description: 'null input' },
  { input: undefined as any, expected: false, description: 'undefined input' },
];

let passed = 0;
let failed = 0;

for (const test of tests) {
  const result = isValidContractAddress(test.input);
  const status = result === test.expected ? 'PASS' : 'FAIL';
  
  if (status === 'PASS') {
    passed++;
    console.log(`✅ ${status}: ${test.description}`);
  } else {
    failed++;
    console.log(`❌ ${status}: ${test.description}`);
    console.log(`   Input: ${JSON.stringify(test.input)}`);
    console.log(`   Expected: ${test.expected}, Got: ${result}`);
  }
}

console.log(`\n${passed}/${tests.length} tests passed, ${failed}/${tests.length} tests failed`);

if (failed > 0) {
  process.exit(1);
}
