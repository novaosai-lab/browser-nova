import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, FolderPlus, Puzzle, X } from 'lucide-react';
import type { SideExtension } from '../../shared/extension-types';
import type { NovaApi } from '../../preload';
const api = () => (window as unknown as { nova: NovaApi }).nova.extensions;

export function ExtensionPanel({ items, selected, onSelect, onClose, hidden, loadError }: {
  items: SideExtension[]; selected: string | null; onSelect: (id: string | null) => void; onClose: () => void; hidden: boolean; loadError: string;
}) {
  const area = useRef<HTMLDivElement>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const item = items.find(i => i.id === selected);
  const act = async (task: () => Promise<unknown>) => {
    setError(''); setBusy(true);
    try { await task(); } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };
  useEffect(() => {
    if (!selected) { void api().close().catch(() => {}); return; }
    let active = true;
    setError('');
    void api().open(selected).catch(e => { if (active) { setError(String(e)); onSelect(null); } });
    return () => { active = false; void api().bounds({ x: 0, y: 0, width: 0, height: 0 }).catch(() => {}); void api().close().catch(() => {}); };
  }, [selected]);
  useEffect(() => {
    const update = () => {
      const rect = area.current?.getBoundingClientRect();
      void api().bounds(rect && !hidden ? { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.floor(rect.width), height: Math.floor(rect.height) } : { x: 0, y: 0, width: 0, height: 0 }).catch(() => {});
    };
    const observer = new ResizeObserver(update);
    if (area.current) observer.observe(area.current);
    window.addEventListener('resize', update); update();
    return () => { observer.disconnect(); window.removeEventListener('resize', update); };
  }, [selected, hidden]);
  return <aside className="extensions-panel" aria-label="Extensions">
    <header className="extensions-header">
      {selected && <button className="icon-btn" title="กลับไปรายการส่วนขยาย" onClick={() => onSelect(null)}><ArrowLeft size={16}/></button>}
      <Puzzle size={16}/><strong>{item?.name || 'Extensions'}</strong>
      <button className="icon-btn" style={{ marginLeft: 'auto' }} title="ปิด Extensions" onClick={onClose}><X size={16}/></button>
    </header>
    {(error || loadError) && <p role="alert" className="extension-error">{error || loadError}</p>}
    {selected ? <div ref={area} className="extension-view-area"/> : <div className="extensions-list">
      <p>Side Panel extensions แบบ Unpacked — รองรับ HTML/CSS/JS และ HTTP/HTTPS ตามสิทธิ์ที่ระบุ ไม่รองรับ Chrome APIs ทุกตัว</p>
      <button className="badge-btn" disabled={busy || !!loadError} onClick={() => void act(async () => { await api().importFolder(); })}><FolderPlus size={15}/> โหลดโฟลเดอร์ส่วนขยาย</button>
      {items.length === 0 && <p>ยังไม่มีส่วนขยาย เลือกโฟลเดอร์ที่มี manifest.json เพื่อเริ่มต้น</p>}
      {items.map(ext => <article className="extension-card" key={ext.id}>
        <strong>{ext.name}</strong> <span>v{ext.version}</span>
        <p>{ext.enabled ? 'เปิดใช้งาน' : 'ปิดใช้งาน'} · โปรไฟล์แยก</p>
        <details><summary>สิทธิ์เครือข่าย ({ext.hosts.length})</summary>{ext.hosts.map(host => <div key={host}>{host}</div>)}</details>
        {ext.error && <p role="alert" className="extension-error">{ext.error}</p>}
        <div className="extension-actions">
          <button className="badge-btn" disabled={busy || !ext.enabled} onClick={() => onSelect(ext.id)}>เปิดแผง</button>
          <button className="badge-btn" disabled={busy} onClick={() => void act(() => api().enable(ext.id, !ext.enabled))}>{ext.enabled ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}</button>
          <button className="badge-btn" disabled={busy} onClick={() => setRemoveId(ext.id)}>ถอนติดตั้ง</button>
        </div>
        {removeId === ext.id && <div><p>ถอนส่วนขยายและลบข้อมูลโปรไฟล์ของส่วนขยายนี้?</p><button className="badge-btn" disabled={busy} onClick={() => void act(async () => { await api().remove(ext.id); setRemoveId(null); })}>ยืนยันถอนติดตั้ง</button> <button className="badge-btn" onClick={() => setRemoveId(null)}>ยกเลิก</button></div>}
      </article>)}
    </div>}
  </aside>;
}
