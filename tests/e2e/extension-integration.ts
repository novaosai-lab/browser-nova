// Real Electron integration against loopback fixtures only; no private extension or production API.
import { app, BrowserWindow, WebContentsView } from 'electron';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { ExtensionManager } from '../../src/main/extensions/manager';

const temp = fsSync.mkdtempSync(path.join(os.tmpdir(), 'nova-extension-e2e-'));
app.setPath('userData', path.join(temp, 'profile'));
app.on('window-all-closed', () => {});
app.whenReady().then(async () => {
  let win: BrowserWindow | undefined, manager: ExtensionManager | undefined;
  const hits: string[] = [], blockedHits: string[] = [];
  const blocked = http.createServer((req,res) => { blockedHits.push(req.url || ''); res.end('must not reach'); });
  const server = http.createServer((req,res) => {
    hits.push(`${req.method} ${req.url}`);
    if (req.url === '/redirect') { res.writeHead(307, { Location: `http://localhost:${(blocked.address() as any).port}/blocked` }); res.end(); }
    else { let body = ''; req.on('data', b => body += b); req.on('end', () => { res.setHeader('Content-Type','application/json'); res.end(JSON.stringify({ method: req.method, body })); }); }
  });
  let checks = 0, exitCode = 0;
  const check = (name: string, value: unknown) => { assert.ok(value, name); console.log(`PASS ${++checks}: ${name}`); };
  const guard = setTimeout(() => { console.error('Extension integration deadline exceeded'); app.exit(1); }, 45000);
  try {
    await Promise.all([new Promise<void>(r => server.listen(0,'127.0.0.1',r)), new Promise<void>(r => blocked.listen(0,'127.0.0.1',r))]);
    const url = `http://127.0.0.1:${(server.address() as any).port}`;
    const source = path.join(temp,'source'); await fs.mkdir(source);
    await fs.writeFile(path.join(source,'manifest.json'),JSON.stringify({ manifest_version:3, name:'Fixture Panel',version:'1.0',permissions:['sidePanel'],host_permissions:['http://127.0.0.1/*'],action:{default_title:'Fixture'},background:{service_worker:'background.js'},side_panel:{default_path:'panel.html'} }));
    await fs.writeFile(path.join(source,'background.js'),'chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((error) => console.error(error));');
    await fs.writeFile(path.join(source,'panel.html'), '<!doctype html><h1>Fixture Panel</h1><button id="patch">PATCH fixture</button><output id="result"></output><script src="panel.js"></script>');
    await fs.writeFile(path.join(source,'panel.js'), `document.querySelector('#patch').onclick=async()=>{const r=await fetch('${url}/status',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({orderId:'TEST-ONLY'})});document.querySelector('#result').textContent=await r.text();};`);
    win = new BrowserWindow({show:false,width:1100,height:700,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false}});
    const root = path.join(temp,'extensions');
    manager = new ExtensionManager(win,root); await manager.restore();
    const rejected = await manager.install(source,async()=>false);
    check('declined import leaves no installed extension', rejected === null && manager.list().length === 0);
    const installed = await manager.install(source,async m => m.host_permissions[0] === 'http://127.0.0.1/*');
    assert.ok(installed);
    check('supported side-panel bootstrap imports', manager.list().length === 1);
    await fs.writeFile(path.join(source,'panel.html'),'<h1>CHANGED EXTERNAL FOLDER</h1>');
    manager.setBounds({x:700,y:80,width:400,height:600});
    await manager.open(installed.id);
    const view = win.contentView.children.find(v=>v instanceof WebContentsView) as WebContentsView;
    check('panel renders immutable imported snapshot', await view.webContents.executeJavaScript('document.querySelector("h1").textContent === "Fixture Panel"'));
    check('panel has no Nova bridge or Node require', await view.webContents.executeJavaScript('typeof window.nova === "undefined" && typeof require === "undefined"'));
    check('web security enabled', view.webContents.getLastWebPreferences().webSecurity !== false);
    await view.webContents.executeJavaScript('document.querySelector("#patch").click()');
    const output = await view.webContents.executeJavaScript(`new Promise((resolve,reject)=>{const end=Date.now()+5000; const tick=()=>{const value=document.querySelector('#result').textContent;if(value)resolve(value);else if(Date.now()>end)reject(new Error('No result'));else setTimeout(tick,20);};tick();})`);
    check('real panel button performs PATCH without CORS bypass', JSON.parse(output).method === 'PATCH' && JSON.parse(output).body.includes('TEST-ONLY'));
    const post = await view.webContents.executeJavaScript(`fetch('${url}/post',{method:'POST',body:'fixture'}).then(r=>r.json())`);
    check('POST receives fixture response',post.method === 'POST' && post.body === 'fixture');
    check('unlisted host is rejected',await view.webContents.executeJavaScript(`fetch('http://localhost:${(blocked.address() as any).port}/direct').then(()=>false,()=>true)`));
    check('redirect to unlisted host is rejected',await view.webContents.executeJavaScript(`fetch('${url}/redirect').then(()=>false,()=>true)`));
    check('no request reached blocked fixture',blockedHits.length === 0);
    manager.setBounds({x:0,y:0,width:0,height:0}); check('panel hides for app modal',view.getBounds().width === 0);
    const panelContents = view.webContents;
    await manager.setEnabled(installed.id,false);
    await assert.rejects(manager.open(installed.id));
    check('disable closes native view and prevents opening',panelContents.isDestroyed());
    manager.dispose(); manager = new ExtensionManager(win,root); await manager.restore();
    check('disabled state survives restore',manager.list()[0].enabled === false);
    await manager.setEnabled(installed.id,true); await manager.open(installed.id);
    check('re-enable opens again',win.contentView.children.some(v=>v instanceof WebContentsView));
    await manager.remove(installed.id);
    check('uninstall removes registry entry and snapshot',manager.list().length === 0 && !fsSync.existsSync(path.join(root,installed.id)));
    manager.dispose(); manager = new ExtensionManager(win,root); await manager.restore();
    check('uninstalled extension stays removed after restore',manager.list().length === 0);
    check('only intended fixture endpoints were called',hits.every(h=>['PATCH /status','POST /post','GET /redirect'].includes(h)));
    await fs.writeFile(path.join(root,'registry.json'),'{broken');
    manager = new ExtensionManager(win,root); await manager.restore();
    assert.throws(()=>manager!.list(), /registry.json/);
    await assert.rejects(manager.install(source,async()=>true));
    check('corrupt registry does not crash app or get overwritten by import',await fs.readFile(path.join(root,'registry.json'),'utf8') === '{broken');
    console.log(`Extension Electron integration: ${checks} checks passed`);
  } catch(e) { console.error(e); exitCode=1; }
  finally {
    clearTimeout(guard); manager?.dispose(); win?.destroy(); server.close(); blocked.close();
    await fs.rm(temp,{recursive:true,force:true}).catch(()=>{});
    app.exit(exitCode);
  }
});
