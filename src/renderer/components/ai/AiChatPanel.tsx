import React, { useState, useEffect, useRef } from 'react';
import { Tab, AIMessage, AIStep } from '../../../shared/types';
import { Sparkles, Send, Loader2, CheckCircle2, AlertCircle, ShieldAlert, Image, RefreshCw, XCircle } from 'lucide-react';

interface AiChatPanelProps {
  activeTab: Tab | null;
}

export const AiChatPanel: React.FC<AiChatPanelProps> = ({ activeTab }) => {
  const [messages, setMessages] = useState<AIMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        'สวัสดีครับ! ผมคือ AI Assistant ของ Browser Nova พร้อมช่วยคุณควบคุมเบราว์เซอร์ ตรวจสอบเว็บ และดึงข้อมูลด้วยคำสั่งภาษาไทยหรืออังกฤษครับ',
      timestamp: Date.now(),
    },
  ]);
  const [prompt, setPrompt] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [confirmationNeeded, setConfirmationNeeded] = useState<{
    action: string;
    reason: string;
    params: Record<string, any>;
  } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isProcessing]);

  useEffect(() => {
    // Listen to AI IPC events
    const unsubMsg = (window as any).nova?.ai?.onMessage((data: any) => {
      if (data.message) {
        setMessages((prev) => {
          const idx = prev.findIndex((m) => m.id === data.message.id);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = data.message;
            return next;
          }
          return [...prev, data.message];
        });
        setIsProcessing(false);
      } else if (data.step) {
        setMessages((prev) => {
          return prev.map((m) => {
            if (m.id === data.msgId) {
              const steps = m.steps ? [...m.steps] : [];
              const sIdx = steps.findIndex((s) => s.id === data.step.id);
              if (sIdx >= 0) {
                steps[sIdx] = data.step;
              } else {
                steps.push(data.step);
              }
              return { ...m, steps };
            }
            return m;
          });
        });
      }
    });

    const unsubStatus = (window as any).nova?.ai?.onStatusChange((data: any) => {
      if (data.confirmationNeeded) {
        setConfirmationNeeded(data.confirmationNeeded);
      }
      if (data.status === 'succeeded' || data.status === 'failed' || data.status === 'cancelled') {
        setIsProcessing(false);
      }
    });

    return () => {
      unsubMsg?.();
      unsubStatus?.();
    };
  }, []);

  const handleSend = async (customPrompt?: string) => {
    const textToSend = customPrompt || prompt;
    if (!textToSend.trim() || !activeTab || isProcessing) return;

    const userMsg: AIMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: textToSend.trim(),
      timestamp: Date.now(),
    };

    const assistantPlaceholder: AIMessage = {
      id: `ai_${Date.now()}`,
      role: 'assistant',
      content: 'กำลังตรวจสอบสถานะหน้าเว็บและวางแผนคำสั่ง...',
      timestamp: Date.now(),
      steps: [],
    };

    setMessages((prev) => [...prev, userMsg, assistantPlaceholder]);
    setPrompt('');
    setIsProcessing(true);

    try {
      await (window as any).nova.ai.sendPrompt(activeTab.id, textToSend.trim());
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          role: 'assistant',
          content: `เกิดข้อผิดพลาด: ${err.message}`,
          timestamp: Date.now(),
        },
      ]);
      setIsProcessing(false);
    }
  };

  const handleConfirm = (approved: boolean) => {
    if (activeTab && confirmationNeeded) {
      (window as any).nova.ai.confirmAction(activeTab.id, approved);
      setConfirmationNeeded(null);
    }
  };

  const handleCancel = () => {
    if (activeTab) {
      (window as any).nova.ai.cancel(activeTab.id);
      setIsProcessing(false);
      setConfirmationNeeded(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '12px' }}>
      {/* Quick Prompts */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        <button
          className="secondary-btn"
          style={{ fontSize: '11px', padding: '4px 8px' }}
          onClick={() => handleSend('เปิดเว็บ HTTP 127.0.0.1:8080 ค้นหาคำว่า nova แล้วสรุปผลพร้อมถ่ายภาพ')}
        >
          🔍 ค้นหา "nova" บน HTTP fixture
        </button>
        <button
          className="secondary-btn"
          style={{ fontSize: '11px', padding: '4px 8px' }}
          onClick={() => handleSend('ตรวจหน้าเว็บนี้ว่ามี request ไหนล้มเหลว หรือ console error หรือไม่')}
        >
          🚨 ตรวจสอบข้อผิดพลาด Network/Console
        </button>
        <button
          className="secondary-btn"
          style={{ fontSize: '11px', padding: '4px 8px' }}
          onClick={() => handleSend('ถ่ายภาพหน้าจอนี้เก็บไว้เป็นหลักฐาน')}
        >
          📸 ถ่ายภาพหน้าจอ
        </button>
      </div>

      {/* Messages Scroll Area */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {messages.map((m) => (
          <div
            key={m.id}
            className="card"
            style={{
              backgroundColor: m.role === 'user' ? 'rgba(99, 102, 241, 0.1)' : 'var(--bg-surface-elevated)',
              borderColor: m.role === 'user' ? 'rgba(99, 102, 241, 0.3)' : 'var(--border-subtle)',
              alignSelf: m.role === 'user' ? 'flex-end' : 'stretch',
              maxWidth: m.role === 'user' ? '85%' : '100%',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
              {m.role === 'user' ? (
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#a5b4fc' }}>คุณ</span>
              ) : (
                <>
                  <Sparkles size={14} style={{ color: '#38bdf8' }} />
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#38bdf8' }}>Browser Nova AI</span>
                </>
              )}
            </div>

            <div style={{ fontSize: '13px', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>{m.content}</div>

            {/* Step visualization */}
            {m.steps && m.steps.length > 0 && (
              <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>ขั้นตอนการทำงาน:</div>
                {m.steps.map((step) => (
                  <div
                    key={step.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '6px 8px',
                      background: 'rgba(0, 0, 0, 0.2)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '12px',
                    }}
                  >
                    {step.status === 'running' && <Loader2 size={13} className="animate-spin text-cyan" />}
                    {step.status === 'completed' && <CheckCircle2 size={13} style={{ color: 'var(--accent-emerald)' }} />}
                    {step.status === 'failed' && <AlertCircle size={13} style={{ color: 'var(--accent-rose)' }} />}

                    <span style={{ flex: 1 }}>{step.description}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Screenshot preview */}
            {m.screenshot && (
              <div style={{ marginTop: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--text-muted)' }}>
                  <Image size={12} />
                  <span>หลักฐานภาพถ่าย:</span>
                </div>
                <div style={{ fontSize: '11px', color: '#38bdf8', marginTop: '2px', wordBreak: 'break-all' }}>
                  {m.screenshot}
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Confirmation Dialog */}
        {confirmationNeeded && (
          <div
            className="card"
            style={{
              borderColor: 'var(--accent-amber)',
              background: 'rgba(245, 158, 11, 0.1)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-amber)', fontWeight: 600 }}>
              <ShieldAlert size={16} />
              <span>ต้องการการยืนยันจากคุณเพื่อความปลอดภัย</span>
            </div>
            <div style={{ fontSize: '12px', margin: '8px 0', color: 'var(--text-secondary)' }}>
              {confirmationNeeded.reason}
              <div style={{ marginTop: '4px', fontFamily: 'monospace', color: 'var(--text-primary)' }}>
                Action: {confirmationNeeded.action}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="primary-btn" style={{ background: 'var(--accent-amber)' }} onClick={() => handleConfirm(true)}>
                อนุมัติให้ดำเนินการต่อ
              </button>
              <button className="secondary-btn" onClick={() => handleConfirm(false)}>
                ยกเลิกคำสั่งนี้
              </button>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Box */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <input
          type="text"
          className="url-input-container"
          style={{ flex: 1, padding: '0 12px', fontSize: '13px' }}
          placeholder="สั่งงานภาษาไทย เช่น ค้นหาคำว่า nova หรือ ตรวจหน้าเว็บ..."
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          disabled={isProcessing}
        />

        {isProcessing ? (
          <button className="secondary-btn" onClick={handleCancel} title="หยุดการทำงาน">
            <XCircle size={16} style={{ color: 'var(--accent-rose)' }} />
          </button>
        ) : (
          <button className="primary-btn" onClick={() => handleSend()} disabled={!prompt.trim()}>
            <Send size={14} />
          </button>
        )}
      </div>
    </div>
  );
};
