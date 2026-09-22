import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { app, BrowserWindow } from 'electron';
import { createServer } from 'node:http';
import assert from 'node:assert/strict';
import { CdpBroker } from '../../src/automation/cdp-broker';
import { NetworkRequest } from '../../src/shared/types';
const profile = mkdtempSync(join(tmpdir(), 'nova-network-test-'));
app.setPath('userData', profile);
setTimeout(() => { console.error('Network integration timeout'); app.exit(1); }, 30000).unref();
async function main() {
app.on('window-all-closed', () => {});
await app.whenReady();
const server = createServer((req, res) => {
  if (req.url === '/') { res.end('<html>Network fixture</html>'); return; }
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', () => {
    res.writeHead(req.url === '/error' ? 422 : 200, { 'Content-Type': 'application/json', 'X-Fixture': 'yes' });
    res.end(JSON.stringify({ method: req.method, payload: body, value: req.url === '/large' ? 'x'.repeat(70000) : 'ok' }));
  });
});
await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
const port = (server.address() as any).port;
const win = new BrowserWindow({ show: false, webPreferences: { sandbox: true, contextIsolation: true } });
const broker = new CdpBroker('network-fixture', win.webContents);
const records = new Map<string, NetworkRequest>();
broker.onNetwork(r => records.set(r.id, r));
let code = 0;
try {
  await win.loadURL('about:blank');
  console.log('Attaching CDP');
  await broker.attach();
  console.log('Loading fixture');
  await win.loadURL(`http://127.0.0.1:${port}`);
  console.log('Sending fixture requests');
  await win.webContents.executeJavaScript(`(async () => {
    await fetch('/api?order=123', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({order:123})});
    await fetch('/error'); await fetch('/large');
    await new Promise(resolve => { const x = new XMLHttpRequest(); x.open('GET','/xhr'); x.onload=resolve; x.send(); });
  })()`);
  const deadline = Date.now() + 10000;
  while (Array.from(records.values()).filter(r => r.responseBody !== undefined).length < 4 && Date.now() < deadline)
    await new Promise(resolve => setTimeout(resolve, 50));
  const find = (path: string) => Array.from(records.values()).find(r => r.url.endsWith(path))!;
  const post = find('/api?order=123');
  assert.equal(post.resourceType, 'Fetch');
  assert.equal(post.method, 'POST');
  assert.equal(JSON.parse(post.postData!).order, 123);
  assert.equal(JSON.parse(post.responseBody!).payload, '{"order":123}');
  assert.equal(post.responseHeaders!['X-Fixture'], 'yes');
  assert.equal(post.completed, true);
  assert.equal(find('/error').status, 422);
  assert.equal(find('/error').failed, true);
  assert.ok(find('/error').responseBody);
  assert.equal(find('/xhr').resourceType, 'XHR');
  assert.equal(find('/large').responseBody!.length, 65536);
  assert.match(find('/large').bodyNote!, /truncated/);
  console.log('PASS: real Electron Fetch/XHR, POST payload, response headers/body, HTTP error body, truncation (12 assertions)');
} catch (error) { console.error(error); code = 1; }
finally { await broker.detach(); win.destroy(); server.close(); rmSync(profile, { recursive: true, force: true }); app.exit(code); }

}
void main().catch(error => { console.error(error); app.exit(1); });
