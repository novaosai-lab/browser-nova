import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Bookmark, SavedLogin, LibraryState } from '../shared/library-types';
export interface SecretCodec { available(): boolean; encrypt(value: string): Buffer; decrypt(value: Buffer): string; }
export function webUrl(value: string) {
  if (typeof value !== 'string' || value.length > 16384) throw new Error('Invalid URL');
  const url = new URL(value);
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error('Use an HTTP(S) URL without credentials');
  return url;
}
export class LibraryStore {
  constructor(private root: string, private codec: SecretCodec) { fs.mkdirSync(root, { recursive: true }); }
  private read(name: string): any[] {
    const file = path.join(this.root, name);
    if (!fs.existsSync(file)) return [];
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!Array.isArray(data)) throw new Error('Library file is invalid; restore a backup before editing');
    return data;
  }
  private write(name: string, rows: unknown[]) {
    const file = path.join(this.root, name), temp = `${file}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(rows), { mode: 0o600 });
    fs.renameSync(temp, file);
  }
  private logins(): (SavedLogin & { password: string })[] {
    if (!this.codec.available()) throw new Error('OS encrypted storage is unavailable');
    return this.read('logins.json').map(row => JSON.parse(this.codec.decrypt(Buffer.from(row, 'base64'))));
  }
  private writeLogins(rows: (SavedLogin & { password: string })[]) {
    this.write('logins.json', rows.map(row => this.codec.encrypt(JSON.stringify(row)).toString('base64')));
  }
  state(): LibraryState {
    return { bookmarks: this.read('bookmarks.json'), encryptionAvailable: this.codec.available(),
      logins: this.codec.available() ? this.logins().map(({ id, origin, username }) => ({ id, origin, username })) : [] };
  }
  bookmark(title: string, value: string) {
    const url = webUrl(value).href;
    if (typeof title !== 'string' || title.length > 1000) throw new Error('Invalid title');
    const rows: Bookmark[] = this.read('bookmarks.json');
    const row = rows.find(row => row.url === url);
    if (row) row.title = title || url;
    else rows.push({ id: randomUUID(), title: title || url, url });
    this.write('bookmarks.json', rows);
  }
  saveLogin(value: string, username: string, password: string) {
    const origin = webUrl(value).origin;
    if (typeof username !== 'string' || typeof password !== 'string' || !password || username.length > 1000 || password.length > 8192) throw new Error('Invalid login');
    const rows = this.logins();
    const old = rows.find(row => row.origin === origin && row.username === username);
    if (old) old.password = password;
    else rows.push({ id: randomUUID(), origin, username, password });
    this.writeLogins(rows);
  }
  remove(kind: 'bookmark' | 'login', id: string) {
    if (kind === 'bookmark') this.write('bookmarks.json', this.read('bookmarks.json').filter(row => row.id !== id));
    else if (kind === 'login') this.writeLogins(this.logins().filter(row => row.id !== id));
    else throw new Error('Invalid kind');
  }
  login(id: string) { const row = this.logins().find(row => row.id === id); if (!row) throw new Error('Login not found'); return row; }
}
