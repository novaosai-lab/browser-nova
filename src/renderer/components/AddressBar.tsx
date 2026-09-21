import React, { useState, useEffect } from 'react';
import { Tab, SidePanelTab } from '../../shared/types';
import {
  ArrowLeft,
  ArrowRight,
  RotateCw,
  X,
  Lock,
  ShieldAlert,
  Sparkles,
  Search,
  Play,
  Palette,
  Settings,
  Terminal,
  Server,
} from 'lucide-react';

interface AddressBarProps {
  activeTab: Tab | null;
  sidePanelOpen: boolean;
  activeSideTab: SidePanelTab;
  onNavigate: (url: string, preferHttp?: boolean) => void;
  onGoBack: () => void;
  onGoForward: () => void;
  onReload: () => void;
  onStop: () => void;
  onOpenDevTools: () => void;
  onToggleSidePanel: (tab?: SidePanelTab) => void;
  onOpenSettings: () => void;
}

export const AddressBar: React.FC<AddressBarProps> = ({
  activeTab,
  sidePanelOpen,
  activeSideTab,
  onNavigate,
  onGoBack,
  onGoForward,
  onReload,
  onStop,
  onOpenDevTools,
  onToggleSidePanel,
  onOpenSettings,
}) => {
  const [inputUrl, setInputUrl] = useState('');
  const [preferHttp, setPreferHttp] = useState(false);

  useEffect(() => {
    if (activeTab) {
      setInputUrl(activeTab.url === 'about:blank' ? '' : activeTab.url);
      setPreferHttp(activeTab.isHttp);
    }
  }, [activeTab?.url, activeTab?.isHttp]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputUrl.trim()) {
      onNavigate(inputUrl.trim(), preferHttp);
    }
  };

  const getBadge = () => {
    if (!activeTab || activeTab.url === 'about:blank') {
      return null;
    }

    if (activeTab.isHttp) {
      const isLocal =
        activeTab.url.includes('localhost') ||
        activeTab.url.includes('127.0.0.1') ||
        activeTab.url.includes('192.168.') ||
        activeTab.url.includes('10.');
      return (
        <div
          className="security-badge http"
          title="การเชื่อมต่อนี้ไม่ได้เข้ารหัส (HTTP ธรรมดา) ตามข้อกำหนดของ Browser Nova"
          onClick={() => setPreferHttp(!preferHttp)}
        >
          {isLocal ? <Server size={12} /> : <ShieldAlert size={12} />}
          <span>{isLocal ? 'HTTP — Local/LAN' : 'HTTP — ไม่เข้ารหัส'}</span>
        </div>
      );
    }

    if (activeTab.isSecure) {
      return (
        <div className="security-badge https" title="การเชื่อมต่อเข้ารหัสปลอดภัย (HTTPS)">
          <Lock size={12} />
          <span>HTTPS — ปลอดภัย</span>
        </div>
      );
    }

    return (
      <div className="security-badge internal">
        <span>Nova</span>
      </div>
    );
  };

  return (
    <div className="address-bar">
      {/* Navigation Controls */}
      <div className="nav-buttons">
        <button
          className="icon-btn"
          disabled={!activeTab?.canGoBack}
          onClick={onGoBack}
          title="ย้อนกลับ (Cmd+[)"
        >
          <ArrowLeft size={16} />
        </button>

        <button
          className="icon-btn"
          disabled={!activeTab?.canGoForward}
          onClick={onGoForward}
          title="เดินหน้า (Cmd+])"
        >
          <ArrowRight size={16} />
        </button>

        {activeTab?.isLoading ? (
          <button className="icon-btn" onClick={onStop} title="หยุดโหลด">
            <X size={16} />
          </button>
        ) : (
          <button className="icon-btn" onClick={onReload} title="โหลดใหม่ (Cmd+R)">
            <RotateCw size={15} />
          </button>
        )}
      </div>

      {/* URL Input Form */}
      <form onSubmit={handleSubmit} className="url-input-container">
        {getBadge()}

        <input
          id="nova-omnibox"
          type="text"
          className="url-input"
          value={inputUrl}
          onChange={(e) => setInputUrl(e.target.value)}
          onFocus={(e) => e.target.select()}
          placeholder="ค้นหา Google หรือพิมพ์ URL"
          spellCheck={false}
        />

        {/* HTTP Quick Toggle for un-schemed hosts */}
        {!inputUrl.startsWith('https://') && !inputUrl.startsWith('http://') && inputUrl.length > 0 && (
          <button
            type="button"
            className={`badge-btn ${preferHttp ? 'active' : ''}`}
            onClick={() => setPreferHttp(!preferHttp)}
            title="สลับโหมดเปิดด้วย HTTP เป็นค่าเริ่มต้น"
            style={{ padding: '2px 6px', fontSize: '10px' }}
          >
            เปิดด้วย HTTP: {preferHttp ? 'เปิด' : 'ปิด'}
          </button>
        )}
      </form>

      {/* Feature Panel Buttons */}
      <div className="tool-buttons">
        <button
          className={`badge-btn ${sidePanelOpen && activeSideTab === 'ai' ? 'active' : ''}`}
          onClick={() => onToggleSidePanel('ai')}
          title="ผู้ช่วย AI (สั่งงานภาษาไทย/อังกฤษ)"
        >
          <Sparkles size={14} style={{ color: '#818cf8' }} />
          <span>AI Assistant</span>
        </button>

        <button
          className={`badge-btn ${sidePanelOpen && activeSideTab === 'inspect' ? 'active' : ''}`}
          onClick={() => onToggleSidePanel('inspect')}
          title="ตรวจสอบเว็บ (DOM, Console, Network)"
        >
          <Search size={14} style={{ color: '#38bdf8' }} />
          <span>Inspect</span>
        </button>

        <button
          className={`badge-btn ${sidePanelOpen && activeSideTab === 'automation' ? 'active' : ''}`}
          onClick={() => onToggleSidePanel('automation')}
          title="ระบบสั่งงานอัตโนมัติ (Workflow Runner)"
        >
          <Play size={14} style={{ color: '#34d399' }} />
          <span>Automation</span>
        </button>

        <button
          className={`badge-btn ${sidePanelOpen && activeSideTab === 'design-lab' ? 'active' : ''}`}
          onClick={() => onToggleSidePanel('design-lab')}
          title="Design Lab (Smart Copy, Design Tokens, Table Extractor)"
        >
          <Palette size={14} style={{ color: '#f472b6' }} />
          <span>Design Lab</span>
        </button>

        <button
          className="icon-btn"
          onClick={onOpenDevTools}
          title="เปิด Chrome DevTools เต็มรูปแบบ"
        >
          <Terminal size={15} />
        </button>

        <button
          className="icon-btn"
          onClick={onOpenSettings}
          title="ตั้งค่า (Settings & API Keys)"
        >
          <Settings size={15} />
        </button>
      </div>
    </div>
  );
};
