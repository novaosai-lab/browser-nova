import React, { useState } from 'react';
import { Tab, DesignTokens, SmartCopyResult, TableExtractionResult, PageSnapshotResult } from '../../../shared/types';
import { Copy, Check, MousePointer, Palette, Table, Camera, Download, Loader2 } from 'lucide-react';

interface DesignLabPanelProps {
  activeTab: Tab | null;
}

export const DesignLabPanel: React.FC<DesignLabPanelProps> = ({ activeTab }) => {
  const [activeTabMode, setActiveTabMode] = useState<'copy' | 'tokens' | 'table' | 'snapshot'>('copy');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // States
  const [smartCopyResult, setSmartCopyResult] = useState<SmartCopyResult | null>(null);
  const [tokens, setTokens] = useState<DesignTokens | null>(null);
  const [tableResult, setTableResult] = useState<TableExtractionResult | null>(null);
  const [snapshotResult, setSnapshotResult] = useState<PageSnapshotResult | null>(null);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  const handlePickAndCopy = async () => {
    if (!activeTab) return;
    setIsLoading(true);
    try {
      const picked = await (window as any).nova.inspector.pickElement(activeTab.id);
      if (picked?.selector) {
        const res = await (window as any).nova.design.smartCopy(activeTab.id, picked.selector);
        setSmartCopyResult(res);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleExtractTokens = async () => {
    if (!activeTab) return;
    setIsLoading(true);
    try {
      const res = await (window as any).nova.design.extractTokens(activeTab.id);
      setTokens(res);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExtractTable = async () => {
    if (!activeTab) return;
    setIsLoading(true);
    try {
      const res = await (window as any).nova.design.extractTable(activeTab.id);
      setTableResult(res);
    } catch (e: any) {
      alert(e.message || 'ไม่พบตารางบนหน้านี้');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCaptureSnapshot = async () => {
    if (!activeTab) return;
    setIsLoading(true);
    try {
      const res = await (window as any).nova.design.captureSnapshot(activeTab.id);
      setSnapshotResult(res);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '12px' }}>
      {/* Sub Tabs */}
      <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '6px' }}>
        <button
          className={`side-tab-btn ${activeTabMode === 'copy' ? 'active' : ''}`}
          onClick={() => setActiveTabMode('copy')}
        >
          <MousePointer size={12} />
          <span>Smart Copy</span>
        </button>
        <button
          className={`side-tab-btn ${activeTabMode === 'tokens' ? 'active' : ''}`}
          onClick={() => setActiveTabMode('tokens')}
        >
          <Palette size={12} />
          <span>Design Tokens</span>
        </button>
        <button
          className={`side-tab-btn ${activeTabMode === 'table' ? 'active' : ''}`}
          onClick={() => setActiveTabMode('table')}
        >
          <Table size={12} />
          <span>Table Extractor</span>
        </button>
        <button
          className={`side-tab-btn ${activeTabMode === 'snapshot' ? 'active' : ''}`}
          onClick={() => setActiveTabMode('snapshot')}
        >
          <Camera size={12} />
          <span>Snapshot</span>
        </button>
      </div>

      {/* Mode 1: Smart Copy */}
      {activeTabMode === 'copy' && (
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button className="primary-btn" onClick={handlePickAndCopy} disabled={isLoading}>
            {isLoading ? <Loader2 size={14} className="animate-spin" /> : <MousePointer size={14} />}
            <span>เลือก Element เพื่อแปลงเป็น React Component</span>
          </button>

          {smartCopyResult ? (
            <>
              <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600 }}>React JSX Component</span>
                  <button
                    className="secondary-btn"
                    style={{ padding: '3px 8px', fontSize: '11px' }}
                    onClick={() => copyToClipboard(smartCopyResult.reactComponent, 'jsx')}
                  >
                    {copiedKey === 'jsx' ? <Check size={12} /> : <Copy size={12} />}
                    <span>คัดลอก React</span>
                  </button>
                </div>
                <pre style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', maxHeight: '180px', overflowY: 'auto' }}>
                  {smartCopyResult.reactComponent}
                </pre>
              </div>

              <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600 }}>Computed CSS</span>
                  <button
                    className="secondary-btn"
                    style={{ padding: '3px 8px', fontSize: '11px' }}
                    onClick={() => copyToClipboard(smartCopyResult.css, 'css')}
                  >
                    {copiedKey === 'css' ? <Check size={12} /> : <Copy size={12} />}
                    <span>คัดลอก CSS</span>
                  </button>
                </div>
                <pre style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', maxHeight: '120px', overflowY: 'auto' }}>
                  {smartCopyResult.css}
                </pre>
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', marginTop: '40px' }}>
              คลิกปุ่มด้านบน แล้วเลือก element (เช่น ปุ่ม การ์ด หรือส่วนหัว) เพื่อแปลงเป็น React code พร้อม style
            </div>
          )}
        </div>
      )}

      {/* Mode 2: Design Tokens */}
      {activeTabMode === 'tokens' && (
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button className="primary-btn" onClick={handleExtractTokens} disabled={isLoading}>
            {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Palette size={14} />}
            <span>สกัด Design Tokens จากหน้าปัจจุบัน</span>
          </button>

          {tokens ? (
            <>
              {/* Colors */}
              <div className="card">
                <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '8px' }}>
                  Colors Palette ({tokens.colors.length})
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {tokens.colors.map((c) => (
                    <div
                      key={c}
                      onClick={() => copyToClipboard(c, c)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        background: 'rgba(0,0,0,0.3)',
                        padding: '4px 6px',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '11px',
                      }}
                      title="คลิกเพื่อคัดลอกสี"
                    >
                      <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: c, border: '1px solid rgba(255,255,255,0.2)' }} />
                      <span>{c}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Typography */}
              <div className="card">
                <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '8px' }}>Typography Fonts</div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                  {tokens.typography.fontFamilies.join(', ')}
                </div>
              </div>

              {/* Export JSON */}
              <button
                className="secondary-btn"
                onClick={() => copyToClipboard(JSON.stringify(tokens, null, 2), 'tokJson')}
              >
                {copiedKey === 'tokJson' ? <Check size={14} /> : <Copy size={14} />}
                <span>คัดลอก Tokens เป็น JSON</span>
              </button>
            </>
          ) : (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', marginTop: '40px' }}>
              คลิกปุ่มด้านบน เพื่อสกัด Color Palette, Fonts, Spacing ของเว็บไซต์
            </div>
          )}
        </div>
      )}

      {/* Mode 3: Table Extractor */}
      {activeTabMode === 'table' && (
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button className="primary-btn" onClick={handleExtractTable} disabled={isLoading}>
            {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Table size={14} />}
            <span>ดึงข้อมูลตารางในหน้าเว็บ</span>
          </button>

          {tableResult ? (
            <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600 }}>
                  พบตาราง: {tableResult.rows.length} แถว, {tableResult.headers.length} คอลัมน์
                </span>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button
                    className="secondary-btn"
                    style={{ padding: '3px 8px', fontSize: '11px' }}
                    onClick={() => copyToClipboard(tableResult.csv, 'csv')}
                  >
                    {copiedKey === 'csv' ? <Check size={12} /> : <Copy size={12} />}
                    <span>คัดลอก CSV</span>
                  </button>
                  <button
                    className="secondary-btn"
                    style={{ padding: '3px 8px', fontSize: '11px' }}
                    onClick={() => copyToClipboard(JSON.stringify(tableResult.json, null, 2), 'tjson')}
                  >
                    {copiedKey === 'tjson' ? <Check size={12} /> : <Copy size={12} />}
                    <span>คัดลอก JSON</span>
                  </button>
                </div>
              </div>

              <div style={{ overflowX: 'auto', flex: 1 }}>
                <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'rgba(255,255,255,0.05)', textAlign: 'left' }}>
                      {tableResult.headers.map((h, i) => (
                        <th key={i} style={{ padding: '6px 8px', borderBottom: '1px solid var(--border-subtle)' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tableResult.rows.slice(0, 10).map((row, rIdx) => (
                      <tr key={rIdx} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                        {row.map((cell, cIdx) => (
                          <td key={cIdx} style={{ padding: '6px 8px' }}>
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', marginTop: '40px' }}>
              คลิกปุ่มด้านบน เพื่อดึงข้อมูลตารางและส่งออกเป็น CSV/JSON ที่รองรับภาษาไทย
            </div>
          )}
        </div>
      )}

      {/* Mode 4: Page Snapshot */}
      {activeTabMode === 'snapshot' && (
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button className="primary-btn" onClick={handleCaptureSnapshot} disabled={isLoading}>
            {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
            <span>จับภาพ Snapshot หน้าเว็บและ HTML</span>
          </button>

          {snapshotResult && (
            <div className="card">
              <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                บันทึก Snapshot สำเร็จ
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                พาธไฟล์: {snapshotResult.savedPath}
              </div>
              <img
                src={`data:image/png;base64,${snapshotResult.screenshotBase64}`}
                alt="Snapshot"
                style={{ width: '100%', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
