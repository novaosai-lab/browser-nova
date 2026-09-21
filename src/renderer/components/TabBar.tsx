import React from 'react';
import { Tab } from '../../shared/types';
import { Plus, X, Globe, ShieldAlert, Loader2, FlaskConical } from 'lucide-react';

interface TabBarProps {
  tabs: Tab[];
  activeTabId: string | null;
  onSelectTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
  onCreateTab: (profile?: 'default' | 'isolated-test') => void;
}

export const TabBar: React.FC<TabBarProps> = ({
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
  onCreateTab,
}) => {
  return (
    <div className="tab-bar">
      <div className="tabs-list">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              className={`tab-item ${isActive ? 'active' : ''}`}
              onClick={() => onSelectTab(tab.id)}
              title={tab.url}
            >
              {tab.isLoading ? (
                <Loader2 size={13} className="animate-spin text-cyan" />
              ) : tab.favicon ? (
                <img
                  src={tab.favicon}
                  alt=""
                  width={14}
                  height={14}
                  style={{ flexShrink: 0, borderRadius: 2 }}
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : tab.isHttp ? (
                <ShieldAlert size={13} style={{ color: 'var(--badge-http-text)', flexShrink: 0 }} />
              ) : tab.profile === 'isolated-test' ? (
                <FlaskConical size={13} style={{ color: '#ec4899', flexShrink: 0 }} />
              ) : (
                <Globe size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              )}

              <span className="tab-title">{tab.title || 'New Tab'}</span>

              <button
                className="tab-close-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onCloseTab(tab.id);
                }}
                title="ปิดแท็บ"
              >
                <X size={11} />
              </button>
            </div>
          );
        })}
      </div>

      <button className="new-tab-btn" onClick={() => onCreateTab('default')} title="เปิดแท็บใหม่ (Cmd+T)">
        <Plus size={16} />
      </button>

      <button
        className="new-tab-btn"
        onClick={() => onCreateTab('isolated-test')}
        title="เปิดแท็บทดสอบโปรไฟล์แยก (Isolated Test Session)"
        style={{ color: '#ec4899' }}
      >
        <FlaskConical size={14} />
      </button>

      <div className="window-drag-area" aria-hidden="true" />
    </div>
  );
};
