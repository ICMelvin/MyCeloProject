#!/bin/bash
# Test script to verify path traversal vulnerability is fixed
# This should return 400 error, not file contents

echo "Testing path traversal vulnerability fix..."
echo ""

# Test 1: Relative path traversal (../../.env)
echo "Test 1: Relative path traversal (../../.env)"
RESPONSE=$(curl -s -X POST http://localhost:3000/scan \
  -H "Content-Type: application/json" \
  -d '{"contractPath":"../../.env"}' \
  -w "\nHTTP_STATUS:%{http_code}")
echo "$RESPONSE"
echo ""

# Test 2: Absolute path (/app/.env)
echo "Test 2: Absolute path (/app/.env)"
RESPONSE=$(curl -s -X POST http://localhost:3000/scan \
  -H "Content-Type: application/json" \
  -d '{"contractPath":"/app/.env"}' \
  -w "\nHTTP_STATUS:%{http_code}")
echo "$RESPONSE"
echo ""

# Test 3: Deep relative path traversal (../../../../etc/passwd)
echo "Test 3: Deep relative path traversal (../../../../etc/passwd)"
RESPONSE=$(curl -s -X POST http://localhost:3000/scan \
  -H "Content-Type: application/json" \
  -d '{"contractPath":"../../../../etc/passwd"}' \
  -w "\nHTTP_STATUS:%{http_code}")
echo "$RESPONSE"
echo ""

# Test 4: Valid 0x address (should pass validation but fail bytecode check)
echo "Test 4: Valid 0x address format (should pass format validation)"
RESPONSE=$(curl -s -X POST http://localhost:3000/scan \
  -H "Content-Type: application/json" \
  -d '{"contractPath":"0x1234567890123456789012345678901234567890"}' \
  -w "\nHTTP_STATUS:%{http_code}")
echo "$RESPONSE"
echo ""

# Test 5: Valid sourceCode (should work)
echo "Test 5: Valid sourceCode (should work)"
RESPONSE=$(curl -s -X POST http://localhost:3000/scan \
  -H "Content-Type: application/json" \
  -d '{"sourceCode":"// SPDX-License-Identifier: MIT\npragma solidity ^0.8.0;\ncontract Test {}"}' \
  -w "\nHTTP_STATUS:%{http_code}")
echo "$RESPONSE"
echo ""

echo "Test complete. Expected results:"
echo "  - Test 1, 2, 3: HTTP 400 (Invalid contract path format)"
echo "  - Test 4: HTTP 400 (Address is not a smart contract)"
echo "  - Test 5: HTTP 200 (Scan successful)"
