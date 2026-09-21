import React from 'react';
import { Tab, SidePanelTab } from '../../shared/types';
import { Sparkles, Search, Play, Palette, X } from 'lucide-react';
import { AiChatPanel } from './ai/AiChatPanel';
import { InspectorPanel } from './inspector/InspectorPanel';
import { WorkflowPanel } from './automation/WorkflowPanel';
import { DesignLabPanel } from './design-lab/DesignLabPanel';

interface SidePanelProps {
  isOpen: boolean;
  activeTab: Tab | null;
  activeSideTab: SidePanelTab;
  onSelectSideTab: (tab: SidePanelTab) => void;
  onClose: () => void;
  onOpenDevTools: () => void;
}

export const SidePanel: React.FC<SidePanelProps> = ({
  isOpen,
  activeTab,
  activeSideTab,
  onSelectSideTab,
  onClose,
  onOpenDevTools,
}) => {
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
    <div className="side-panel">
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
