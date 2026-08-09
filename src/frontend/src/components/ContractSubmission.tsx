import { useState } from 'react';
import { useAccount, useSignTypedData } from 'wagmi';
import { x402HTTPClient, x402Client } from '@x402/core/client';
import { registerExactEvmScheme } from '@x402/evm/exact/client';
import { API_URL } from '../config/api';

interface ContractSubmissionProps {
  onScanStart: () => void;
  onScanComplete: (result: any) => void;
  isScanning: boolean;
}

type SubmissionMode = 'address' | 'file';

export default function ContractSubmission({ 
  onScanStart, 
  onScanComplete, 
  isScanning 
}: ContractSubmissionProps) {
  const { isConnected, address: walletAddress } = useAccount();
  const [mode, setMode] = useState<SubmissionMode>('address');
  const [address, setAddress] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const { signTypedDataAsync } = useSignTypedData();

  const validateAddress = (addr: string): boolean => {
    return /^0x[a-fA-F0-9]{40}$/.test(addr);
  };

  const handleAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAddress(e.target.value);
    setError('');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && !selectedFile.name.endsWith('.sol')) {
      setError('Please upload a .sol file');
      setFile(null);
      return;
    }
    setFile(selectedFile || null);
    setError('');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && !droppedFile.name.endsWith('.sol')) {
      setError('Please upload a .sol file');
      return;
    }
    setFile(droppedFile || null);
    setError('');
  };

  const handleSubmit = async () => {
    // Guard: Ensure wallet is actually connected with a valid address
    if (!isConnected || !walletAddress) {
      setError('Please connect your wallet first');
      return;
    }

    if (mode === 'address') {
      if (!address.trim()) {
        setError('Please enter a contract address');
        return;
      }
      if (!validateAddress(address)) {
        setError('Invalid contract address format');
        return;
      }
    } else {
      if (!file) {
        setError('Please upload a .sol file');
        return;
      }
    }

    setError('');
    onScanStart();

    try {
      // Prepare request body
      let requestBody: any;
      if (mode === 'address') {
        requestBody = { contractPath: address };
      } else {
        if (!file) {
          onScanComplete({ error: 'No file selected' });
          return;
        }
        const fileContent = await file.text();
        requestBody = { sourceCode: fileContent };
      }

      // Step 1: Initial request - expect 402
      const initialRes = await fetch(`${API_URL}/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (initialRes.status !== 402) {
        if (initialRes.ok) {
          const report = await initialRes.json();
          onScanComplete({
            scanId: report.scanId,
            summary: report.summary || { totalFindings: 0, critical: 0, high: 0, medium: 0, low: 0 },
          });
        } else {
          // Parse the error response from server (e.g. EOA detection, invalid format)
          try {
            const errJson = await initialRes.json();
            const message = errJson?.error || 'Scan failed. Please try again.';
            const hint = errJson?.hint ? ` ${errJson.hint}` : '';
            onScanComplete({ error: message + hint });
          } catch {
            onScanComplete({ error: 'Scan failed. Please try again.' });
          }
        }
        return;
      }

      // Step 2: Create x402 client and parse payment requirements
      // NOTE: Let the x402 library handle header decoding - don't manually decode
      const client = new x402Client();
      registerExactEvmScheme(client, {
        signer: {
          address: walletAddress,
          signTypedData: async (msg: { domain: any; types: any; primaryType: string; message: any }) => {
            return await signTypedDataAsync({
              domain: msg.domain,
              types: msg.types,
              primaryType: msg.primaryType,
              message: msg.message,
            });
          },
        } as any,
      });

      const httpClient = new x402HTTPClient(client);
      const paymentRequired = httpClient.getPaymentRequiredResponse(
        (name: string) => initialRes.headers.get(name),
        undefined,  // Let library handle header decoding, don't pass body
      );
      
      // Step 3: Create payment payload
      const paymentPayload = await httpClient.createPaymentPayload(paymentRequired);
      const paymentHeaders = httpClient.encodePaymentSignatureHeader(paymentPayload);

      // Step 4: Retry with payment
      const paidRes = await fetch(`${API_URL}/scan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...paymentHeaders,
        },
        body: JSON.stringify(requestBody),
      });

      const responseText = await paidRes.text();

      // Step 5: Process payment result
      try {
        const result = await httpClient.processPaymentResult(
          paymentPayload,
          (name) => paidRes.headers.get(name),
          paidRes.status,
        );

        if (paidRes.ok) {
          const report = JSON.parse(responseText);
          onScanComplete({
            ...report,
            txHash: result.settleResponse?.transaction || report.txHash,
          });
        } else {
          // Handle server error responses (e.g., 400 for non-contract addresses)
          try {
            const errorData = JSON.parse(responseText);
            onScanComplete({ 
              error: errorData.error || errorData.hint || 'Payment failed. Please try again.' 
            });
          } catch {
            onScanComplete({ error: 'Payment failed. Please try again.' });
          }
        }
      } catch (processErr: any) {
        console.error('Payment processing error:', processErr);
        onScanComplete({ error: 'Payment processing failed: ' + processErr?.message });
      }
    } catch (err: any) {
      console.error('Scan error:', err);
      onScanComplete({ error: 'An error occurred. Please try again.' });
    }
  };

  return (
    <div className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-color)] p-6">
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => { setMode('address'); setFile(null); setError(''); }}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            mode === 'address'
              ? 'bg-primary-500 text-white'
              : 'bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:bg-[var(--border-color)]'
          }`}
        >
          Contract Address
        </button>
        <button
          onClick={() => { setMode('file'); setAddress(''); setError(''); }}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            mode === 'file'
              ? 'bg-primary-500 text-white'
              : 'bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:bg-[var(--border-color)]'
          }`}
        >
          Upload File
        </button>
      </div>

      {mode === 'address' ? (
        <div>
          <label className="block text-sm font-medium mb-2">
            Contract Address
          </label>
          <input
            type="text"
            value={address}
            onChange={handleAddressChange}
            placeholder="0x..."
            className="w-full px-4 py-3 rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-primary-500"
            disabled={isScanning}
          />
          <p className="text-xs text-[var(--text-secondary)] mt-2">
            Enter a deployed contract address on Celo
          </p>
        </div>
      ) : (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          className="border-2 border-dashed border-[var(--border-color)] rounded-lg p-8 text-center hover:border-primary-500 transition-colors"
        >
          <input
            type="file"
            accept=".sol"
            onChange={handleFileChange}
            className="hidden"
            id="file-upload"
            disabled={isScanning}
          />
          <label
            htmlFor="file-upload"
            className="cursor-pointer"
          >
            <div className="text-[var(--text-secondary)]">
              {file ? (
                <div>
                  <svg className="w-12 h-12 mx-auto mb-4 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="font-medium">{file.name}</p>
                  <p className="text-sm mt-1">Click to change file</p>
                </div>
              ) : (
                <div>
                  <svg className="w-12 h-12 mx-auto mb-4 text-[var(--text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <p className="font-medium">Drop your .sol file here</p>
                  <p className="text-sm mt-1">or click to browse</p>
                </div>
              )}
            </div>
          </label>
        </div>
      )}

      {error && (
        <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={isScanning || !isConnected || !walletAddress}
        className="mt-6 w-full px-4 py-3 bg-primary-500 text-white rounded-lg font-medium hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isScanning ? 'Scanning...' : 'Scan Contract'}
      </button>

      {(!isConnected || !walletAddress) && (
        <p className="text-center text-sm text-[var(--text-secondary)] mt-3">
          Connect your wallet to scan
        </p>
      )}
    </div>
  );
}
