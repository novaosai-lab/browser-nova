import fs from 'fs';
import path from 'path';
import { RunReport } from '../shared/types';

export class EvidenceCollector {
  private reportsDir: string;

  constructor(baseDir: string) {
    this.reportsDir = path.join(baseDir, 'reports');
    if (!fs.existsSync(this.reportsDir)) {
      fs.mkdirSync(this.reportsDir, { recursive: true });
    }
  }

  public saveReport(report: RunReport): string {
    const fileName = `run_${report.runId}_${Date.now()}.json`;
    const filePath = path.join(this.reportsDir, fileName);

    // Redact sensitive headers/cookies/passwords
    const sanitized = this.sanitizeReport(report);
    fs.writeFileSync(filePath, JSON.stringify(sanitized, null, 2), 'utf-8');
    return filePath;
  }

  public getReports(): RunReport[] {
    if (!fs.existsSync(this.reportsDir)) return [];
    const files = fs.readdirSync(this.reportsDir).filter((f) => f.endsWith('.json'));
    const reports: RunReport[] = [];

    for (const f of files) {
      try {
        const content = fs.readFileSync(path.join(this.reportsDir, f), 'utf-8');
        reports.push(JSON.parse(content));
      } catch {
        // Ignore malformed files
      }
    }

    return reports.sort((a, b) => b.startedAt - a.startedAt);
  }

  private sanitizeReport(report: RunReport): RunReport {
    const str = JSON.stringify(report);
    // Mask password, auth token, cookie values
    const masked = str.replace(
      /("password"|"token"|"secret"|"authorization"|"apiKey"):\s*"[^"]+"/gi,
      '$1: "[REDACTED]"'
    );
    return JSON.parse(masked);
  }
}
