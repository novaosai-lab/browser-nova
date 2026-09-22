import { BrowserWindow, WebContentsView, session, type Session } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { SideExtension } from '../../shared/extension-types';
import type { Bounds } from '../../shared/types';
import { copyPanelFolder, inspectFolder, permitsUrl, validateManifest, type PanelManifest } from './manifest';

type Entry = { info: SideExtension; manifest: PanelManifest | null; session?: Session; nativeId?: string; view?: WebContentsView };
export class ExtensionManager {
  private entries = new Map<string, Entry>();
  private current?: string;
  private startupError?: string;
  private bounds: Bounds = { x: 0, y: 0, width: 0, height: 0 };
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private win: BrowserWindow, private root: string, private changed: () => void = () => {}) {}
  public serial<T>(action: () => Promise<T>): Promise<T> {
    const result = this.queue.then(action);
    this.queue = result.catch(() => {});
    return result;
  }
  public list(): SideExtension[] {
    if (this.startupError) throw new Error(this.startupError);
    return [...this.entries.values()].map(e => ({ ...e.info, hosts: [...e.info.hosts] })); }
  private folder(id: string) { return path.join(this.root, id); }
  private async save() {
    const temp = path.join(this.root, 'registry.tmp');
    await fs.writeFile(temp, JSON.stringify(this.list().map(({ id, enabled }) => ({ id, enabled }))), { mode: 0o600 });
    await fs.rename(temp, path.join(this.root, 'registry.json'));
    this.changed();
  }
  public async restore() {
    try { await this.readRegistry(); }
    catch { this.startupError = 'อ่านรายการส่วนขยายไม่สำเร็จ — เก็บไฟล์เดิมไว้แล้ว กรุณาตรวจ side-extensions/registry.json ก่อนโหลดเพิ่ม'; }
  }
  private async readRegistry() {
    await fs.mkdir(this.root, { recursive: true, mode: 0o700 });
    let records: unknown;
    try { records = JSON.parse(await fs.readFile(path.join(this.root, 'registry.json'), 'utf8')); }
    catch (e: any) { if (e.code !== 'ENOENT') throw new Error('Cannot read extension registry'); return; }
    if (!Array.isArray(records) || records.length > 100) throw new Error('Invalid extension registry');
    for (const r of records) {
      if (typeof r?.id !== 'string' || !/^[0-9a-f-]{36}$/.test(r.id) || typeof r.enabled !== 'boolean') throw new Error('Invalid extension record');
      try {
        const m = validateManifest(JSON.parse(await fs.readFile(path.join(this.folder(r.id), 'nova-source-manifest.json'), 'utf8')));
        this.entries.set(r.id, { manifest: m, info: { id: r.id, name: m.name, version: m.version, hosts: m.host_permissions, enabled: r.enabled } });
      } catch {
        this.entries.set(r.id, { manifest: null, info: { id: r.id, name: 'Unavailable extension', version: '', hosts: [], enabled: false, error: 'ไฟล์ส่วนขยายไม่ครบ กรุณาถอนแล้วโหลดใหม่' } });
      }
    }
    this.changed();
  }
  public async install(source: string, approve: (manifest: PanelManifest) => Promise<boolean>): Promise<SideExtension | null> {
    if (this.startupError) throw new Error(this.startupError);
    if (this.entries.size >= 100) throw new Error('Extension limit reached');
    const id = randomUUID(), folder = this.folder(id);
    await fs.mkdir(this.root, { recursive: true, mode: 0o700 });
    try {
      await copyPanelFolder(source, folder);
      const manifest = await inspectFolder(folder);
      if (!await approve(manifest)) { await fs.rm(folder, { recursive: true, force: true }); return null; }
      // Side-panel hosting is implemented by Nova; arbitrary service workers are never run.
      await fs.writeFile(path.join(folder, 'nova-source-manifest.json'), JSON.stringify(manifest));
      await fs.writeFile(path.join(folder, 'manifest.json'), JSON.stringify({ manifest_version: 3, name: manifest.name, version: manifest.version, host_permissions: manifest.host_permissions }));
      const entry: Entry = { manifest, info: { id, name: manifest.name, version: manifest.version, hosts: manifest.host_permissions, enabled: true } };
      this.entries.set(id, entry);
      await this.load(entry);
      await this.save();
      return { ...entry.info };
    } catch (e) {
      const entry = this.entries.get(id);
      if (entry) this.unload(entry);
      this.entries.delete(id);
      await fs.rm(folder, { recursive: true, force: true });
      throw e;
    }
  }
  private async load(entry: Entry) {
    if (entry.nativeId) return;
    if (!entry.manifest) throw new Error('Extension files unavailable');
    const ses = entry.session || session.fromPartition(`persist:nova-side-extension-${entry.info.id}`);
    if (!entry.session) {
      entry.session = ses;
      ses.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
      ses.setPermissionCheckHandler(() => false);
      ses.on('will-download', event => event.preventDefault());
      // Runs on every redirect as well; extensions cannot reach app files or other profiles.
      ses.webRequest.onBeforeRequest((details, callback) => {
        let own = false;
        try { const url = new URL(details.url); own = url.protocol === 'chrome-extension:' && url.hostname === entry.nativeId; } catch {}
        callback({ cancel: !entry.info.enabled || (!own && !permitsUrl(entry.info.hosts, details.url)) });
      });
    }
    const native = await ses.loadExtension(this.folder(entry.info.id));
    entry.nativeId = native.id;
  }
  public async open(id: string) {
    const entry = this.entries.get(id);
    if (!entry?.info.enabled) throw new Error('ส่วนขยายปิดอยู่หรือไม่พบ');
    if (!entry.manifest) throw new Error('Extension files unavailable');
    this.close();
    try {
      await this.load(entry);
      const view = new WebContentsView({ webPreferences: { session: entry.session, nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true } });
      entry.view = view;
      const url = `chrome-extension://${entry.nativeId}/${entry.manifest.side_panel.default_path}`;
      view.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
      view.webContents.on('will-navigate', event => event.preventDefault());
      view.webContents.on('will-frame-navigate', event => event.preventDefault());
      view.webContents.on('will-attach-webview', event => event.preventDefault());
      view.webContents.on('render-process-gone', () => { entry.info.error = 'แผงส่วนขยายหยุดทำงาน กรุณาเปิดใหม่'; this.close(); this.changed(); });
      this.current = id;
      this.win.contentView.addChildView(view);
      view.setBounds(this.bounds);
      await view.webContents.loadURL(url);
      entry.info.error = undefined;
      this.changed();
    } catch (e) { this.close(); entry.info.error = 'เปิดส่วนขยายไม่สำเร็จ'; this.changed(); throw e; }
  }
  public setBounds(bounds: Bounds) {
    const size = this.win.getContentBounds();
    if (!bounds || !['x','y','width','height'].every(key => Number.isInteger(bounds[key as keyof Bounds]) && bounds[key as keyof Bounds] >= 0)) throw new Error('Invalid extension bounds');
    this.bounds = { x: Math.min(bounds.x, size.width), y: Math.min(bounds.y, size.height), width: Math.min(bounds.width, Math.max(0, size.width - bounds.x)), height: Math.min(bounds.height, Math.max(0, size.height - bounds.y)) };
    const view = this.current ? this.entries.get(this.current)?.view : undefined;
    if (view) view.setBounds(this.bounds);
  }
  public close() {
    const entry = this.current ? this.entries.get(this.current) : undefined;
    this.current = undefined;
    if (entry?.view) {
      const view = entry.view; entry.view = undefined;
      if (!this.win.isDestroyed()) this.win.contentView.removeChildView(view);
      if (!view.webContents.isDestroyed()) view.webContents.close();
    }
  }
  private unload(entry: Entry) {
    if (this.current === entry.info.id) this.close();
    if (entry.nativeId) entry.session?.removeExtension(entry.nativeId);
    entry.nativeId = undefined;
  }
  public async setEnabled(id: string, enabled: boolean) {
    const entry = this.entries.get(id);
    if (!entry || typeof enabled !== 'boolean') throw new Error('Invalid extension');
    if (!entry.manifest) throw new Error('ถอนส่วนขยายที่ไฟล์หายแล้วโหลดใหม่');
    entry.info.enabled = enabled;
    entry.info.error = undefined;
    if (!enabled) this.unload(entry);
    await this.save();
  }
  public async remove(id: string) {
    const entry = this.entries.get(id);
    if (!entry) throw new Error('Extension not found');
    entry.info.enabled = false;
    this.unload(entry);
    const ses = entry.session || session.fromPartition(`persist:nova-side-extension-${id}`);
    await ses.clearStorageData(); await ses.clearCache();
    this.entries.delete(id);
    await this.save();
    await fs.rm(this.folder(id), { recursive: true, force: true });
  }
  public dispose() { this.close(); for (const entry of this.entries.values()) this.unload(entry); }
}
