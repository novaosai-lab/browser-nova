import React, { useState, useEffect } from 'react';
import { AppSettings } from '../../../shared/types';
import { X, Save, Key, ShieldCheck } from 'lucide-react';
import { UpdatePanel } from './UpdatePanel';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [settings, setSettings] = useState<AppSettings>({
    aiProvider: 'gemini',
    geminiApiKey: '',
    openaiApiKey: '',
    maxActionsPerRun: 20,
    maxRunDurationSec: 180,
    requireConfirmForSensitive: true,
  });
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    if (isOpen) {
      (window as any).nova?.settings?.get().then((s: AppSettings) => {
        if (s) setSettings(s);
      });
      setIsSaved(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async () => {
    await (window as any).nova?.settings?.save(settings);
    setIsSaved(true);
    setTimeout(() => {
      setIsSaved(false);
      onClose();
    }, 800);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{
          width: '460px',
          maxHeight: 'calc(100vh - 40px)',
          overflowY: 'auto',
          backgroundColor: 'var(--bg-surface)',
          padding: '20px',
          boxShadow: 'var(--shadow-lg)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', fontWeight: 600 }}>
            <Key size={18} style={{ color: 'var(--accent-primary)' }} />
            <span>การตั้งค่า Browser Nova</span>
          </div>
          <button className="icon-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* AI Provider */}
          <div>
            <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
              ผู้ให้บริการ AI (AI Model Provider)
            </label>
            <select
              style={{
                width: '100%',
                padding: '8px',
                background: 'var(--bg-app)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-primary)',
                fontSize: '13px',
                outline: 'none',
              }}
              value={settings.aiProvider}
              onChange={(e) => setSettings({ ...settings, aiProvider: e.target.value as any })}
            >
              <option value="gemini">Google Gemini 2.5 (แนะนำ)</option>
              <option value="mock">Built-in Mock Adapter (ออฟไลน์ 100% สำหรับทดสอบ Fixture)</option>
              <option value="openai">OpenAI / Compatible API</option>
            </select>
          </div>

          {/* Gemini Key */}
          {settings.aiProvider === 'gemini' && (
            <div>
              <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                Gemini API Key
              </label>
              <input
                type="password"
                className="url-input-container"
                style={{ width: '100%', padding: '0 10px', fontSize: '13px' }}
                placeholder="AIzaSy..."
                value={settings.geminiApiKey}
                onChange={(e) => setSettings({ ...settings, geminiApiKey: e.target.value })}
              />
            </div>
          )}

          {/* OpenAI Key */}
          {settings.aiProvider === 'openai' && (
            <div>
              <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                OpenAI API Key
              </label>
              <input
                type="password"
                className="url-input-container"
                style={{ width: '100%', padding: '0 10px', fontSize: '13px' }}
                placeholder="sk-..."
                value={settings.openaiApiKey}
                onChange={(e) => setSettings({ ...settings, openaiApiKey: e.target.value })}
              />
            </div>
          )}

          {/* Safety & Limits */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                จำนวนคำสั่งสูงสุด / Run
              </label>
              <input
                type="number"
                style={{
                  width: '100%',
                  padding: '8px',
                  background: 'var(--bg-app)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                }}
                value={settings.maxActionsPerRun}
                onChange={(e) => setSettings({ ...settings, maxActionsPerRun: parseInt(e.target.value) || 20 })}
              />
            </div>

            <div>
              <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                เวลาทำงานสูงสุด (วินาที)
              </label>
              <input
                type="number"
                style={{
                  width: '100%',
                  padding: '8px',
                  background: 'var(--bg-app)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                }}
                value={settings.maxRunDurationSec}
                onChange={(e) => setSettings({ ...settings, maxRunDurationSec: parseInt(e.target.value) || 180 })}
              />
            </div>
          </div>

          {/* Sensitive Confirmation Checkbox */}
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={settings.requireConfirmForSensitive}
              onChange={(e) => setSettings({ ...settings, requireConfirmForSensitive: e.target.checked })}
            />
            <span>ขอการยืนยันก่อนทำคำสั่งที่อาจมีผลกระทบ (เช่น ลบข้อมูล หรือชำระเงิน)</span>
          </label>
        </div>

        <UpdatePanel />

        {/* Footer */}
        <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button className="secondary-btn" onClick={onClose}>
            ยกเลิก
          </button>
          <button className="primary-btn" onClick={handleSave}>
            {isSaved ? <ShieldCheck size={14} /> : <Save size={14} />}
            <span>{isSaved ? 'บันทึกแล้ว!' : 'บันทึกการตั้งค่า'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
