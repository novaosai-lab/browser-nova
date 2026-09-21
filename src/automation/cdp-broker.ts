import { WebContents } from 'electron';
import { ConsoleMessage, NetworkRequest } from '../shared/types';
import { NovaError, NovaErrorCode } from '../shared/errors';

export type CDPEventListener = (params: any) => void;

export class CdpBroker {
  private static readonly MAX_PENDING_REQUESTS = 1000;
  private attached = false;
  private detachedReason: string | null = null;
  private eventListeners: Map<string, Set<CDPEventListener>> = new Map();
  private consoleListeners: Set<(msg: ConsoleMessage) => void> = new Set();
  private networkListeners: Set<(req: NetworkRequest) => void> = new Set();
  private networkRequestsMap: Map<string, Partial<NetworkRequest>> = new Map();

  constructor(public readonly tabId: string, public readonly webContents: WebContents) {
    this.setupDetachHandler();
  }

  private setupDetachHandler() {
    this.webContents.debugger.on('detach', (event, reason) => {
      this.attached = false;
      this.detachedReason = reason;
      console.warn(`[CdpBroker] Debugger detached for tab ${this.tabId}: ${reason}`);
      this.emit('debugger-detached', { tabId: this.tabId, reason });
    });

    this.webContents.debugger.on('message', (event, method, params) => {
      this.handleCDPMessage(method, params);
    });
  }

  public async attach(): Promise<void> {
    if (this.attached) return;

    try {
      if (!this.webContents.debugger.isAttached()) {
        this.webContents.debugger.attach('1.3');
      }
      this.attached = true;
      this.detachedReason = null;

      // Enable CDP domains
      await this.sendCommand('Page.enable');
      await this.sendCommand('Runtime.enable');
      await this.sendCommand('DOM.enable');
      await this.sendCommand('CSS.enable');
      await this.sendCommand('Network.enable');
      await this.sendCommand('Accessibility.enable');
    } catch (err: any) {
      this.attached = false;
      throw new NovaError(NovaErrorCode.ACTION_FAILED, `Failed to attach CDP debugger: ${err.message}`);
    }
  }

  public async detach(): Promise<void> {
    if (!this.attached) return;
    try {
      if (this.webContents.debugger.isAttached()) {
        this.webContents.debugger.detach();
      }
    } catch {
      // Ignore detach errors
    } finally {
      this.attached = false;
    }
  }

  public isAttached(): boolean {
    return this.attached && this.webContents.debugger.isAttached();
  }

  public getDetachedReason(): string | null {
    return this.detachedReason;
  }

  public async sendCommand<T = any>(method: string, params?: Record<string, any>): Promise<T> {
    if (!this.isAttached()) {
      await this.attach();
    }

    try {
      return (await this.webContents.debugger.sendCommand(method, params)) as T;
    } catch (err: any) {
      if (err.message?.includes('detached') || err.message?.includes('closed')) {
        this.attached = false;
        throw new NovaError(NovaErrorCode.DEBUGGER_DETACHED, `Debugger detached during ${method}: ${err.message}`);
      }
      throw err;
    }
  }

  private handleCDPMessage(method: string, params: any) {
    // Notify general listeners
    const listeners = this.eventListeners.get(method);
    if (listeners) {
      for (const listener of listeners) {
        try {
          listener(params);
        } catch (e) {
          console.error(e);
        }
      }
    }

    // Process Console
    if (method === 'Runtime.consoleAPICalled') {
      const text = (params.args || [])
        .map((arg: any) => (arg.value !== undefined ? String(arg.value) : arg.description || ''))
        .join(' ');
      const msg: ConsoleMessage = {
        id: `con_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        tabId: this.tabId,
        level: params.type === 'error' ? 'error' : params.type === 'warning' ? 'warn' : 'log',
        text,
        timestamp: Date.now(),
        url: params.stackTrace?.callFrames?.[0]?.url,
        lineNumber: params.stackTrace?.callFrames?.[0]?.lineNumber,
      };
      this.consoleListeners.forEach((fn) => fn(msg));
    }

    // Process Exceptions
    if (method === 'Runtime.exceptionThrown') {
      const text = params.exceptionDetails?.exception?.description || params.exceptionDetails?.text || 'Uncaught error';
      const msg: ConsoleMessage = {
        id: `con_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        tabId: this.tabId,
        level: 'error',
        text,
        timestamp: Date.now(),
        url: params.exceptionDetails?.url,
        lineNumber: params.exceptionDetails?.lineNumber,
      };
      this.consoleListeners.forEach((fn) => fn(msg));
    }

    // Process Network
    if (method === 'Network.requestWillBeSent') {
      const reqId = params.requestId;
      const url = params.request.url;
      const isHttp = url.startsWith('http://');
      // Bound the pending map so long-lived tabs with requests that never
      // complete (streaming, aborted, or missed events) can't grow it forever.
      if (this.networkRequestsMap.size >= CdpBroker.MAX_PENDING_REQUESTS) {
        const oldest = this.networkRequestsMap.keys().next().value;
        if (oldest !== undefined) this.networkRequestsMap.delete(oldest);
      }
      this.networkRequestsMap.set(reqId, {
        id: reqId,
        tabId: this.tabId,
        url,
        method: params.request.method,
        timestamp: Date.now(),
        isHttp,
        status: 0,
        failed: false,
      });
    }

    if (method === 'Network.responseReceived') {
      const reqId = params.requestId;
      const existing = this.networkRequestsMap.get(reqId);
      if (existing) {
        const netReq: NetworkRequest = {
          id: reqId,
          tabId: this.tabId,
          url: existing.url || params.response.url,
          method: existing.method || 'GET',
          status: params.response.status,
          statusText: params.response.statusText,
          mimeType: params.response.mimeType,
          durationMs: Date.now() - (existing.timestamp || Date.now()),
          isHttp: (existing.url || params.response.url).startsWith('http://'),
          failed: params.response.status >= 400,
          timestamp: existing.timestamp || Date.now(),
        };
        this.networkListeners.forEach((fn) => fn(netReq));
        this.networkRequestsMap.delete(reqId);
      }
    }

    if (method === 'Network.loadingFailed') {
      const reqId = params.requestId;
      const existing = this.networkRequestsMap.get(reqId);
      if (existing) {
        const netReq: NetworkRequest = {
          id: reqId,
          tabId: this.tabId,
          url: existing.url || 'unknown',
          method: existing.method || 'GET',
          status: 0,
          statusText: 'Failed',
          isHttp: (existing.url || '').startsWith('http://'),
          failed: true,
          failureReason: params.errorText,
          durationMs: Date.now() - (existing.timestamp || Date.now()),
          timestamp: existing.timestamp || Date.now(),
        };
        this.networkListeners.forEach((fn) => fn(netReq));
        this.networkRequestsMap.delete(reqId);
      }
    }
  }

  public on(event: string, listener: CDPEventListener) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(listener);
  }

  public off(event: string, listener: CDPEventListener) {
    this.eventListeners.get(event)?.delete(listener);
  }

  public onConsole(listener: (msg: ConsoleMessage) => void) {
    this.consoleListeners.add(listener);
  }

  public onNetwork(listener: (req: NetworkRequest) => void) {
    this.networkListeners.add(listener);
  }

  private emit(event: string, data: any) {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach((fn) => fn(data));
    }
  }
}
