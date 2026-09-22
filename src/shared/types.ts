export interface Tab {
  id: string;
  title: string;
  url: string;
  favicon?: string;
  isLoading: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  isHttp: boolean;
  isSecure: boolean;
  securityStatus: 'http' | 'https' | 'internal' | 'error';
  profile: 'default' | 'isolated-test';
  error?: string;
}

export interface TabState {
  tabs: Tab[];
  activeTabId: string | null;
}

export type SidePanelTab = 'ai' | 'inspect' | 'automation' | 'design-lab';

export interface ConsoleMessage {
  id: string;
  tabId: string;
  level: 'log' | 'info' | 'warn' | 'error' | 'debug';
  text: string;
  timestamp: number;
  url?: string;
  lineNumber?: number;
}

export interface NetworkRequest {
  resourceType?: string;
  requestHeaders?: Record<string, string>;
  responseHeaders?: Record<string, string>;
  postData?: string;
  responseBody?: string;
  bodyNote?: string;
  completed?: boolean;
  encodedSize?: number;
  id: string;
  tabId: string;
  url: string;
  method: string;
  status: number;
  statusText?: string;
  mimeType?: string;
  durationMs?: number;
  isHttp: boolean;
  failed: boolean;
  failureReason?: string;
  timestamp: number;
}

export interface ElementInspection {
  tagName: string;
  selector: string;
  id: string;
  className: string;
  attributes: Record<string, string>;
  computedStyles: Record<string, string>;
  outerHTML: string;
  innerText: string;
  rect: { x: number; y: number; width: number; height: number };
}

export type ActionType =
  | 'navigate'
  | 'click'
  | 'fill'
  | 'select'
  | 'pressKey'
  | 'scroll'
  | 'wait'
  | 'assertText'
  | 'screenshot'
  | 'extractData'
  | 'extractTokens';

export interface WorkflowStep {
  id: string;
  action: ActionType;
  url?: string;
  selector?: string;
  value?: string;
  key?: string;
  contains?: string;
  artifact?: string;
  timeoutMs?: number;
  status?: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  result?: any;
  error?: string;
  durationMs?: number;
}

export interface Workflow {
  schemaVersion: number;
  name: string;
  allowedOrigins?: string[];
  steps: WorkflowStep[];
}

export type RunStatus = 'idle' | 'running' | 'paused' | 'stopped' | 'completed' | 'failed';

export interface RunReport {
  runId: string;
  workflowName: string;
  startedAt: number;
  finishedAt: number;
  status: RunStatus;
  beforeUrl: string;
  afterUrl: string;
  steps: {
    stepId: string;
    action: string;
    durationMs: number;
    status: string;
    error?: string;
    screenshot?: string;
  }[];
  artifacts: string[];
  consoleErrors: string[];
  networkFailures: string[];
}

export interface AIStep {
  id: string;
  description: string;
  tool: string;
  params: Record<string, any>;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: string;
  error?: string;
}

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  steps?: AIStep[];
  screenshot?: string;
  evidence?: string[];
  confirmationRequired?: {
    action: string;
    reason: string;
    params: Record<string, any>;
  };
}

export interface DesignTokens {
  colors: string[];
  typography: {
    fontFamilies: string[];
    fontSizes: string[];
    fontWeights: string[];
  };
  spacing: string[];
  radii: string[];
  shadows: string[];
}

export interface SmartCopyResult {
  selector: string;
  tagName: string;
  html: string;
  css: string;
  reactComponent: string;
}

export interface TableExtractionResult {
  title: string;
  headers: string[];
  rows: string[][];
  csv: string;
  json: Record<string, string>[];
}

export interface PageSnapshotResult {
  url: string;
  title: string;
  timestamp: number;
  screenshotBase64: string;
  html: string;
  savedPath?: string;
}

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface AppSettings {
  aiProvider: 'gemini' | 'openai' | 'mock';
  geminiApiKey: string;
  openaiApiKey: string;
  openaiBaseUrl?: string;
  customModelName?: string;
  maxActionsPerRun: number;
  maxRunDurationSec: number;
  requireConfirmForSensitive: boolean;
}
