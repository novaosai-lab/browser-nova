import { CdpBroker } from '../automation/cdp-broker';

export interface PageObservation {
  url: string;
  title: string;
  interactiveElements: {
    selector: string;
    tagName: string;
    role?: string;
    text: string;
    placeholder?: string;
    name?: string;
    testid?: string;
  }[];
  visibleTextSummary: string;
}

export class PageObserver {
  constructor(private cdp: CdpBroker) {}

  public async observe(): Promise<PageObservation> {
    const expression = `
      (() => {
        const url = window.location.href;
        const title = document.title;

        // Find interactive elements (buttons, inputs, links, textareas, selects)
        const candidates = Array.from(
          document.querySelectorAll('button, a, input, textarea, select, [role="button"], [data-testid]')
        );

        const interactive = candidates
          .filter(el => {
            const rect = el.getBoundingClientRect();
            const style = window.getComputedStyle(el);
            return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
          })
          .slice(0, 50) // limit to 50 key elements for token budget
          .map(el => {
            let selector = '';
            const testid = el.getAttribute('data-testid');
            if (testid) {
              selector = \`[data-testid="\${testid}"]\`;
            } else if (el.id) {
              selector = \`#\${el.id}\`;
            } else if (el.getAttribute('name')) {
              selector = \`\${el.tagName.toLowerCase()}[name="\${el.getAttribute('name')}"]\`;
            } else {
              const classes = Array.from(el.classList).slice(0, 2).join('.');
              selector = classes ? \`\${el.tagName.toLowerCase()}.\${classes}\` : el.tagName.toLowerCase();
            }

            return {
              selector,
              tagName: el.tagName.toLowerCase(),
              role: el.getAttribute('role') || undefined,
              text: (el.innerText || el.textContent || (el as any).value || '').trim().slice(0, 100),
              placeholder: el.getAttribute('placeholder') || undefined,
              name: el.getAttribute('name') || undefined,
              testid: testid || undefined
            };
          });

        const bodyText = (document.body ? document.body.innerText : '').slice(0, 2000);

        return {
          url,
          title,
          interactiveElements: interactive,
          visibleTextSummary: bodyText
        };
      })()
    `;

    try {
      const res = await this.cdp.sendCommand<{ result: { value: PageObservation } }>('Runtime.evaluate', {
        expression,
        returnByValue: true,
      });

      return (
        res.result?.value || {
          url: 'unknown',
          title: '',
          interactiveElements: [],
          visibleTextSummary: '',
        }
      );
    } catch (err) {
      return {
        url: 'unknown',
        title: '',
        interactiveElements: [],
        visibleTextSummary: 'Failed to observe page state',
      };
    }
  }
}
