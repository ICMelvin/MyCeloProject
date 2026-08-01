import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { SecurityFinding } from './reportBuilder.js';

export async function runSlitherScan(
  targetPath: string,
  timeoutMs: number = 30000
): Promise<{ findings: SecurityFinding[]; slitherRan: boolean; error?: string }> {
  return new Promise((resolve) => {
    // Sanitize path to prevent shell injection / traversal risks
    const resolvedPath = path.resolve(targetPath);
    if (!fs.existsSync(resolvedPath)) {
      return resolve({
        findings: [],
        slitherRan: false,
        error: `File or directory does not exist: ${resolvedPath}`,
      });
    }

    // Spawn slither without shell execution for maximum sandboxing
    const slitherProc = spawn('slither', [resolvedPath, '--json', '-'], {
      timeout: timeoutMs,
      env: { ...process.env, PATH: process.env.PATH },
    });

    let stdoutData = '';
    let stderrData = '';

    slitherProc.stdout.on('data', (chunk) => {
      stdoutData += chunk.toString();
    });

    slitherProc.stderr.on('data', (chunk) => {
      stderrData += chunk.toString();
    });

    slitherProc.on('error', (err) => {
      resolve({
        findings: [],
        slitherRan: false,
        error: `Failed to spawn Slither subprocess: ${err.message}`,
      });
    });

    slitherProc.on('close', (code) => {
      try {
        if (!stdoutData.trim()) {
          return resolve({
            findings: [],
            slitherRan: true,
            error: stderrData || `Slither returned code ${code} with empty stdout`,
          });
        }

        const parsedJson = JSON.parse(stdoutData);
        const findings: SecurityFinding[] = [];

        if (parsedJson.results && parsedJson.results.detectors) {
          parsedJson.results.detectors.forEach((det: any, index: number) => {
            const impactToSeverityMap: Record<string, SecurityFinding['severity']> = {
              High: 'HIGH',
              Medium: 'MEDIUM',
              Low: 'LOW',
              Informational: 'INFORMATIONAL',
              Optimization: 'INFORMATIONAL',
            };

            findings.push({
              id: `SLITHER-${det.check.toUpperCase()}-${index}`,
              title: det.check,
              severity: impactToSeverityMap[det.impact] || 'MEDIUM',
              category: 'OTHER',
              description: det.description,
              location: det.elements?.[0]?.source_mapping
                ? {
                    file: det.elements[0].source_mapping.filename_relative,
                    line: det.elements[0].source_mapping.lines?.[0],
                    function: det.elements[0].name,
                  }
                : undefined,
              remediation: det.recommendation || `Review detector output for ${det.check}`,
            });
          });
        }

        resolve({ findings, slitherRan: true });
      } catch (parseError: any) {
        resolve({
          findings: [],
          slitherRan: true,
          error: `Failed to parse Slither output JSON: ${parseError.message}`,
        });
      }
    });
  });
}
