import { EventEmitter } from 'node:events';
import type { UpdateState } from '../shared/update-types';

// Keep the state machine independent of Electron so races and failure paths can
// be tested without downloading or installing an actual release.
export interface UpdateDriver {
  autoDownload: boolean;
  autoInstallOnAppQuit: boolean;
  allowDowngrade: boolean;
  allowPrerelease: boolean;
  on(event: string, listener: (...args: any[]) => void): unknown;
  checkForUpdates(): Promise<unknown>;
  downloadUpdate(): Promise<unknown>;
  quitAndInstall(): void;
}

export class UpdateController extends EventEmitter {
  private state: UpdateState;
  private busy = false;

  constructor(private driver: UpdateDriver | null, version: string, disabledReason?: string) {
    super();
    this.state = {
      currentVersion: version,
      status: driver ? 'idle' : 'disabled',
      message: driver ? 'พร้อมตรวจสอบเวอร์ชันใหม่' : disabledReason || 'ยังไม่ได้เปิดใช้งานระบบอัปเดต',
    };
    if (!driver) return;
    driver.autoDownload = false;
    driver.autoInstallOnAppQuit = false;
    driver.allowDowngrade = false;
    driver.allowPrerelease = false;
    driver.on('checking-for-update', () => this.set({ status: 'checking', message: 'กำลังตรวจสอบอัปเดต…' }));
    driver.on('update-available', (info: { version: string }) => this.set({
      status: 'available', availableVersion: info.version, percent: undefined,
      message: `มีเวอร์ชัน ${info.version} พร้อมดาวน์โหลด`, lastCheckedAt: new Date().toISOString(),
    }));
    driver.on('update-not-available', () => this.set({
      status: 'not-available', availableVersion: undefined, percent: undefined,
      message: 'คุณใช้เวอร์ชันล่าสุดแล้ว', lastCheckedAt: new Date().toISOString(),
    }));
    driver.on('download-progress', (progress: { percent: number }) => {
      if (this.state.status !== 'downloading') return;
      const percent = Number.isFinite(progress.percent) ? Math.min(100, Math.max(0, progress.percent)) : 0;
      this.set({ percent, message: `กำลังดาวน์โหลด ${Math.round(percent)}%` });
    });
    driver.on('update-downloaded', (info: { version: string }) => this.set({
      status: 'downloaded', availableVersion: info.version, percent: 100,
      message: `เวอร์ชัน ${info.version} พร้อมติดตั้งเมื่อคุณรีสตาร์ตแอป`,
    }));
    driver.on('error', () => this.fail());
    driver.on('update-cancelled', () => this.fail());
  }

  getState(): UpdateState { return { ...this.state }; }

  private set(next: Partial<UpdateState>) {
    this.state = { ...this.state, ...next };
    this.emit('changed', this.getState());
  }

  private fail() {
    this.set({ status: 'error', percent: undefined, message: 'อัปเดตไม่สำเร็จ ตรวจสอบอินเทอร์เน็ตแล้วกดตรวจสอบอีกครั้ง' });
  }

  async check(): Promise<UpdateState> {
    if (!this.driver || this.busy || ['downloaded', 'installing'].includes(this.state.status)) return this.getState();
    this.busy = true;
    this.set({ status: 'checking', message: 'กำลังตรวจสอบอัปเดต…', availableVersion: undefined, percent: undefined });
    try {
      const result = await this.driver.checkForUpdates();
      if (!result && this.state.status === 'checking') this.fail();
    } catch { this.fail(); }
    finally { this.busy = false; }
    return this.getState();
  }

  async download(): Promise<UpdateState> {
    if (!this.driver || this.busy || this.state.status !== 'available') return this.getState();
    this.busy = true;
    this.set({ status: 'downloading', percent: 0, message: 'กำลังดาวน์โหลด…' });
    try { await this.driver.downloadUpdate(); }
    catch { this.fail(); }
    finally { this.busy = false; }
    return this.getState();
  }

  install(): boolean {
    if (!this.driver || this.busy || this.state.status !== 'downloaded') return false;
    this.set({ status: 'installing', message: 'กำลังรีสตาร์ตเพื่อติดตั้งอัปเดต…' });
    try { this.driver.quitAndInstall(); return true; }
    catch { this.fail(); return false; }
  }
}
