import React, { useState, useEffect, useRef } from 'react';
import { Tab, SidePanelTab } from '../../shared/types';
import { Sparkles, Search, Play, Palette, X, Maximize2, Minimize2 } from 'lucide-react';
import { AiChatPanel } from './ai/AiChatPanel';
import { InspectorPanel } from './inspector/InspectorPanel';
import { WorkflowPanel } from './automation/WorkflowPanel';
import { DesignLabPanel } from './design-lab/DesignLabPanel';

interface SidePanelProps {
  isOpen: boolean;
  onResizing: (value: boolean) => void;
  activeTab: Tab | null;
  activeSideTab: SidePanelTab;
  onSelectSideTab: (tab: SidePanelTab) => void;
  onClose: () => void;
  onOpenDevTools: () => void;
}

export const SidePanel: React.FC<SidePanelProps> = ({
  isOpen,
  onResizing,
  activeTab,
  activeSideTab,
  onSelectSideTab,
  onClose,
  onOpenDevTools,
}) => {
  const [width, setWidth] = useState(() => {
    try { return Number(localStorage.getItem('nova.sidePanelWidth')) || 440; } catch { return 440; }
  });
  const [expanded, setExpanded] = useState(false);
  const [viewport, setViewport] = useState(window.innerWidth);
  const dragging = useRef(false);
  const maximum = Math.max(280, viewport - 240);
  const shownWidth = Math.min(maximum, Math.max(280, expanded ? maximum : width));
  useEffect(() => {
    const resize = () => setViewport(window.innerWidth);
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);
  useEffect(() => {
    try { localStorage.setItem('nova.sidePanelWidth', String(width)); } catch {}
  }, [width]);
  useEffect(() => { if (!isOpen) { dragging.current = false; onResizing(false); } }, [isOpen, onResizing]);
  const finish = () => { dragging.current = false; onResizing(false); };
  if (!isOpen) return null;

  const getTitle = () => {
    switch (activeSideTab) {
      case 'ai':
        return { label: 'ผู้ช่วย AI (Assistant)', icon: <Sparkles size={14} style={{ color: '#818cf8' }} /> };
      case 'inspect':
        return { label: 'ตรวจสอบเว็บ (Inspect)', icon: <Search size={14} style={{ color: '#38bdf8' }} /> };
      case 'automation':
        return { label: 'ระบบอัตโนมัติ (Automation)', icon: <Play size={14} style={{ color: '#34d399' }} /> };
      case 'design-lab':
        return { label: 'Design Lab', icon: <Palette size={14} style={{ color: '#f472b6' }} /> };
    }
  };

  const titleInfo = getTitle();

  return (
    <div className="side-panel" style={{ width: shownWidth, flexShrink: 0 }}>
      <div className="panel-resize-handle" role="separator" aria-label="ปรับความกว้างแผงด้านข้าง"
        aria-orientation="vertical" aria-valuemin={280} aria-valuemax={maximum} aria-valuenow={shownWidth} tabIndex={0}
        onDoubleClick={() => { setExpanded(false); setWidth(440); }}
        onPointerDown={e => { if (e.button !== 0) return; e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); dragging.current = true; setExpanded(false); onResizing(true); }}
        onPointerMove={e => { if (dragging.current) setWidth(Math.max(280, Math.min(maximum, window.innerWidth - e.clientX))); }}
        onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={finish}
        onKeyDown={e => { if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
          e.preventDefault(); setExpanded(false);
          setWidth(e.key === 'Home' ? 440 : e.key === 'End' ? maximum : Math.max(280, Math.min(maximum, shownWidth + (e.key === 'ArrowLeft' ? 32 : -32))));
        } }} />
      {/* Header */}
      <div className="side-panel-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600 }}>
          {titleInfo.icon}
          <span>{titleInfo.label}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <div className="side-panel-tabs">
            <button
              className={`side-tab-btn ${activeSideTab === 'ai' ? 'active' : ''}`}
              onClick={() => onSelectSideTab('ai')}
              title="AI Assistant"
            >
              <Sparkles size={13} />
            </button>
            <button
              className={`side-tab-btn ${activeSideTab === 'inspect' ? 'active' : ''}`}
              onClick={() => onSelectSideTab('inspect')}
              title="Inspector"
            >
              <Search size={13} />
            </button>
            <button
              className={`side-tab-btn ${activeSideTab === 'automation' ? 'active' : ''}`}
              onClick={() => onSelectSideTab('automation')}
              title="Automation"
            >
              <Play size={13} />
            </button>
            <button
              className={`side-tab-btn ${activeSideTab === 'design-lab' ? 'active' : ''}`}
              onClick={() => onSelectSideTab('design-lab')}
              title="Design Lab"
            >
              <Palette size={13} />
            </button>
          </div>

          <button className="icon-btn" onClick={() => setExpanded(!expanded)} title={expanded ? 'คืนขนาดแผง' : 'ขยายแผง'}>
            {expanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </button>
          <button className="icon-btn" onClick={onClose} title="ปิดแผงด้านข้าง">
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="side-panel-content">
        {activeSideTab === 'ai' && <AiChatPanel activeTab={activeTab} />}
        {activeSideTab === 'inspect' && (
          <InspectorPanel activeTab={activeTab} onOpenDevTools={onOpenDevTools} />
        )}
        {activeSideTab === 'automation' && <WorkflowPanel activeTab={activeTab} />}
        {activeSideTab === 'design-lab' && <DesignLabPanel activeTab={activeTab} />}
      </div>
    </div>
  );
};
