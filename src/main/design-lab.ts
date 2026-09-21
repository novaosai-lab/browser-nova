import fs from 'fs';
import path from 'path';
import { CdpBroker } from '../automation/cdp-broker';
import { DesignTokens, SmartCopyResult, TableExtractionResult, PageSnapshotResult } from '../shared/types';

export class DesignLabService {
  constructor(private cdp: CdpBroker, private baseDir: string) {
    if (!fs.existsSync(baseDir)) {
      fs.mkdirSync(baseDir, { recursive: true });
    }
  }

  /**
   * Smart Copy: extracts element DOM, computed styles, and produces clean React JSX snippet
   */
  public async smartCopy(selector: string): Promise<SmartCopyResult> {
    const expression = `
      (() => {
        const el = document.querySelector(${JSON.stringify(selector)});
        if (!el) throw new Error("Element not found");

        const computed = window.getComputedStyle(el);
        const styleKeys = [
          'color', 'backgroundColor', 'fontSize', 'fontFamily', 'fontWeight',
          'lineHeight', 'padding', 'margin', 'borderRadius', 'border',
          'boxShadow', 'display', 'flexDirection', 'gap', 'alignItems', 'justifyContent'
        ];

        const styles = {};
        for (const k of styleKeys) {
          styles[k] = computed[k];
        }

        // Convert HTML to simple React JSX
        const tagName = el.tagName.toLowerCase();
        const text = el.innerText || '';
        const html = el.outerHTML;

        // Generate React snippet
        const compName = tagName.charAt(0).toUpperCase() + tagName.slice(1) + 'Component';
        const reactSnippet = \`import React from 'react';

export const \${compName}: React.FC = () => {
  const styles: React.CSSProperties = {
    color: '\${styles.color}',
    backgroundColor: '\${styles.backgroundColor}',
    fontSize: '\${styles.fontSize}',
    fontFamily: '\${styles.fontFamily}',
    fontWeight: '\${styles.fontWeight}',
    padding: '\${styles.padding}',
    borderRadius: '\${styles.borderRadius}',
    border: '\${styles.border}',
    boxShadow: '\${styles.boxShadow}',
  };

  return (
    <\${tagName} style={styles}>
      \${text}
    </\${tagName}>
  );
};\`;

        return {
          selector: ${JSON.stringify(selector)},
          tagName,
          html,
          css: Object.entries(styles).map(([k, v]) => \`  \${k}: \${v};\`).join('\\n'),
          reactComponent: reactSnippet
        };
      })()
    `;

    const res = await this.cdp.sendCommand<{ result: { value: SmartCopyResult } }>('Runtime.evaluate', {
      expression,
      returnByValue: true,
    });

    return res.result.value;
  }

  /**
   * Design Tokens: extracts colors, typography, spacing, radii, shadows from live page
   */
  public async extractTokens(): Promise<DesignTokens> {
    const expression = `
      (() => {
        const elements = Array.from(document.querySelectorAll('*')).slice(0, 300);
        const colors = new Set();
        const fontFamilies = new Set();
        const fontSizes = new Set();
        const fontWeights = new Set();
        const spacing = new Set();
        const radii = new Set();
        const shadows = new Set();

        for (const el of elements) {
          const style = window.getComputedStyle(el);
          if (style.color && style.color !== 'rgba(0, 0, 0, 0)') colors.add(style.color);
          if (style.backgroundColor && style.backgroundColor !== 'rgba(0, 0, 0, 0)') colors.add(style.backgroundColor);
          if (style.fontFamily) fontFamilies.add(style.fontFamily.split(',')[0].replace(/['"]/g, '').trim());
          if (style.fontSize) fontSizes.add(style.fontSize);
          if (style.fontWeight) fontWeights.add(style.fontWeight);
          if (style.padding && style.padding !== '0px') spacing.add(style.padding);
          if (style.borderRadius && style.borderRadius !== '0px') radii.add(style.borderRadius);
          if (style.boxShadow && style.boxShadow !== 'none') shadows.add(style.boxShadow);
        }

        return {
          colors: Array.from(colors).slice(0, 20),
          typography: {
            fontFamilies: Array.from(fontFamilies).slice(0, 8),
            fontSizes: Array.from(fontSizes).slice(0, 10),
            fontWeights: Array.from(fontWeights).slice(0, 6)
          },
          spacing: Array.from(spacing).slice(0, 12),
          radii: Array.from(radii).slice(0, 8),
          shadows: Array.from(shadows).slice(0, 8)
        };
      })()
    `;

    const res = await this.cdp.sendCommand<{ result: { value: DesignTokens } }>('Runtime.evaluate', {
      expression,
      returnByValue: true,
    });

    return res.result.value;
  }

  /**
   * Table / List Extractor: extracts tables to JSON & CSV (with Thai unicode & formula protection)
   */
  public async extractTable(selector = 'table'): Promise<TableExtractionResult> {
    const expression = `
      (() => {
        const table = document.querySelector(${JSON.stringify(selector)});
        if (!table) throw new Error("Table not found: " + ${JSON.stringify(selector)});

        const headerEls = Array.from(table.querySelectorAll('th'));
        let headers = headerEls.map(th => th.innerText.trim());

        const rowsEls = Array.from(table.querySelectorAll('tbody tr, tr:not(:first-child)'));
        const rows = rowsEls.map(tr => {
          const cells = Array.from(tr.querySelectorAll('td, th'));
          return cells.map(td => td.innerText.trim());
        }).filter(r => r.length > 0);

        if (headers.length === 0 && rows.length > 0) {
          headers = rows[0].map((_, i) => "Column " + (i + 1));
        }

        return {
          title: document.title,
          headers,
          rows
        };
      })()
    `;

    const res = await this.cdp.sendCommand<{ result: { value: { title: string; headers: string[]; rows: string[][] } } }>(
      'Runtime.evaluate',
      { expression, returnByValue: true }
    );

    const { title, headers, rows } = res.result.value;

    // Build CSV with formula injection prevention (=, +, -, @ escaped) and UTF-8 BOM
    const escapeCsv = (val: string) => {
      let clean = val.replace(/"/g, '""');
      if (/^[=+\-@]/.test(clean)) {
        clean = `'${clean}`; // prevent formula execution
      }
      return `"${clean}"`;
    };

    const csvLines = [
      headers.map(escapeCsv).join(','),
      ...rows.map((row) => row.map(escapeCsv).join(',')),
    ];
    const csv = '\uFEFF' + csvLines.join('\r\n'); // UTF-8 BOM

    // Build JSON
    const json = rows.map((row) => {
      const item: Record<string, string> = {};
      headers.forEach((h, i) => {
        item[h || `col_${i}`] = row[i] || '';
      });
      return item;
    });

    return { title, headers, rows, csv, json };
  }

  /**
   * Page Snapshot: takes screenshot and captures full HTML
   */
  public async captureSnapshot(url: string, title: string): Promise<PageSnapshotResult> {
    const screenshotRes = await this.cdp.sendCommand<{ data: string }>('Page.captureScreenshot', {
      format: 'png',
    });

    const htmlRes = await this.cdp.sendCommand<{ result: { value: string } }>('Runtime.evaluate', {
      expression: 'document.documentElement.outerHTML',
      returnByValue: true,
    });

    const snapshotDir = path.join(this.baseDir, 'snapshots');
    if (!fs.existsSync(snapshotDir)) {
      fs.mkdirSync(snapshotDir, { recursive: true });
    }

    const timestamp = Date.now();
    const htmlPath = path.join(snapshotDir, `snapshot_${timestamp}.html`);
    const pngPath = path.join(snapshotDir, `snapshot_${timestamp}.png`);

    fs.writeFileSync(htmlPath, htmlRes.result.value, 'utf-8');
    fs.writeFileSync(pngPath, Buffer.from(screenshotRes.data, 'base64'));

    return {
      url,
      title,
      timestamp,
      screenshotBase64: screenshotRes.data,
      html: htmlRes.result.value,
      savedPath: htmlPath,
    };
  }
}
