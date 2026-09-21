import React, { useState, useEffect } from 'react';
import { Tab, ConsoleMessage, NetworkRequest, ElementInspection } from '../../../shared/types';
import { MousePointer, Terminal, Wifi, Copy, Check, Trash2, AlertTriangle, XCircle, Globe, Lock, ShieldAlert } from 'lucide-react';

interface InspectorPanelProps {
  activeTab: Tab | null;
  onOpenDevTools: () => void;
}

export const InspectorPanel: React.FC<InspectorPanelProps> = ({ activeTab, onOpenDevTools }) => {
  const [subTab, setSubTab] = useState<'elements' | 'console' | 'network'>('elements');
  const [selectedElement, setSelectedElement] = useState<ElementInspection | null>(null);
  const [consoleLogs, setConsoleLogs] = useState<ConsoleMessage[]>([]);
  const [networkRequests, setNetworkRequests] = useState<NetworkRequest[]>([]);
  const [consoleFilter, setConsoleFilter] = useState<'all' | 'error' | 'warn'>('all');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isPicking, setIsPicking] = useState(false);

  useEffect(() => {
    // Listen for live console events from active tab
    const unsubConsole = (window as any).nova?.inspector?.onConsole((msg: ConsoleMessage) => {
      if (msg.tabId === activeTab?.id) {
        setConsoleLogs((prev) => [msg, ...prev].slice(0, 200));
      }
    });

    // Listen for live network events from active tab
    const unsubNetwork = (window as any).nova?.inspector?.onNetwork((req: NetworkRequest) => {
      if (req.tabId === activeTab?.id) {
        setNetworkRequests((prev) => {
          const idx = prev.findIndex((r) => r.id === req.id);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = req;
            return next;
          }
          return [req, ...prev].slice(0, 200);
        });
      }
    });

    return () => {
      unsubConsole?.();
      unsubNetwork?.();
    };
  }, [activeTab?.id]);

  const handlePickElement = async () => {
    if (!activeTab) return;
    setIsPicking(true);
    try {
      const el = await (window as any).nova.inspector.pickElement(activeTab.id);
      if (el) {
        setSelectedElement(el);
        setSubTab('elements');
      }
    } finally {
      setIsPicking(false);
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  const filteredConsole = consoleLogs.filter((l) => {
    if (consoleFilter === 'error') return l.level === 'error';
    if (consoleFilter === 'warn') return l.level === 'warn' || l.level === 'error';
    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '10px' }}>
      {/* Top action row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button
          className={`primary-btn ${isPicking ? 'animate-pulse' : ''}`}
          onClick={handlePickElement}
          style={{ fontSize: '12px', padding: '6px 10px', background: isPicking ? 'var(--accent-cyan)' : undefined }}
        >
          <MousePointer size={14} />
          <span>{isPicking ? 'กำลังคลิกเลือกบนหน้าเว็บ...' : 'เลือก Element บนหน้าเว็บ'}</span>
        </button>

        <button className="secondary-btn" onClick={onOpenDevTools} style={{ fontSize: '12px', padding: '6px 10px' }}>
          <Terminal size={14} />
          <span>DevTools เต็ม</span>
        </button>
      </div>

      {/* Sub-tabs header */}
      <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '6px' }}>
        <button
          className={`side-tab-btn ${subTab === 'elements' ? 'active' : ''}`}
          onClick={() => setSubTab('elements')}
        >
          Elements & CSS
        </button>
        <button
          className={`side-tab-btn ${subTab === 'console' ? 'active' : ''}`}
          onClick={() => setSubTab('console')}
        >
          Console ({consoleLogs.filter((l) => l.level === 'error').length} Errors)
        </button>
        <button
          className={`side-tab-btn ${subTab === 'network' ? 'active' : ''}`}
          onClick={() => setSubTab('network')}
        >
          Network ({networkRequests.length})
        </button>
      </div>

      {/* Elements Tab */}
      {subTab === 'elements' && (
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {selectedElement ? (
            <>
              <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--accent-cyan)' }}>
                    &lt;{selectedElement.tagName}&gt;
                  </span>
                  <button
                    className="secondary-btn"
                    style={{ padding: '3px 8px', fontSize: '11px' }}
                    onClick={() => copyToClipboard(selectedElement.selector, 'sel')}
                  >
                    {copiedKey === 'sel' ? <Check size={12} /> : <Copy size={12} />}
                    <span>คัดลอก Selector</span>
                  </button>
                </div>
                <div style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                  {selectedElement.selector}
                </div>
              </div>

              {/* Computed Styles */}
              <div className="card">
                <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '8px', color: 'var(--text-primary)' }}>
                  Computed Styles
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
                  {Object.entries(selectedElement.computedStyles).map(([k, v]) => (
                    <div key={k} style={{ background: 'rgba(0, 0, 0, 0.2)', padding: '4px 6px', borderRadius: '4px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>{k}: </span>
                      <span style={{ color: 'var(--text-primary)' }}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* HTML Snippet */}
              <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600 }}>Outer HTML</span>
                  <button
                    className="secondary-btn"
                    style={{ padding: '3px 8px', fontSize: '11px' }}
                    onClick={() => copyToClipboard(selectedElement.outerHTML, 'html')}
                  >
                    {copiedKey === 'html' ? <Check size={12} /> : <Copy size={12} />}
                    <span>คัดลอก HTML</span>
                  </button>
                </div>
                <pre style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', maxHeight: '150px', overflowY: 'auto' }}>
                  {selectedElement.outerHTML}
                </pre>
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', marginTop: '40px' }}>
              คลิกปุ่ม "เลือก Element บนหน้าเว็บ" ด้านบน เพื่อจิ้มดูโครงสร้าง DOM และ Computed CSS
            </div>
          )}
        </div>
      )}

      {/* Console Tab */}
      {subTab === 'console' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '4px' }}>
              {(['all', 'error', 'warn'] as const).map((lvl) => (
                <button
                  key={lvl}
                  className={`side-tab-btn ${consoleFilter === lvl ? 'active' : ''}`}
                  style={{ padding: '3px 8px', fontSize: '11px' }}
                  onClick={() => setConsoleFilter(lvl)}
                >
                  {lvl.toUpperCase()}
                </button>
              ))}
            </div>
            <button
              className="icon-btn"
              onClick={() => setConsoleLogs([])}
              title="ล้าง Logs"
            >
              <Trash2 size={13} />
            </button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {filteredConsole.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px', marginTop: '30px' }}>
                ยังไม่มีข้อความ Console ในหน้านี้
              </div>
            ) : (
              filteredConsole.map((log) => (
                <div
                  key={log.id}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '6px',
                    padding: '6px 8px',
                    background: log.level === 'error' ? 'rgba(244, 63, 94, 0.1)' : log.level === 'warn' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(0, 0, 0, 0.2)',
                    borderLeft: `3px solid ${log.level === 'error' ? 'var(--accent-rose)' : log.level === 'warn' ? 'var(--accent-amber)' : 'var(--border-subtle)'}`,
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  {log.level === 'error' && <XCircle size={13} style={{ color: 'var(--accent-rose)', flexShrink: 0, marginTop: '2px' }} />}
                  {log.level === 'warn' && <AlertTriangle size={13} style={{ color: 'var(--accent-amber)', flexShrink: 0, marginTop: '2px' }} />}
                  <span style={{ flex: 1, color: log.level === 'error' ? '#fda4af' : 'var(--text-primary)', wordBreak: 'break-word' }}>
                    {log.text}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Network Tab */}
      {subTab === 'network' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              คำขอทั้งหมด: {networkRequests.length}
            </span>
            <button className="icon-btn" onClick={() => setNetworkRequests([])} title="ล้าง Network">
              <Trash2 size={13} />
            </button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {networkRequests.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px', marginTop: '30px' }}>
                ยังไม่มี Network Requests
              </div>
            ) : (
              networkRequests.map((req) => (
                <div
                  key={req.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '6px 8px',
                    background: req.failed ? 'rgba(244, 63, 94, 0.1)' : 'rgba(0, 0, 0, 0.2)',
                    borderLeft: `3px solid ${req.failed ? 'var(--accent-rose)' : req.isHttp ? 'var(--accent-amber)' : 'var(--accent-emerald)'}`,
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  <span
                    style={{
                      fontWeight: 600,
                      color: req.method === 'POST' ? '#38bdf8' : '#a78bfa',
                      width: '42px',
                    }}
                  >
                    {req.method}
                  </span>

                  <span
                    style={{
                      fontWeight: 600,
                      color: req.status >= 400 || req.failed ? 'var(--accent-rose)' : 'var(--accent-emerald)',
                      width: '32px',
                    }}
                  >
                    {req.status || 'ERR'}
                  </span>

                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>
                    {req.url}
                  </span>

                  {req.isHttp ? (
                    <span style={{ fontSize: '10px', color: 'var(--badge-http-text)', padding: '1px 4px', background: 'var(--badge-http-bg)', borderRadius: '3px' }}>
                      HTTP
                    </span>
                  ) : (
                    <span style={{ fontSize: '10px', color: 'var(--badge-https-text)', padding: '1px 4px', background: 'var(--badge-https-bg)', borderRadius: '3px' }}>
                      HTTPS
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
