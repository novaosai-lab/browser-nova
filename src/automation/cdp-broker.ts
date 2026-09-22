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
      await this.sendCommand('Network.enable', { maxTotalBufferSize: 8 * 1024 * 1024, maxResourceBufferSize: 256 * 1024, maxPostDataSize: 65536 });
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

    // Retain requests until loadingFinished: responseReceived has headers, not the body.
    const id = params.requestId;
    if (method === 'Network.requestWillBeSent') {
      if (this.networkRequestsMap.size >= CdpBroker.MAX_PENDING_REQUESTS) {
        this.networkRequestsMap.delete(this.networkRequestsMap.keys().next().value!);
      }
      const request: NetworkRequest = {
        id, tabId: this.tabId, url: params.request.url, method: params.request.method,
        resourceType: params.type, requestHeaders: params.request.headers,
        postData: params.request.postData?.slice(0, 65536),
        bodyNote: params.request.hasPostData && !params.request.postData ? 'Request payload unavailable (may include file uploads).' : undefined,
        timestamp: Date.now(), isHttp: params.request.url.startsWith('http://'), status: 0, failed: false,
      };
      this.networkRequestsMap.set(id, request);
      this.networkListeners.forEach(fn => fn({ ...request }));
    }
    const request = this.networkRequestsMap.get(id) as NetworkRequest | undefined;
    if (!request) return;
    if (method === 'Network.responseReceived') {
      Object.assign(request, { status: params.response.status, statusText: params.response.statusText,
        resourceType: params.type, mimeType: params.response.mimeType,
        responseHeaders: params.response.headers, failed: params.response.status >= 400 });
      this.networkListeners.forEach(fn => fn({ ...request }));
    }
    if (method === 'Network.loadingFailed') {
      Object.assign(request, { completed: true, failed: true, failureReason: params.errorText,
        durationMs: Date.now() - request.timestamp });
      this.networkRequestsMap.delete(id);
      this.networkListeners.forEach(fn => fn({ ...request }));
    }
    if (method === 'Network.loadingFinished') {
      this.networkRequestsMap.delete(id);
      Object.assign(request, { completed: true, encodedSize: params.encodedDataLength,
        durationMs: Date.now() - request.timestamp });
      this.networkListeners.forEach(fn => fn({ ...request }));
      if (['Fetch', 'XHR'].includes(request.resourceType || '')) {
        void this.captureResponse(request);
      }
    }
  }

  private async captureResponse(request: NetworkRequest) {
    try {
      // Do not reattach a debugger merely to read an old body.
      const result = await this.webContents.debugger.sendCommand('Network.getResponseBody', { requestId: request.id });
      const body = result.base64Encoded ? Buffer.from(result.body, 'base64').toString('utf8') : result.body;
      request.responseBody = body.slice(0, 65536);
      if (body.length > 65536) request.bodyNote = 'Response truncated to 65,536 characters.';
    } catch {
      request.bodyNote = 'Response body unavailable (buffer evicted, redirect, or debugger detached).';
    }
    this.networkListeners.forEach(fn => fn({ ...request }));
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
