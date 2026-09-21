import React, { useEffect, useState } from 'react';
import { Download, RefreshCw } from 'lucide-react';
import type { NovaApi } from '../../../preload';
import type { UpdateState } from '../../../shared/update-types';

export const UpdatePanel: React.FC = () => {
  const [state, setState] = useState<UpdateState | null>(null);
  const [error, setError] = useState('');
  const updates = (window as unknown as { nova: NovaApi }).nova?.updates;

  useEffect(() => {
    if (!updates) return;
    let disposed = false;
    let receivedEvent = false;
    const unsubscribe = updates.onChanged((next) => {
      receivedEvent = true;
      if (!disposed) { setState(next); setError(''); }
    });
    updates.getState().then((next) => {
      if (!disposed && !receivedEvent) setState(next);
    }).catch(() => { if (!disposed) setError('โหลดสถานะอัปเดตไม่สำเร็จ'); });
    return () => { disposed = true; unsubscribe(); };
  }, [updates]);

  const act = (action: () => Promise<unknown>) => {
    setError('');
    action().catch(() => setError('ดำเนินการไม่สำเร็จ กรุณาลองอีกครั้ง'));
  };
  const busy = !state || ['checking', 'downloading', 'installing', 'disabled'].includes(state.status);

  return (
    <section style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border-subtle)' }} aria-label="อัปเดตแอป">
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8 }}>
        <strong>อัปเดตแอป</strong>
        <span>Browser Nova {state?.currentVersion ?? '…'}</span>
      </div>
      <p role="status" style={{ color: 'var(--text-secondary)', fontSize: 12, lineHeight: 1.6 }}>
        {error || state?.message || 'กำลังโหลดสถานะ…'}
      </p>
      {state?.status === 'downloading' && (
        <progress aria-label="ความคืบหน้าการดาวน์โหลด" max={100} value={state.percent ?? 0} style={{ width: '100%', marginBottom: 8 }} />
      )}
      {state?.status !== 'disabled' && (
        <p style={{ color: 'var(--text-muted)', fontSize: 11, margin: '8px 0' }}>ตรวจสอบอัตโนมัติเมื่อเปิดแอปและทุก 6 ชั่วโมง · ติดตั้งเมื่อคุณยืนยัน</p>
      )}
      <button className="secondary-btn" disabled={busy} onClick={() => act(() =>
        state?.status === 'available' ? updates.download()
          : state?.status === 'downloaded' ? updates.install() : updates.check()
      )}>
        {state?.status === 'available' ? <Download size={14} /> : <RefreshCw size={14} />}
        {state?.status === 'available' ? 'ดาวน์โหลดอัปเดต'
          : state?.status === 'downloaded' ? 'รีสตาร์ตและติดตั้ง' : 'ตรวจสอบอัปเดต'}
      </button>
    </section>
  );
};
