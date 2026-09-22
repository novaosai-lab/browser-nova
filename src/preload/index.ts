import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '../shared/ipc-channels';
import { AppSettings, Bounds, Tab, TabState, Workflow } from '../shared/types';
import type { SideExtension } from '../shared/extension-types';
import type { UpdateState } from '../shared/update-types';

const novaApi = {
  extensions: {
    list: (): Promise<SideExtension[]> => ipcRenderer.invoke(IPC_CHANNELS.EXTENSIONS_LIST),
    importFolder: (): Promise<SideExtension | null> => ipcRenderer.invoke(IPC_CHANNELS.EXTENSIONS_IMPORT),
    open: (id: string): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.EXTENSIONS_OPEN, id),
    close: (): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.EXTENSIONS_CLOSE),
    bounds: (bounds: Bounds): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.EXTENSIONS_BOUNDS, bounds),
    enable: (id: string, enabled: boolean): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.EXTENSIONS_ENABLE, id, enabled),
    remove: (id: string): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.EXTENSIONS_REMOVE, id),
    onChanged: (callback: () => void) => {
      const listener = () => callback();
      ipcRenderer.on(IPC_CHANNELS.EXTENSIONS_CHANGED, listener);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.EXTENSIONS_CHANGED, listener);
    },
  },
  updates: {
    getState: (): Promise<UpdateState> => ipcRenderer.invoke(IPC_CHANNELS.UPDATES_GET_STATE),
    check: (): Promise<UpdateState> => ipcRenderer.invoke(IPC_CHANNELS.UPDATES_CHECK),
    download: (): Promise<UpdateState> => ipcRenderer.invoke(IPC_CHANNELS.UPDATES_DOWNLOAD),
    install: (): Promise<boolean> => ipcRenderer.invoke(IPC_CHANNELS.UPDATES_INSTALL),
    onChanged: (callback: (state: UpdateState) => void) => {
      const listener = (_: unknown, state: UpdateState) => callback(state);
      ipcRenderer.on(IPC_CHANNELS.UPDATES_CHANGED, listener);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.UPDATES_CHANGED, listener);
    },
  },
  // Tabs
  tabs: {
    create: (url?: string, profile?: 'default' | 'isolated-test'): Promise<Tab> =>
      ipcRenderer.invoke(IPC_CHANNELS.TAB_CREATE, url, profile),
    close: (tabId: string): Promise<boolean> => ipcRenderer.invoke(IPC_CHANNELS.TAB_CLOSE, tabId),
    select: (tabId: string): Promise<boolean> => ipcRenderer.invoke(IPC_CHANNELS.TAB_SELECT, tabId),
    getAll: (): Promise<Tab[]> => ipcRenderer.invoke(IPC_CHANNELS.TAB_GET_ALL),
    getState: (): Promise<TabState> => ipcRenderer.invoke(IPC_CHANNELS.TAB_GET_STATE),
    onStateChanged: (callback: (state: TabState) => void) => {
      const listener = (_: any, state: TabState) => callback(state);
      ipcRenderer.on(IPC_CHANNELS.TAB_STATE_CHANGED, listener);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.TAB_STATE_CHANGED, listener);
    },
    navigate: (tabId: string, url: string, preferHttp = false): Promise<boolean> =>
      ipcRenderer.invoke(IPC_CHANNELS.TAB_NAVIGATE, tabId, url, preferHttp),
    goBack: (tabId: string): Promise<boolean> => ipcRenderer.invoke(IPC_CHANNELS.TAB_GO_BACK, tabId),
    goForward: (tabId: string): Promise<boolean> => ipcRenderer.invoke(IPC_CHANNELS.TAB_GO_FORWARD, tabId),
    reload: (tabId: string): Promise<boolean> => ipcRenderer.invoke(IPC_CHANNELS.TAB_RELOAD, tabId),
    stop: (tabId: string): Promise<boolean> => ipcRenderer.invoke(IPC_CHANNELS.TAB_STOP, tabId),
    openDevTools: (tabId: string): Promise<boolean> => ipcRenderer.invoke(IPC_CHANNELS.TAB_OPEN_DEVTOOLS, tabId),
    onUpdated: (callback: (tab: Tab) => void) => {
      const listener = (_: any, tab: Tab) => callback(tab);
      ipcRenderer.on(IPC_CHANNELS.TAB_UPDATED, listener);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.TAB_UPDATED, listener);
    },
  },

  // Layout
  layout: {
    updateBounds: (bounds: Bounds): Promise<boolean> =>
      ipcRenderer.invoke(IPC_CHANNELS.LAYOUT_UPDATE_BOUNDS, bounds),
  },

  // Shell (app-menu accelerators)
  shell: {
    onFocusOmnibox: (callback: () => void) => {
      const listener = () => callback();
      ipcRenderer.on(IPC_CHANNELS.SHELL_FOCUS_OMNIBOX, listener);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.SHELL_FOCUS_OMNIBOX, listener);
    },
  },

  // Inspector
  inspector: {
    pickElement: (tabId: string) => ipcRenderer.invoke(IPC_CHANNELS.INSPECTOR_PICK_ELEMENT, tabId),
    onConsole: (callback: (msg: any) => void) => {
      const listener = (_: any, msg: any) => callback(msg);
      ipcRenderer.on(IPC_CHANNELS.INSPECTOR_CONSOLE_EVENT, listener);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.INSPECTOR_CONSOLE_EVENT, listener);
    },
    onNetwork: (callback: (req: any) => void) => {
      const listener = (_: any, req: any) => callback(req);
      ipcRenderer.on(IPC_CHANNELS.INSPECTOR_NETWORK_EVENT, listener);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.INSPECTOR_NETWORK_EVENT, listener);
    },
  },

  // Automation
  automation: {
    run: (tabId: string, workflow: Workflow) =>
      ipcRenderer.invoke(IPC_CHANNELS.AUTOMATION_RUN, tabId, workflow),
    pause: (tabId: string) => ipcRenderer.invoke(IPC_CHANNELS.AUTOMATION_PAUSE, tabId),
    resume: (tabId: string) => ipcRenderer.invoke(IPC_CHANNELS.AUTOMATION_RESUME, tabId),
    stop: (tabId: string) => ipcRenderer.invoke(IPC_CHANNELS.AUTOMATION_STOP, tabId),
    getReports: () => ipcRenderer.invoke(IPC_CHANNELS.AUTOMATION_GET_REPORTS),
    onStepUpdate: (callback: (data: any) => void) => {
      const listener = (_: any, data: any) => callback(data);
      ipcRenderer.on(IPC_CHANNELS.AUTOMATION_STEP_UPDATE, listener);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.AUTOMATION_STEP_UPDATE, listener);
    },
    onStatusChange: (callback: (data: any) => void) => {
      const listener = (_: any, data: any) => callback(data);
      ipcRenderer.on(IPC_CHANNELS.AUTOMATION_STATUS_CHANGE, listener);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.AUTOMATION_STATUS_CHANGE, listener);
    },
  },

  // AI Assistant
  ai: {
    sendPrompt: (tabId: string, prompt: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.AI_SEND_PROMPT, tabId, prompt),
    confirmAction: (tabId: string, approved: boolean) =>
      ipcRenderer.invoke(IPC_CHANNELS.AI_CONFIRM_ACTION, tabId, approved),
    cancel: (tabId: string) => ipcRenderer.invoke(IPC_CHANNELS.AI_CANCEL_RUN, tabId),
    onMessage: (callback: (data: any) => void) => {
      const listener = (_: any, data: any) => callback(data);
      ipcRenderer.on(IPC_CHANNELS.AI_MESSAGE_RECEIVED, listener);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.AI_MESSAGE_RECEIVED, listener);
    },
    onStatusChange: (callback: (data: any) => void) => {
      const listener = (_: any, data: any) => callback(data);
      ipcRenderer.on(IPC_CHANNELS.AI_STATUS_CHANGE, listener);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.AI_STATUS_CHANGE, listener);
    },
  },

  // Design Lab
  design: {
    smartCopy: (tabId: string, selector: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.DESIGN_SMART_COPY, tabId, selector),
    extractTokens: (tabId: string) => ipcRenderer.invoke(IPC_CHANNELS.DESIGN_EXTRACT_TOKENS, tabId),
    extractTable: (tabId: string, selector?: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.DESIGN_EXTRACT_TABLE, tabId, selector),
    captureSnapshot: (tabId: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.DESIGN_CAPTURE_SNAPSHOT, tabId),
  },

  // Settings
  settings: {
    get: (): Promise<AppSettings> => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET),
    save: (s: AppSettings): Promise<boolean> => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SAVE, s),
  },
};

export type NovaApi = typeof novaApi;

contextBridge.exposeInMainWorld('nova', novaApi);
