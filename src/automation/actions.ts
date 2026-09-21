import fs from 'fs';
import path from 'path';
import { CdpBroker } from './cdp-broker';
import { LocatorEngine } from './locators';
import { NovaError, NovaErrorCode } from '../shared/errors';

export class ActionExecutor {
  private locator: LocatorEngine;

  constructor(private cdp: CdpBroker, private artifactsDir: string) {
    this.locator = new LocatorEngine(cdp);
    if (!fs.existsSync(artifactsDir)) {
      fs.mkdirSync(artifactsDir, { recursive: true });
    }
  }

  public async navigate(url: string, timeoutMs = 15000): Promise<{ url: string }> {
    return new Promise(async (resolve, reject) => {
      let resolved = false;
      const timer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          this.cdp.off('Page.loadEventFired', onLoad);
          // If already loaded or navigation took a while, resolve with current URL
          resolve({ url });
        }
      }, timeoutMs);

      const onLoad = () => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          this.cdp.off('Page.loadEventFired', onLoad);
          resolve({ url });
        }
      };

      this.cdp.on('Page.loadEventFired', onLoad);

      try {
        await this.cdp.sendCommand('Page.navigate', { url });
      } catch (err: any) {
        clearTimeout(timer);
        this.cdp.off('Page.loadEventFired', onLoad);
        reject(new NovaError(NovaErrorCode.NAVIGATION_FAILED, `Navigation failed: ${err.message}`));
      }
    });
  }

  public async click(selector: string, timeoutMs = 5000): Promise<void> {
    const el = await this.locator.findElement(selector, timeoutMs);

    // Scroll into view if needed
    await this.cdp.sendCommand('Runtime.evaluate', {
      expression: `
        (() => {
          const el = document.querySelector(${JSON.stringify(selector)});
          if (el) el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
        })()
      `,
    });

    // Re-query center after scrolling
    const updated = await this.locator.findElement(selector, timeoutMs);
    const { x, y } = updated.center;

    // Dispatch mouse events
    await this.cdp.sendCommand('Input.dispatchMouseEvent', {
      type: 'mousePressed',
      x: Math.round(x),
      y: Math.round(y),
      button: 'left',
      clickCount: 1,
    });

    await new Promise((r) => setTimeout(r, 50));

    await this.cdp.sendCommand('Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      x: Math.round(x),
      y: Math.round(y),
      button: 'left',
      clickCount: 1,
    });
  }

  public async fill(selector: string, value: string, timeoutMs = 5000): Promise<void> {
    await this.locator.findElement(selector, timeoutMs);

    // Focus element, set value and dispatch events
    const expression = `
      (() => {
        const el = document.querySelector(${JSON.stringify(selector)});
        if (!el) return false;
        el.focus();
        el.value = ${JSON.stringify(value)};
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      })()
    `;

    const res = await this.cdp.sendCommand<{ result: { value: boolean } }>('Runtime.evaluate', {
      expression,
      returnByValue: true,
    });

    if (!res.result?.value) {
      throw new NovaError(NovaErrorCode.ACTION_FAILED, `Failed to fill value in "${selector}".`);
    }
  }

  public async assertText(selector: string, contains: string, timeoutMs = 5000): Promise<void> {
    const startTime = Date.now();
    let lastText = '';

    while (Date.now() - startTime < timeoutMs) {
      try {
        const text = await this.locator.getElementText(selector, 2000);
        lastText = text;
        if (text.includes(contains)) {
          return; // Success
        }
      } catch {
        // Wait and retry
      }
      await new Promise((r) => setTimeout(r, 200));
    }

    throw new NovaError(
      NovaErrorCode.ASSERTION_FAILED,
      `Text assertion failed for "${selector}". Expected to contain "${contains}", but actual text was "${lastText}".`
    );
  }

  public async screenshot(artifactName?: string): Promise<{ base64: string; filePath?: string }> {
    const res = await this.cdp.sendCommand<{ data: string }>('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: false,
    });

    const base64 = res.data;
    let filePath: string | undefined;

    if (artifactName) {
      const safeName = this.sanitizeArtifactName(artifactName);
      const fileName = safeName.toLowerCase().endsWith('.png') ? safeName : `${safeName}.png`;
      const baseDir = path.resolve(this.artifactsDir);
      const resolved = path.resolve(baseDir, fileName);

      // Defense-in-depth: never write outside the artifacts directory.
      if (resolved !== baseDir && !resolved.startsWith(baseDir + path.sep)) {
        throw new NovaError(
          NovaErrorCode.ACTION_FAILED,
          `Invalid artifact name "${artifactName}": resolved path escapes the artifacts directory.`
        );
      }

      filePath = resolved;
      fs.writeFileSync(filePath, Buffer.from(base64, 'base64'));
    }

    return { base64, filePath };
  }

  /**
   * Strips directory components and traversal sequences from a caller-supplied
   * artifact name so it can only ever land inside the artifacts directory.
   * Unicode letters (e.g. Thai) are preserved; only path-dangerous characters
   * are removed.
   */
  private sanitizeArtifactName(name: string): string {
    // Take the final path segment to defeat "../", absolute paths, and both separators.
    let base = name.replace(/\\/g, '/').split('/').pop() || '';
    // Drop null bytes, control chars, and any leading dots (no hidden/relative names).
    base = base
      .replace(/[\x00-\x1f\x7f]/g, '')
      .replace(/^\.+/, '')
      .trim();
    return base.length > 0 ? base : `artifact_${Date.now()}`;
  }

  public async scroll(x = 0, y = 300): Promise<void> {
    await this.cdp.sendCommand('Runtime.evaluate', {
      expression: `window.scrollBy({ left: ${x}, top: ${y}, behavior: 'smooth' })`,
    });
  }

  public async wait(durationMs = 1000): Promise<void> {
    await new Promise((r) => setTimeout(r, durationMs));
  }
}
