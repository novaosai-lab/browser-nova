import { CdpBroker } from './cdp-broker';
import { NovaError, NovaErrorCode } from '../shared/errors';

export interface ResolvedElement {
  nodeId?: number;
  center: { x: number; y: number };
  visible: boolean;
  rect: { x: number; y: number; width: number; height: number };
  tagName: string;
  innerText: string;
  value?: string;
}

export class LocatorEngine {
  constructor(private cdp: CdpBroker) {}

  public async findElement(selector: string, timeoutMs = 5000): Promise<ResolvedElement> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      try {
        const expression = `
          (() => {
            const els = Array.from(document.querySelectorAll(${JSON.stringify(selector)}));
            if (els.length === 0) return { found: 0 };
            if (els.length > 1) {
              // check if only one is visible
              const visibleEls = els.filter(el => {
                const rect = el.getBoundingClientRect();
                const style = window.getComputedStyle(el);
                return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
              });
              if (visibleEls.length > 1) {
                return { found: els.length, ambiguous: true };
              }
            }
            const el = els[0];
            const rect = el.getBoundingClientRect();
            const style = window.getComputedStyle(el);
            const isVisible = rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
            return {
              found: els.length,
              ambiguous: false,
              tagName: el.tagName.toLowerCase(),
              innerText: el.innerText || el.textContent || '',
              value: el.value || '',
              rect: { x: rect.left, y: rect.top, width: rect.width, height: rect.height },
              center: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
              visible: isVisible
            };
          })()
        `;

        const res = await this.cdp.sendCommand<{ result: { value: any } }>('Runtime.evaluate', {
          expression,
          returnByValue: true,
        });

        const data = res.result?.value;
        if (!data || data.found === 0) {
          await new Promise((r) => setTimeout(r, 200));
          continue;
        }

        if (data.ambiguous) {
          throw new NovaError(
            NovaErrorCode.MULTIPLE_ELEMENTS_FOUND,
            `Selector "${selector}" matched ${data.found} elements. Please use a more specific selector or data-testid.`
          );
        }

        if (!data.visible) {
          await new Promise((r) => setTimeout(r, 200));
          continue;
        }

        return {
          center: data.center,
          visible: data.visible,
          rect: data.rect,
          tagName: data.tagName,
          innerText: data.innerText,
          value: data.value,
        };
      } catch (err: any) {
        if (err instanceof NovaError) throw err;
        await new Promise((r) => setTimeout(r, 200));
      }
    }

    throw new NovaError(
      NovaErrorCode.ELEMENT_NOT_FOUND,
      `Element matching selector "${selector}" was not found or not visible within ${timeoutMs}ms.`
    );
  }

  public async getElementText(selector: string, timeoutMs = 5000): Promise<string> {
    const el = await this.findElement(selector, timeoutMs);
    return el.innerText;
  }
}
