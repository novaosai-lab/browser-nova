import React, { useState } from 'react';
import { NetworkRequest } from '../../../shared/types';

function pretty(value: string) {
  try { return JSON.stringify(JSON.parse(value), null, 2); } catch { return value; }
}
export function NetworkPanel({ requests, onClear }: { requests: NetworkRequest[]; onClear: () => void }) {
  const [filter, setFilter] = useState('');
  const [apiOnly, setApiOnly] = useState(true);
  const [errorsOnly, setErrorsOnly] = useState(false);
  const [selected, setSelected] = useState<string>();
  const [section, setSection] = useState('Response');
  const [copyState, setCopyState] = useState('');
  const visible = requests.filter(r => (!apiOnly || ['Fetch', 'XHR'].includes(r.resourceType || '')) &&
    (!errorsOnly || r.failed) && `${r.method} ${r.url} ${r.status}`.toLowerCase().includes(filter.toLowerCase()));
  const request = requests.find(r => r.id === selected);
  let content = '';
  if (request) {
    if (section === 'Headers') content = JSON.stringify({ url: request.url, method: request.method, status: request.status,
      requestHeaders: request.requestHeaders, responseHeaders: request.responseHeaders }, null, 2);
    if (section === 'Payload') {
      let query: string[][] = [];
      try { query = Array.from(new URL(request.url).searchParams.entries()); } catch {}
      content = `Query parameters\n${JSON.stringify(query, null, 2)}\n\nRequest body\n${request.postData === undefined ? 'No captured payload' : pretty(request.postData)}`;
    }
    if (section === 'Response') content = request.responseBody === undefined ?
      (request.completed ? request.bodyNote || 'No captured response body' : 'Waiting for response…') : pretty(request.responseBody);
  }
  return <div className="api-network">
    <input aria-label="Filter API requests" placeholder="ค้นหา URL, method, status…" value={filter} onChange={e => setFilter(e.target.value)} />
    <div className="api-controls">
      <label><input type="checkbox" checked={apiOnly} onChange={e => setApiOnly(e.target.checked)} /> Fetch/XHR</label>
      <label><input type="checkbox" checked={errorsOnly} onChange={e => setErrorsOnly(e.target.checked)} /> Errors</label>
      <button className="secondary-btn" onClick={() => { onClear(); setSelected(undefined); }}>Clear</button>
      <span>{visible.length}/{requests.length}</span>
    </div>
    <div className="api-request-list" aria-label="Network requests">
      {visible.length === 0 && <p>เปิดหน้าเว็บหรือทำรายการเพื่อดู API · เก็บ 200 รายการล่าสุดขณะเปิด Inspect</p>}
      {visible.map(r => <button key={r.id} className={`api-request ${selected === r.id ? 'selected' : ''}`}
        onClick={() => { setSelected(r.id); setCopyState(''); }} title={r.url}>
        <b>{r.method}</b><span style={{ color: r.failed ? 'var(--accent-rose)' : 'var(--accent-emerald)' }}>{r.status || (r.failed ? 'ERR' : '…')}</span>
        <span className="api-url">{r.url}</span><small>{r.durationMs === undefined ? 'pending' : `${r.durationMs} ms`}</small>
      </button>)}
    </div>
    {request ? <div className="api-details">
      <div className="api-detail-url">{request.method} {request.url}</div>
      <small>{request.status} {request.statusText} · {request.resourceType} · {request.encodedSize ?? '—'} bytes</small>
      {request.failureReason && <p role="alert">{request.failureReason}</p>}
      <div className="api-controls">{['Headers', 'Payload', 'Response'].map(label => <button key={label}
        className={`side-tab-btn ${section === label ? 'active' : ''}`} onClick={() => { setSection(label); setCopyState(''); }}>{label}</button>)}
        <button className="secondary-btn" onClick={async () => {
          try { await navigator.clipboard.writeText(content); setCopyState('Copied'); } catch { setCopyState('Copy failed'); }
        }}>{copyState || 'Copy'}</button>
      </div>
      {request.bodyNote && <small>{request.bodyNote}</small>}
      <pre tabIndex={0}>{content}</pre>
    </div> : <p>เลือก request เพื่อดู Headers / Payload / Response</p>}
  </div>;
}
