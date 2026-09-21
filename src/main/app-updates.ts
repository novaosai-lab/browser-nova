import { app, BrowserWindow, dialog, ipcMain, Notification } from 'electron';
import electronUpdater from 'electron-updater';
import fs from 'node:fs';
import path from 'node:path';
import { IPC_CHANNELS } from '../shared/ipc-channels';
import type { UpdateState } from '../shared/update-types';
import { UpdateController } from './update-controller';

export function setupAppUpdates(getWindow: () => BrowserWindow | null) {
  let enabled = false;
  if (app.isPackaged) {
    try {
      const metadata = JSON.parse(fs.readFileSync(path.join(app.getAppPath(), 'package.json'), 'utf8'));
      enabled = metadata.novaRelease?.updatesEnabled === true
        && fs.existsSync(path.join(process.resourcesPath, 'app-update.yml'));
    } catch { /* Local packages intentionally have no feed. */ }
  }

  const controller = new UpdateController(enabled ? electronUpdater.autoUpdater : null, app.getVersion(),
    app.isPackaged
      ? 'Build สำหรับทดสอบในเครื่อง — ยังไม่ได้ตั้งแหล่งอัปเดตและลงนามสำหรับแจกจ่าย'
      : 'โหมดพัฒนา — ระบบอัปเดตใช้ได้ในแอปที่ติดตั้งจาก release');

  let dialogOpen = false;
  let installPromptOpen = false;
  const confirmInstall = async () => {
    if (installPromptOpen || controller.getState().status !== 'downloaded') return false;
    installPromptOpen = true;
    try {
      const answer = await dialog.showMessageBox({
        type: 'question', title: 'อัปเดต Browser Nova',
        message: 'รีสตาร์ตเพื่อติดตั้งอัปเดต?',
        detail: 'แอปจะปิดแท็บและงาน automation ที่กำลังทำอยู่ กรุณาบันทึกงานก่อนดำเนินการ',
        buttons: ['ไว้ภายหลัง', 'รีสตาร์ตและติดตั้ง'], defaultId: 0, cancelId: 0, noLink: true,
      });
      return answer.response === 1 && controller.install();
    } finally { installPromptOpen = false; }
  };

  const showUpdates = async () => {
    if (dialogOpen) return;
    dialogOpen = true;
    try {
      let state = controller.getState();
      if (['idle', 'not-available', 'error'].includes(state.status)) state = await controller.check();
      const action = state.status === 'available' ? 'ดาวน์โหลดอัปเดต'
        : state.status === 'downloaded' ? 'รีสตาร์ตและติดตั้ง' : null;
      const answer = await dialog.showMessageBox({
        type: state.status === 'error' ? 'warning' : 'info',
        title: 'อัปเดต Browser Nova', message: state.message,
        detail: `เวอร์ชันปัจจุบัน ${state.currentVersion}\nดูสถานะและความคืบหน้าได้ใน Settings → อัปเดตแอป`,
        buttons: action ? ['ไว้ภายหลัง', action] : ['ตกลง'], defaultId: 0, cancelId: 0, noLink: true,
      });
      if (answer.response === 1 && state.status === 'available') void controller.download();
      if (answer.response === 1 && state.status === 'downloaded') await confirmInstall();
    } finally { dialogOpen = false; }
  };

  const sendState = (state: UpdateState) => {
    const win = getWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send(IPC_CHANNELS.UPDATES_CHANGED, state);
      win.setProgressBar(state.status === 'downloading' ? (state.percent ?? 0) / 100 : -1);
    }
  };
  let notifiedVersion = '';
  controller.on('changed', (state: UpdateState) => {
    sendState(state);
    if (['available', 'downloaded'].includes(state.status) && Notification.isSupported()) {
      const key = `${state.status}:${state.availableVersion}`;
      if (key === notifiedVersion) return;
      notifiedVersion = key;
      const notification = new Notification({ title: 'Browser Nova', body: state.message });
      notification.on('click', () => { getWindow()?.show(); void showUpdates(); });
      notification.show();
    }
  });

  // Remote pages never receive this bridge. Also require the shell's main frame
  // so a subframe cannot request downloads or restart the application.
  const handle = (channel: string, action: () => unknown) => ipcMain.handle(channel, (event) => {
    const win = getWindow();
    if (!win || event.sender !== win.webContents || event.senderFrame !== win.webContents.mainFrame) {
      throw new Error('Update action is only available to the app shell');
    }
    return action();
  });
  handle(IPC_CHANNELS.UPDATES_GET_STATE, () => controller.getState());
  handle(IPC_CHANNELS.UPDATES_CHECK, () => controller.check());
  handle(IPC_CHANNELS.UPDATES_DOWNLOAD, () => controller.download());
  handle(IPC_CHANNELS.UPDATES_INSTALL, confirmInstall);

  const periodicCheck = () => {
    if (['idle', 'not-available', 'error'].includes(controller.getState().status)) void controller.check();
  };
  const initialTimer = enabled ? setTimeout(periodicCheck, 10_000) : undefined;
  const repeatTimer = enabled ? setInterval(periodicCheck, 6 * 60 * 60 * 1000) : undefined;
  initialTimer?.unref();
  repeatTimer?.unref();
  app.once('before-quit', () => { clearTimeout(initialTimer); clearInterval(repeatTimer); });
  return { showUpdates };
}
