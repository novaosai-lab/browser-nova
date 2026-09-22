import fs from 'node:fs/promises';
import path from 'node:path';

export interface PanelManifest {
  manifest_version: 3;
  name: string;
  version: string;
  host_permissions: string[];
  side_panel: { default_path: string };
  background?: { service_worker: string };
  [key: string]: unknown;
}

export function localPath(value: unknown): string {
  if (typeof value !== 'string' || !value || value.includes('\\') || value.includes('%') || value.includes('?') || value.includes('#') || path.posix.isAbsolute(value)
    || value.split('/').some(p => p === '..' || p === '.' || !p)) throw new Error('Extension path must be a relative file inside its folder');
  return value;
}

export function validateManifest(value: unknown): PanelManifest {
  const m = value as PanelManifest;
  if (!m || typeof m !== 'object' || Array.isArray(m) || m.manifest_version !== 3) throw new Error('รองรับ Manifest V3 Side Panel เท่านั้น');
  if (typeof m.name !== 'string' || !m.name.trim() || m.name.length > 100 || typeof m.version !== 'string' || !/^\d+(\.\d+){0,3}$/.test(m.version)) throw new Error('Invalid extension name/version');
  const allowed = new Set(['manifest_version','name','version','description','author','permissions','host_permissions','side_panel','action','background','icons']);
  for (const key of Object.keys(m)) if (!allowed.has(key)) throw new Error(`Manifest feature not supported: ${key}`);
  if (m.permissions !== undefined && (!Array.isArray(m.permissions) || m.permissions.some(p => p !== 'sidePanel'))) throw new Error('รองรับ permission sidePanel เท่านั้น');
  if (!m.side_panel || Object.keys(m.side_panel).some(k => k !== 'default_path')) throw new Error('ต้องมี side_panel.default_path');
  localPath(m.side_panel.default_path);
  if (!m.side_panel.default_path.endsWith('.html')) throw new Error('Side panel must be an HTML file');
  if (!Array.isArray(m.host_permissions) || m.host_permissions.length > 30 || m.host_permissions.some(p => typeof p !== 'string' || !/^https?:\/\/[a-zA-Z0-9](?:[a-zA-Z0-9.-]*[a-zA-Z0-9])?\/\*$/.test(p))) throw new Error('host_permissions ต้องเป็น HTTP/HTTPS ชื่อ host แบบเจาะจงและลงท้าย /* (ไม่รองรับ wildcard host)');
  for (const pattern of m.host_permissions) {
    const url = new URL(pattern);
    if (url.hostname !== pattern.split('/')[2].toLowerCase()) throw new Error('Invalid host permission');
  }
  if (m.background && (Object.keys(m.background).some(k => k !== 'service_worker') || !m.background.service_worker)) throw new Error('Background feature not supported');
  if (m.background) localPath(m.background.service_worker);
  if (m.action && (typeof m.action !== 'object' || Object.keys(m.action).some(k => k !== 'default_title'))) throw new Error('รองรับ action.default_title เท่านั้น');
  return m;
}

export function permitsUrl(patterns: string[], input: string): boolean {
  try {
    const url = new URL(input);
    if (url.username || url.password) return false;
    return patterns.some(pattern => {
      const allowed = new URL(pattern);
      return url.protocol === allowed.protocol && url.hostname === allowed.hostname;
    });
  } catch { return false; }
}

export async function inspectFolder(folder: string): Promise<PanelManifest> {
  const manifestFile = path.join(folder, 'manifest.json');
  if ((await fs.stat(manifestFile)).size > 64 * 1024) throw new Error('Manifest too large');
  const m = validateManifest(JSON.parse(await fs.readFile(manifestFile, 'utf8')));
  const panel = await fs.lstat(path.join(folder, m.side_panel.default_path));
  if (!panel.isFile()) throw new Error('Side panel file not found');
  if (m.background) {
    const file = path.join(folder, m.background.service_worker);
    if ((await fs.stat(file)).size > 4096) throw new Error('Background worker not supported');
    const code = (await fs.readFile(file, 'utf8')).replace(/\s/g, '');
    const call = 'chrome.sidePanel.setPanelBehavior({openPanelOnActionClick:true})';
    if (![call,call+';',call+'.catch((error)=>console.error(error));',call+'.catch((error)=>console.error(error))'].includes(code)) {
      throw new Error('รองรับ background เฉพาะ setPanelBehavior({ openPanelOnActionClick: true }); worker อื่นยังไม่รองรับ');
    }
  }
  return m;
}

// Snapshot imports: never execute a mutable external folder or follow symlinks.
export async function copyPanelFolder(source: string, dest: string) {
  const absoluteSource = await fs.realpath(source);
  const absoluteDest = path.resolve(dest);
  const relative = path.relative(absoluteSource, absoluteDest);
  if (!relative || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative))) throw new Error('Cannot import a folder containing extension storage');
  let count = 0, total = 0;
  async function copy(from: string, to: string, depth: number) {
    if (depth > 12) throw new Error('Extension folder too deep');
    await fs.mkdir(to, { recursive: true });
    for (const entry of await fs.readdir(from, { withFileTypes: true })) {
      if (++count > 2000) throw new Error('Extension has too many files');
      const input = path.join(from, entry.name), output = path.join(to, entry.name);
      const stat = await fs.lstat(input);
      if (stat.isSymbolicLink()) throw new Error('Symlinks are not supported in extensions');
      if (stat.isDirectory()) await copy(input, output, depth + 1);
      else if (stat.isFile()) {
        total += stat.size;
        if (total > 25 * 1024 * 1024) throw new Error('Extension exceeds 25 MB');
        await fs.copyFile(input, output);
      } else throw new Error('Unsupported file type');
    }
  }
  await copy(source, dest, 0);
}
