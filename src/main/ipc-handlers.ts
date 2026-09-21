import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../shared/ipc-channels';
import { TabManager } from './tab-manager';
import { AppSettings, Bounds, Workflow } from '../shared/types';
import { EvidenceCollector } from '../automation/evidence';

export function registerIpcHandlers(
  tabManager: TabManager,
  evidence: EvidenceCollector,
  getSettings: () => AppSettings,
  saveSettings: (s: AppSettings) => void
) {
  // Tabs
  ipcMain.handle(IPC_CHANNELS.TAB_CREATE, (_, initialUrl?: string, profile?: 'default' | 'isolated-test') => {
    const tab = tabManager.createTab(initialUrl, profile);
    return tab.info;
  });

  ipcMain.handle(IPC_CHANNELS.TAB_CLOSE, (_, tabId: string) => {
    tabManager.closeTab(tabId);
    return true;
  });

  ipcMain.handle(IPC_CHANNELS.TAB_SELECT, (_, tabId: string) => {
    tabManager.selectTab(tabId);
    return true;
  });

  ipcMain.handle(IPC_CHANNELS.TAB_GET_ALL, () => {
    return tabManager.getAllTabs();
  });

  ipcMain.handle(IPC_CHANNELS.TAB_GET_STATE, () => {
    return tabManager.getState();
  });

  ipcMain.handle(IPC_CHANNELS.TAB_NAVIGATE, (_, tabId: string, url: string, preferHttp = false) => {
    tabManager.navigateTab(tabId, url, preferHttp);
    return true;
  });

  ipcMain.handle(IPC_CHANNELS.TAB_GO_BACK, (_, tabId: string) => {
    tabManager.goBack(tabId);
    return true;
  });

  ipcMain.handle(IPC_CHANNELS.TAB_GO_FORWARD, (_, tabId: string) => {
    tabManager.goForward(tabId);
    return true;
  });

  ipcMain.handle(IPC_CHANNELS.TAB_RELOAD, (_, tabId: string) => {
    tabManager.reload(tabId);
    return true;
  });

  ipcMain.handle(IPC_CHANNELS.TAB_STOP, (_, tabId: string) => {
    tabManager.stop(tabId);
    return true;
  });

  ipcMain.handle(IPC_CHANNELS.TAB_OPEN_DEVTOOLS, (_, tabId: string) => {
    tabManager.openDevTools(tabId);
    return true;
  });

  // Layout Bounds
  ipcMain.handle(IPC_CHANNELS.LAYOUT_UPDATE_BOUNDS, (_, bounds: Bounds) => {
    tabManager.setContentBounds(bounds);
    return true;
  });

  // Automation
  ipcMain.handle(IPC_CHANNELS.AUTOMATION_RUN, async (_, tabId: string, workflow: Workflow) => {
    const tab = tabManager.getTab(tabId);
    if (!tab) throw new Error('Tab not found');
    return await tab.runner.runWorkflow(workflow, tab.info.url);
  });

  ipcMain.handle(IPC_CHANNELS.AUTOMATION_PAUSE, (_, tabId: string) => {
    const tab = tabManager.getTab(tabId);
    if (tab) tab.runner.pause();
    return true;
  });

  ipcMain.handle(IPC_CHANNELS.AUTOMATION_RESUME, (_, tabId: string) => {
    const tab = tabManager.getTab(tabId);
    if (tab) tab.runner.resume();
    return true;
  });

  ipcMain.handle(IPC_CHANNELS.AUTOMATION_STOP, (_, tabId: string) => {
    const tab = tabManager.getTab(tabId);
    if (tab) tab.runner.stop();
    return true;
  });

  ipcMain.handle(IPC_CHANNELS.AUTOMATION_GET_REPORTS, () => {
    return evidence.getReports();
  });

  // AI Assistant
  ipcMain.handle(IPC_CHANNELS.AI_SEND_PROMPT, async (_, tabId: string, prompt: string) => {
    const tab = tabManager.getTab(tabId);
    if (!tab) throw new Error('Tab not found');
    return await tab.orchestrator.runPrompt(prompt);
  });

  ipcMain.handle(IPC_CHANNELS.AI_CONFIRM_ACTION, (_, tabId: string, approved: boolean) => {
    const tab = tabManager.getTab(tabId);
    if (tab) tab.orchestrator.confirmAction(approved);
    return true;
  });

  ipcMain.handle(IPC_CHANNELS.AI_CANCEL_RUN, (_, tabId: string) => {
    const tab = tabManager.getTab(tabId);
    if (tab) tab.orchestrator.cancel();
    return true;
  });

  // Inspector & Element Picker
  ipcMain.handle(IPC_CHANNELS.INSPECTOR_PICK_ELEMENT, async (_, tabId: string) => {
    const tab = tabManager.getTab(tabId);
    if (!tab) throw new Error('Tab not found');

    // Injects element picker inspector script
    const expression = `
      (() => {
        return new Promise((resolve) => {
          const overlay = document.createElement('div');
          overlay.style.position = 'fixed';
          overlay.style.pointerEvents = 'none';
          overlay.style.zIndex = '999999';
          overlay.style.border = '2px solid #3b82f6';
          overlay.style.backgroundColor = 'rgba(59, 130, 246, 0.2)';
          overlay.style.transition = 'all 0.05s ease';
          document.body.appendChild(overlay);

          const onMouseOver = (e) => {
            const rect = e.target.getBoundingClientRect();
            overlay.style.top = rect.top + 'px';
            overlay.style.left = rect.left + 'px';
            overlay.style.width = rect.width + 'px';
            overlay.style.height = rect.height + 'px';
          };

          const onClick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            cleanup();

            const el = e.target;
            const rect = el.getBoundingClientRect();
            const computed = window.getComputedStyle(el);

            let selector = el.tagName.toLowerCase();
            if (el.getAttribute('data-testid')) {
              selector = \`[data-testid="\${el.getAttribute('data-testid')}"]\`;
            } else if (el.id) {
              selector = '#' + el.id;
            } else if (el.className && typeof el.className === 'string') {
              const cls = el.className.trim().split(/\\s+/).slice(0, 2).join('.');
              if (cls) selector += '.' + cls;
            }

            const styles = {};
            ['color', 'backgroundColor', 'fontSize', 'fontFamily', 'padding', 'margin', 'border'].forEach(k => {
              styles[k] = computed[k];
            });

            resolve({
              tagName: el.tagName.toLowerCase(),
              selector,
              id: el.id || '',
              className: el.className || '',
              attributes: Array.from(el.attributes).reduce((acc, a) => { acc[a.name] = a.value; return acc; }, {}),
              computedStyles: styles,
              outerHTML: el.outerHTML.slice(0, 1000),
              innerText: (el.innerText || '').slice(0, 200),
              rect: { x: rect.left, y: rect.top, width: rect.width, height: rect.height }
            });
          };

          const cleanup = () => {
            window.removeEventListener('mouseover', onMouseOver, true);
            window.removeEventListener('click', onClick, true);
            overlay.remove();
          };

          window.addEventListener('mouseover', onMouseOver, true);
          window.addEventListener('click', onClick, true);
        });
      })()
    `;

    const res = await tab.cdpBroker.sendCommand<{ result: { value: any } }>('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });

    return res.result?.value;
  });

  // Design Lab
  ipcMain.handle(IPC_CHANNELS.DESIGN_SMART_COPY, async (_, tabId: string, selector: string) => {
    const tab = tabManager.getTab(tabId);
    if (!tab) throw new Error('Tab not found');
    return await tab.designLab.smartCopy(selector);
  });

  ipcMain.handle(IPC_CHANNELS.DESIGN_EXTRACT_TOKENS, async (_, tabId: string) => {
    const tab = tabManager.getTab(tabId);
    if (!tab) throw new Error('Tab not found');
    return await tab.designLab.extractTokens();
  });

  ipcMain.handle(IPC_CHANNELS.DESIGN_EXTRACT_TABLE, async (_, tabId: string, selector?: string) => {
    const tab = tabManager.getTab(tabId);
    if (!tab) throw new Error('Tab not found');
    return await tab.designLab.extractTable(selector);
  });

  ipcMain.handle(IPC_CHANNELS.DESIGN_CAPTURE_SNAPSHOT, async (_, tabId: string) => {
    const tab = tabManager.getTab(tabId);
    if (!tab) throw new Error('Tab not found');
    return await tab.designLab.captureSnapshot(tab.info.url, tab.info.title);
  });

  // Settings
  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, () => {
    return getSettings();
  });

  ipcMain.handle(IPC_CHANNELS.SETTINGS_SAVE, (_, newSettings: AppSettings) => {
    saveSettings(newSettings);
    tabManager.updateSettings(newSettings);
    return true;
  });
}
