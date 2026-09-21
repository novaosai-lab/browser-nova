export const IPC_CHANNELS = {
  // Tabs
  TAB_CREATE: 'tab:create',
  TAB_CLOSE: 'tab:close',
  TAB_SELECT: 'tab:select',
  TAB_GET_ALL: 'tab:get-all',
  TAB_GET_STATE: 'tab:get-state',
  TAB_STATE_CHANGED: 'tab:state-changed',
  TAB_NAVIGATE: 'tab:navigate',
  TAB_GO_BACK: 'tab:go-back',
  TAB_GO_FORWARD: 'tab:go-forward',
  TAB_RELOAD: 'tab:reload',
  TAB_STOP: 'tab:stop',
  TAB_UPDATED: 'tab:updated',
  TAB_OPEN_DEVTOOLS: 'tab:open-devtools',

  // Layout & Bounds
  LAYOUT_UPDATE_BOUNDS: 'layout:update-bounds',

  // Shell (app-menu accelerators → renderer)
  SHELL_FOCUS_OMNIBOX: 'shell:focus-omnibox',

  // Inspector & CDP
  INSPECTOR_START: 'inspector:start',
  INSPECTOR_STOP: 'inspector:stop',
  INSPECTOR_PICK_ELEMENT: 'inspector:pick-element',
  INSPECTOR_CONSOLE_EVENT: 'inspector:console-event',
  INSPECTOR_NETWORK_EVENT: 'inspector:network-event',
  INSPECTOR_ELEMENT_SELECTED: 'inspector:element-selected',
  INSPECTOR_CLEAR_LOGS: 'inspector:clear-logs',

  // Automation
  AUTOMATION_RUN: 'automation:run',
  AUTOMATION_PAUSE: 'automation:pause',
  AUTOMATION_RESUME: 'automation:resume',
  AUTOMATION_STOP: 'automation:stop',
  AUTOMATION_STATUS_CHANGE: 'automation:status-change',
  AUTOMATION_STEP_UPDATE: 'automation:step-update',
  AUTOMATION_GET_REPORTS: 'automation:get-reports',

  // AI Assistant
  AI_SEND_PROMPT: 'ai:send-prompt',
  AI_CONFIRM_ACTION: 'ai:confirm-action',
  AI_CANCEL_RUN: 'ai:cancel-run',
  AI_MESSAGE_RECEIVED: 'ai:message-received',
  AI_STATUS_CHANGE: 'ai:status-change',

  // Design Lab
  DESIGN_SMART_COPY: 'design:smart-copy',
  DESIGN_EXTRACT_TOKENS: 'design:extract-tokens',
  DESIGN_CAPTURE_SNAPSHOT: 'design:capture-snapshot',
  DESIGN_EXTRACT_TABLE: 'design:extract-table',
  DESIGN_EXPORT_EVIDENCE_PACK: 'design:export-evidence-pack',

  // Settings
  SETTINGS_GET: 'settings:get',
  SETTINGS_SAVE: 'settings:save',

  UPDATES_GET_STATE: 'updates:get-state',
  UPDATES_CHECK: 'updates:check',
  UPDATES_DOWNLOAD: 'updates:download',
  UPDATES_INSTALL: 'updates:install',
  UPDATES_CHANGED: 'updates:changed',
} as const;
