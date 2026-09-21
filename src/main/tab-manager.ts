import { BrowserWindow, WebContentsView } from 'electron';
import path from 'path';
import { Tab, TabState, Bounds, AppSettings } from '../shared/types';
import { IPC_CHANNELS } from '../shared/ipc-channels';
import { evaluateSecurityStatus, normalizeUrl } from './navigation';
import { SessionManager } from './session-manager';
import { CdpBroker } from '../automation/cdp-broker';
import { EvidenceCollector } from '../automation/evidence';
import { WorkflowRunner } from '../automation/runner';
import { AiOrchestrator } from '../ai/orchestrator';
import { BudgetConfig } from '../ai/budget';
import { DesignLabService } from './design-lab';
import { MockAdapter } from '../ai/adapters/mock-adapter';
import { GeminiAdapter } from '../ai/adapters/gemini-adapter';
import { OpenAIAdapter } from '../ai/adapters/openai-adapter';

export interface TabInstance {
  id: string;
  view: WebContentsView;
  cdpBroker: CdpBroker;
  runner: WorkflowRunner;
  orchestrator: AiOrchestrator;
  designLab: DesignLabService;
  info: Tab;
}

export class TabManager {
  private tabs: Map<string, TabInstance> = new Map();
  private activeTabId: string | null = null;
  private currentContentBounds: Bounds = { x: 0, y: 80, width: 800, height: 600 };
  private evidenceCollector: EvidenceCollector;

  constructor(
    private mainWindow: BrowserWindow,
    private artifactsDir: string,
    private settings: AppSettings
  ) {
    this.evidenceCollector = new EvidenceCollector(artifactsDir);
  }

  public updateSettings(newSettings: AppSettings) {
    this.settings = newSettings;
    const budgetConfig = this.buildBudgetConfig();
    // Update all orchestrator adapters and safety limits
    for (const tab of this.tabs.values()) {
      tab.orchestrator.setAdapter(this.createModelAdapter());
      tab.orchestrator.setBudgetConfig(budgetConfig);
    }
  }

  private buildBudgetConfig(): BudgetConfig {
    const maxActions = Number(this.settings.maxActionsPerRun);
    const maxDurationSec = Number(this.settings.maxRunDurationSec);
    return {
      maxActions: Number.isFinite(maxActions) && maxActions > 0 ? maxActions : 20,
      maxDurationMs:
        Number.isFinite(maxDurationSec) && maxDurationSec > 0 ? maxDurationSec * 1000 : 180000,
      requireConfirmForSensitive: this.settings.requireConfirmForSensitive !== false,
    };
  }

  private createModelAdapter() {
    if (this.settings.aiProvider === 'gemini' && this.settings.geminiApiKey) {
      return new GeminiAdapter(this.settings.geminiApiKey, this.settings.customModelName || 'gemini-2.5-flash');
    } else if (this.settings.aiProvider === 'openai' && this.settings.openaiApiKey) {
      return new OpenAIAdapter(this.settings.openaiApiKey, this.settings.openaiBaseUrl, this.settings.customModelName || 'gpt-4o');
    }
    return new MockAdapter();
  }

  public setContentBounds(bounds: Bounds) {
    this.currentContentBounds = bounds;
    const activeTab = this.getActiveTab();
    if (activeTab) {
      activeTab.view.setBounds(bounds);
    }
  }

  public createTab(initialUrl = 'about:blank', profile: 'default' | 'isolated-test' = 'default'): TabInstance {
    const tabId = `tab_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const sess = profile === 'default' ? SessionManager.getDefaultSession() : SessionManager.getIsolatedSession(tabId);

    const view = new WebContentsView({
      webPreferences: {
        session: sess,
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        webSecurity: true,
      },
    });

    const cdpBroker = new CdpBroker(tabId, view.webContents);
    const runner = new WorkflowRunner(cdpBroker, this.evidenceCollector, path.join(this.artifactsDir, tabId));
    const adapter = this.createModelAdapter();
    const orchestrator = new AiOrchestrator(
      cdpBroker,
      adapter,
      path.join(this.artifactsDir, tabId),
      this.buildBudgetConfig()
    );
    const designLab = new DesignLabService(cdpBroker, path.join(this.artifactsDir, tabId));

    const initialSec = evaluateSecurityStatus(initialUrl);

    const tabInfo: Tab = {
      id: tabId,
      title: 'New Tab',
      url: initialUrl,
      isLoading: false,
      canGoBack: false,
      canGoForward: false,
      isHttp: initialSec.isHttp,
      isSecure: initialSec.isSecure,
      securityStatus: initialSec.securityStatus,
      profile,
    };

    const instance: TabInstance = {
      id: tabId,
      view,
      cdpBroker,
      runner,
      orchestrator,
      designLab,
      info: tabInfo,
    };

    this.tabs.set(tabId, instance);

    // Setup webContents listeners
    this.setupViewListeners(instance);

    // Forward CDP events to renderer
    cdpBroker.onConsole((msg) => {
      if (this.activeTabId === tabId) {
        this.mainWindow.webContents.send(IPC_CHANNELS.INSPECTOR_CONSOLE_EVENT, msg);
      }
    });

    cdpBroker.onNetwork((req) => {
      if (this.activeTabId === tabId) {
        this.mainWindow.webContents.send(IPC_CHANNELS.INSPECTOR_NETWORK_EVENT, req);
      }
    });

    // Forward automation updates
    runner.on('step-update', (data) => {
      this.mainWindow.webContents.send(IPC_CHANNELS.AUTOMATION_STEP_UPDATE, { tabId, ...data });
    });
    runner.on('status-change', (status) => {
      this.mainWindow.webContents.send(IPC_CHANNELS.AUTOMATION_STATUS_CHANGE, { tabId, status });
    });

    // Forward AI updates
    orchestrator.on('step-update', (data) => {
      this.mainWindow.webContents.send(IPC_CHANNELS.AI_MESSAGE_RECEIVED, { tabId, ...data });
    });
    orchestrator.on('message-complete', (msg) => {
      this.mainWindow.webContents.send(IPC_CHANNELS.AI_MESSAGE_RECEIVED, { tabId, message: msg });
    });
    orchestrator.on('confirmation-needed', (data) => {
      this.mainWindow.webContents.send(IPC_CHANNELS.AI_STATUS_CHANGE, { tabId, confirmationNeeded: data });
    });
    orchestrator.on('status-change', (status) => {
      this.mainWindow.webContents.send(IPC_CHANNELS.AI_STATUS_CHANGE, { tabId, status });
    });

    // Select this tab if it's the first one or active
    this.selectTab(tabId);

    if (initialUrl && initialUrl !== 'about:blank') {
      this.navigateTab(tabId, initialUrl);
    }

    return instance;
  }

  private setupViewListeners(instance: TabInstance) {
    const wc = instance.view.webContents;

    // Route window.open()/target=_blank into new in-app tabs instead of letting
    // Electron spawn an unmanaged BrowserWindow with default (unhardened) prefs.
    // Only allow web schemes; deny file://, javascript:, etc.
    wc.setWindowOpenHandler(({ url }) => {
      if (/^https?:\/\//i.test(url)) {
        this.createTab(url, instance.info.profile);
      }
      return { action: 'deny' };
    });

    wc.on('did-start-loading', () => {
      instance.info.isLoading = true;
      this.emitTabUpdated(instance);
    });

    wc.on('did-stop-loading', () => {
      instance.info.isLoading = false;
      instance.info.canGoBack = wc.canGoBack();
      instance.info.canGoForward = wc.canGoForward();
      this.emitTabUpdated(instance);
    });

    wc.on('did-navigate', (event, url) => {
      instance.info.url = url;
      const sec = evaluateSecurityStatus(url);
      instance.info.isHttp = sec.isHttp;
      instance.info.isSecure = sec.isSecure;
      instance.info.securityStatus = sec.securityStatus;
      instance.info.canGoBack = wc.canGoBack();
      instance.info.canGoForward = wc.canGoForward();
      this.emitTabUpdated(instance);
    });

    wc.on('did-navigate-in-page', (event, url) => {
      instance.info.url = url;
      this.emitTabUpdated(instance);
    });

    wc.on('page-title-updated', (event, title) => {
      instance.info.title = title || 'Untitled';
      this.emitTabUpdated(instance);
    });

    wc.on('page-favicon-updated', (event, favicons) => {
      if (favicons?.length) {
        instance.info.favicon = favicons[0];
        this.emitTabUpdated(instance);
      }
    });

    wc.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
      instance.info.isLoading = false;
      instance.info.error = `${errorDescription} (${errorCode})`;
      instance.info.securityStatus = 'error';
      this.emitTabUpdated(instance);
    });
  }

  private emitTabUpdated(instance: TabInstance) {
    this.mainWindow.webContents.send(IPC_CHANNELS.TAB_UPDATED, instance.info);
    this.emitTabState();
  }

  private emitTabState() {
    this.mainWindow.webContents.send(IPC_CHANNELS.TAB_STATE_CHANGED, this.getState());
  }

  public selectTab(tabId: string) {
    const tab = this.tabs.get(tabId);
    if (!tab) return;

    // Detach previous active view
    if (this.activeTabId && this.activeTabId !== tabId) {
      const prev = this.tabs.get(this.activeTabId);
      if (prev) {
        this.mainWindow.contentView.removeChildView(prev.view);
      }
    }

    this.activeTabId = tabId;
    this.mainWindow.contentView.addChildView(tab.view);
    tab.view.setBounds(this.currentContentBounds);

    // Auto-attach CDP for active tab inspection
    tab.cdpBroker.attach().catch(() => {});

    this.emitTabUpdated(tab);
  }

  public closeTab(tabId: string) {
    const tab = this.tabs.get(tabId);
    if (!tab) return;

    // Stop runner & AI
    tab.runner.stop();
    tab.orchestrator.cancel();
    tab.cdpBroker.detach().catch(() => {});

    // Remove view
    if (this.mainWindow.contentView.children.includes(tab.view)) {
      this.mainWindow.contentView.removeChildView(tab.view);
    }

    // Clean isolated session if needed
    if (tab.info.profile === 'isolated-test') {
      SessionManager.clearIsolatedSession(tabId);
    }

    this.tabs.delete(tabId);

    // If active tab was closed, select another tab or create blank
    if (this.activeTabId === tabId) {
      const remaining = Array.from(this.tabs.keys());
      if (remaining.length > 0) {
        this.selectTab(remaining[remaining.length - 1]);
      } else {
        this.createTab('about:blank');
      }
    } else {
      this.emitTabState();
    }
  }

  public navigateTab(tabId: string, rawUrl: string, preferHttp = false) {
    const tab = this.tabs.get(tabId);
    if (!tab) return;

    const url = normalizeUrl(rawUrl, preferHttp);
    tab.info.url = url;
    tab.info.error = undefined;
    const sec = evaluateSecurityStatus(url);
    tab.info.isHttp = sec.isHttp;
    tab.info.isSecure = sec.isSecure;
    tab.info.securityStatus = sec.securityStatus;
    this.emitTabUpdated(tab);

    tab.view.webContents.loadURL(url).catch((err) => {
      tab.info.error = err.message;
      this.emitTabUpdated(tab);
    });
  }

  public goBack(tabId: string) {
    const tab = this.tabs.get(tabId);
    if (tab && tab.view.webContents.canGoBack()) {
      tab.view.webContents.goBack();
    }
  }

  public goForward(tabId: string) {
    const tab = this.tabs.get(tabId);
    if (tab && tab.view.webContents.canGoForward()) {
      tab.view.webContents.goForward();
    }
  }

  public reload(tabId: string) {
    const tab = this.tabs.get(tabId);
    if (tab) {
      tab.view.webContents.reload();
    }
  }

  public stop(tabId: string) {
    const tab = this.tabs.get(tabId);
    if (tab) {
      tab.view.webContents.stop();
    }
  }

  public openDevTools(tabId: string) {
    const tab = this.tabs.get(tabId);
    if (tab) {
      tab.view.webContents.openDevTools({ mode: 'detach' });
    }
  }

  public getAllTabs(): Tab[] {
    return Array.from(this.tabs.values()).map((t) => t.info);
  }

  public getState(): TabState {
    return { tabs: this.getAllTabs(), activeTabId: this.activeTabId };
  }

  public getActiveTab(): TabInstance | null {
    if (!this.activeTabId) return null;
    return this.tabs.get(this.activeTabId) || null;
  }

  public getTab(tabId: string): TabInstance | null {
    return this.tabs.get(tabId) || null;
  }
}
