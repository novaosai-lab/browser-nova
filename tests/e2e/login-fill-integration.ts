import { app, BrowserWindow } from 'electron';
import { loginFillScript } from '../../src/main/login-fill';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
const profile = mkdtempSync(path.join(tmpdir(), 'nova-login-'));
app.setPath('userData', profile);
app.on('window-all-closed', () => {});
app.whenReady().then(async () => {
  const server = createServer((req,res) => { res.setHeader('Content-Type','text/html'); res.end('<form><input autocomplete="username"><input type="password"><button>Login</button></form><script>window.submitted=false;document.querySelector("form").onsubmit=e=>{e.preventDefault();window.submitted=true}</script>'); });
  const win = new BrowserWindow({show:false,webPreferences:{sandbox:true,contextIsolation:true}});
  win.webContents.on('console-message', (_event, _level, message) => console.log('fixture console:', message));
  const guard = setTimeout(() => app.exit(1), 30000);
  let code = 0;
  try {
    await new Promise<void>(resolve => server.listen(0,'127.0.0.1',resolve));
    const origin = `http://127.0.0.1:${(server.address() as any).port}`;
    await win.loadURL(origin);
    const fill = (site: string) => win.webContents.executeJavaScriptInIsolatedWorld(999,[{code:loginFillScript({origin:site,username:'fixture-user',password:'fixture-secret'})}]);
    assert.equal(await fill('https://example.com'),false);
    assert.equal(await win.webContents.executeJavaScript('document.querySelector("input[type=password]").value'), '');
    assert.equal(await fill(origin),true);
    assert.equal(await win.webContents.executeJavaScript('document.querySelector("input[type=password]").value'), 'fixture-secret');
    assert.equal(await win.webContents.executeJavaScript('document.querySelector("input").value'), 'fixture-user');
    assert.equal(await win.webContents.executeJavaScript('window.submitted'),false);
    await win.webContents.executeJavaScript('document.querySelector("input[type=password]").autocomplete="new-password"');
    assert.equal(await fill(origin),false);
    await win.webContents.executeJavaScript('document.querySelector("input[type=password]").autocomplete="";document.body.insertAdjacentHTML("beforeend",\'<input type="password">\')');
    assert.equal(await fill(origin),false);
    console.log('PASS: 8 Electron login-fill assertions: exact origin, native fields, no submit, reject new/ambiguous passwords');
  } catch (error) { console.error(error); code=1; }
  finally { clearTimeout(guard); win.destroy(); server.close(); rmSync(profile,{recursive:true,force:true});app.exit(code); }
});
