import React, { useEffect, useState } from 'react';
import type { Tab } from '../../shared/types';
import type { LibraryState } from '../../shared/library-types';
import type { NovaApi } from '../../preload';
const api = () => (window as unknown as { nova: NovaApi }).nova.library;
export function LibraryModal({ tab, onClose, onNavigate }: { tab: Tab | null; onClose(): void; onNavigate(url: string): void }) {
  const [state, setState] = useState<LibraryState>({ bookmarks: [], logins: [], encryptionAvailable: false });
  const [mode, setMode] = useState<'bookmarks' | 'passwords'>('bookmarks');
  const [title, setTitle] = useState(tab?.title || '');
  const [url, setUrl] = useState(/^https?:/.test(tab?.url || '') ? tab!.url : '');
  const [username, setUsername] = useState(''), [password, setPassword] = useState('');
  const [query, setQuery] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  useEffect(() => { let alive = true; api().state().then(s => { if (alive) setState(s); }).catch(() => { if (alive) setError('อ่านข้อมูลไม่ได้ กรุณาตรวจไฟล์ library หรือสิทธิ์ Keychain'); }); return () => { alive = false; }; }, []);
  const act = async (work: () => Promise<LibraryState>) => {
    setBusy(true); setError('');
    try { setState(await work()); setPassword(''); } catch (e) { setError(e instanceof Error ? e.message : 'Operation failed'); }
    finally { setBusy(false); }
  };
  return <div className="library-overlay"><section className="library-modal" role="dialog" aria-modal="true" aria-label="Bookmarks and passwords">
    <header><h2>Bookmarks & Passwords</h2><button className="secondary-btn" onClick={onClose}>ปิด</button></header>
    <div className="api-controls"><button className="secondary-btn" onClick={() => setMode('bookmarks')}>Bookmarks</button><button className="secondary-btn" onClick={() => setMode('passwords')}>Passwords</button></div>
    {error && <p role="alert">{error}</p>}
    <form onSubmit={e => { e.preventDefault(); void act(() => mode === 'bookmarks' ? api().bookmark(title, url) : api().saveLogin(url, username, password)); }}>
      <label>URL<input required type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://example.com" /></label>
      {mode === 'bookmarks' ? <label>ชื่อ Bookmark<input value={title} onChange={e => setTitle(e.target.value)} maxLength={1000}/></label> : <>
        <p>บันทึกด้วยตนเองแบบเข้ารหัสในเครื่อง · เลือกบัญชีแล้วกด Fill เพื่อกรอกบนเว็บ origin เดียวกัน ไม่มีการกด Login ให้</p>
        <label>Username<input value={username} onChange={e => setUsername(e.target.value)} autoComplete="off" maxLength={1000}/></label>
        <label>Password<input required type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" maxLength={8192}/></label>
        {!state.encryptionAvailable && <p>ระบบเข้ารหัสของ OS ไม่พร้อม จึงยังบันทึกรหัสผ่านไม่ได้</p>}
      </>}
      <button className="primary-btn" disabled={busy || (mode === 'passwords' && !state.encryptionAvailable)}>{mode === 'bookmarks' ? 'บันทึก Bookmark' : 'บันทึก / อัปเดตรหัสผ่าน'}</button>
    </form>
    <input aria-label="ค้นหารายการที่บันทึก" placeholder="ค้นหารายการที่บันทึก…" value={query} onChange={e => setQuery(e.target.value)}/>
    <div className="library-list">
      {mode === 'bookmarks' ? state.bookmarks.filter(b => `${b.title} ${b.url}`.toLowerCase().includes(query.toLowerCase())).map(b => <article key={b.id}>
        <button className="secondary-btn" onClick={() => { onNavigate(b.url); onClose(); }}>{b.title}</button><small>{b.url}</small>
        <button disabled={busy} onClick={() => { setTitle(b.title); setUrl(b.url); }}>แก้ชื่อ</button>
        <button disabled={busy} onClick={() => { if (confirm(`ลบ Bookmark ${b.title}?`)) void act(() => api().remove('bookmark', b.id)); }}>ลบ</button>
      </article>) : state.logins.filter(l => `${l.origin} ${l.username}`.toLowerCase().includes(query.toLowerCase())).map(l => <article key={l.id}>
        <b>{l.username || '(ไม่มี username)'}</b><small>{l.origin}</small>
        <button disabled={busy} onClick={() => void act(() => api().fill(l.id))}>Fill บนแท็บปัจจุบัน</button>
        <button disabled={busy} onClick={() => { setUrl(l.origin); setUsername(l.username); setPassword(''); }}>เปลี่ยนรหัสผ่าน</button>
        <button disabled={busy} onClick={() => { if (confirm(`ลบบัญชี ${l.username} ของ ${l.origin}?`)) void act(() => api().remove('login', l.id)); }}>ลบ</button>
      </article>)}
      {(mode === 'bookmarks' ? state.bookmarks : state.logins).length === 0 && <p>ยังไม่มีรายการที่บันทึก</p>}
    </div>
  </section></div>;
}
