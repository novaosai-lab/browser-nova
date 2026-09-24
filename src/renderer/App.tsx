import { LibraryModal } from './components/LibraryModal';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { TabState, SidePanelTab } from '../shared/types';
import { subscribeToTabState } from './tab-state';
import { TabBar } from './components/TabBar';
import { AddressBar } from './components/AddressBar';
import { SidePanel } from './components/SidePanel';
import { SettingsModal } from './components/settings/SettingsModal';
import { ExtensionPanel } from './components/ExtensionPanel';
import type { SideExtension } from '../shared/extension-types';
import type { NovaApi } from '../preload';
import { Globe, Puzzle } from 'lucide-react';

export const App: React.FC = () => {
  const [{ tabs, activeTabId }, setTabState] = useState<TabState>({ tabs: [], activeTabId: null });
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [panelResizing, setPanelResizing] = useState(false);
  const [sidePanelOpen, setSidePanelOpen] = useState(true);
  const [activeSideTab, setActiveSideTab] = useState<SidePanelTab>('ai');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const [extensionsOpen, setExtensionsOpen] = useState(false);
  const [extensionId, setExtensionId] = useState<string | null>(null);
  const [extensionError, setExtensionError] = useState('');
  const [extensions, setExtensions] = useState<SideExtension[]>([]);
  useEffect(() => {
    const api = (window as unknown as { nova: NovaApi }).nova?.extensions;
    if (!api) return;
    let alive = true;
    const refresh = () => { void api.list().then(items => { if (alive) { setExtensions(items); setExtensionError(''); } }).catch(e => { if (alive) setExtensionError(String(e)); }); };
    const off = api.onChanged(refresh); refresh();
    return () => { alive = false; off(); };
  }, []);
  const openExtensions = (id: string | null = null) => { setExtensionId(id); setExtensionsOpen(true); setSidePanelOpen(false); };

  const webviewAreaRef = useRef<HTMLDivElement>(null);

  // Measure and sync WebContentsView bounds
  const updateWebviewBounds = useCallback(() => {
    if (!webviewAreaRef.current || !(window as any).nova) return;
    const rect = webviewAreaRef.current.getBoundingClientRect();
    (window as any).nova.layout.updateBounds({
      x: Math.round(rect.left),
      y: Math.round(rect.top),
      width: isSettingsOpen || libraryOpen || panelResizing ? 0 : Math.round(rect.width),
      height: isSettingsOpen || libraryOpen || panelResizing ? 0 : Math.round(rect.height),
    });
  }, [isSettingsOpen, libraryOpen, panelResizing]);

  // Window resize and panel toggle listener
  useEffect(() => {
    updateWebviewBounds();
    const observer = new ResizeObserver(updateWebviewBounds);
    if (webviewAreaRef.current) observer.observe(webviewAreaRef.current);
    window.addEventListener('resize', updateWebviewBounds);
    return () => { observer.disconnect(); window.removeEventListener('resize', updateWebviewBounds); };
  }, [updateWebviewBounds, sidePanelOpen, extensionsOpen]);

  // Main owns both the visible webContents and the selected tab. Apply them
  // together, including tabs created after this renderer has mounted.
  useEffect(() => {
    if (!(window as any).nova) return;

    return subscribeToTabState(
      (window as any).nova.tabs,
      setTabState,
      (error) => console.error('Failed to load browser tabs:', error)
    );
  }, []);

  // Cmd/Ctrl+L (from the app menu) focuses and selects the address bar,
  // just like Chrome's omnibox.
  useEffect(() => {
    if (!(window as any).nova?.shell) return;
    return (window as any).nova.shell.onFocusOmnibox(() => {
      const el = document.getElementById('nova-omnibox') as HTMLInputElement | null;
      if (el) {
        el.focus();
        el.select();
      }
    });
  }, []);

  const activeTab = tabs.find((t) => t.id === activeTabId) || null;

  // Navigation handlers
  const handleNavigate = (url: string, preferHttp = false) => {
    if (activeTabId && (window as any).nova) {
      (window as any).nova.tabs.navigate(activeTabId, url, preferHttp);
    }
  };

  const handleGoBack = () => {
    if (activeTabId && (window as any).nova) {
      (window as any).nova.tabs.goBack(activeTabId);
    }
  };

  const handleGoForward = () => {
    if (activeTabId && (window as any).nova) {
      (window as any).nova.tabs.goForward(activeTabId);
    }
  };

  const handleReload = () => {
    if (activeTabId && (window as any).nova) {
      (window as any).nova.tabs.reload(activeTabId);
    }
  };

  const handleStop = () => {
    if (activeTabId && (window as any).nova) {
      (window as any).nova.tabs.stop(activeTabId);
    }
  };

  const handleSelectTab = (tabId: string) => {
    (window as any).nova?.tabs?.select(tabId);
    setTimeout(updateWebviewBounds, 50);
  };

  const handleCreateTab = async (profile: 'default' | 'isolated-test' = 'default') => {
    if (!(window as any).nova) return;
    // Open a blank New Tab page (Chrome-style) instead of forcing a URL.
    await (window as any).nova.tabs.create('about:blank', profile);
    setTimeout(updateWebviewBounds, 50);
  };

  const handleCloseTab = async (tabId: string) => {
    if (!(window as any).nova) return;
    await (window as any).nova.tabs.close(tabId);
    setTimeout(updateWebviewBounds, 50);
  };

  const handleOpenDevTools = () => {
    if (activeTabId && (window as any).nova) {
      (window as any).nova.tabs.openDevTools(activeTabId);
    }
  };

  const handleToggleSidePanel = (tab?: SidePanelTab) => {
    setExtensionsOpen(false);
    if (tab) {
      if (sidePanelOpen && activeSideTab === tab) {
        setSidePanelOpen(false);
      } else {
        setActiveSideTab(tab);
        setSidePanelOpen(true);
      }
    } else {
      setSidePanelOpen(!sidePanelOpen);
    }
    setTimeout(updateWebviewBounds, 50);
  };

  return (
    <div className="app-container">
      {/* Top Navigation */}
      <div className="top-nav-bar">
        <TabBar
          tabs={tabs}
          activeTabId={activeTabId}
          onSelectTab={handleSelectTab}
          onCloseTab={handleCloseTab}
          onCreateTab={handleCreateTab}
        />
        <AddressBar
          activeTab={activeTab}
          sidePanelOpen={sidePanelOpen}
          activeSideTab={activeSideTab}
          onNavigate={handleNavigate}
          onGoBack={handleGoBack}
          onGoForward={handleGoForward}
          onReload={handleReload}
          onStop={handleStop}
          onOpenDevTools={handleOpenDevTools}
          onToggleSidePanel={handleToggleSidePanel}
          onOpenLibrary={() => setLibraryOpen(true)}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenExtensions={() => openExtensions()}
          extensionButtons={extensions.filter(e => e.enabled && !e.error).map(ext => <button key={ext.id} className="icon-btn" title={`เปิด ${ext.name}`} onClick={() => openExtensions(ext.id)}><Puzzle size={15}/></button>)}
        />
      </div>

      {/* Main Body */}
      <div className="main-content">
        {/* Placeholder container for Electron WebContentsView */}
        <div ref={webviewAreaRef} className="webview-container">
          {(!activeTab || activeTab.url === 'about:blank') && (
            <div className="webview-placeholder">
              <Globe size={48} style={{ opacity: 0.3 }} />
              <div style={{ fontSize: '15px', fontWeight: 500, color: 'var(--text-secondary)' }}>
                Browser Nova
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                พิมพ์ URL หรือสั่งงาน AI ที่แผงด้านขวาเพื่อเริ่มใช้งาน
              </div>
            </div>
          )}
        </div>

        {/* Collapsible Side Panel */}
        {extensionsOpen && <ExtensionPanel items={extensions} selected={extensionId} onSelect={setExtensionId} onClose={() => setExtensionsOpen(false)} hidden={isSettingsOpen || libraryOpen} loadError={extensionError}/> }
        <SidePanel
          onResizing={setPanelResizing}
          isOpen={sidePanelOpen}
          activeTab={activeTab}
          activeSideTab={activeSideTab}
          onSelectSideTab={setActiveSideTab}
          onClose={() => handleToggleSidePanel()}
          onOpenDevTools={handleOpenDevTools}
        />
      </div>

      {libraryOpen && <LibraryModal tab={activeTab} onClose={() => setLibraryOpen(false)} onNavigate={handleNavigate}/>}
      {/* Settings Modal */}
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  );
};
