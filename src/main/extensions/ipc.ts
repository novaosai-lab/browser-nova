import { BrowserWindow, dialog, ipcMain } from 'electron';
import { ExtensionManager } from './manager';
import { IPC_CHANNELS as C } from '../../shared/ipc-channels';

export function registerExtensionIpc(win: BrowserWindow, manager: ExtensionManager) {
  let importing = false;
  const handle = (channel: string, action: (...args: any[]) => unknown) => ipcMain.handle(channel, (event, ...args) => {
    if (event.sender !== win.webContents || event.senderFrame !== win.webContents.mainFrame) throw new Error('Extensions are managed only by the app shell');
    return action(...args);
  });
  const checkId = (id: unknown): string => {
    if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/.test(id)) throw new Error('Invalid extension ID');
    return id;
  };
  handle(C.EXTENSIONS_LIST, () => manager.list());
  handle(C.EXTENSIONS_IMPORT, async () => {
    if (importing) throw new Error('กำลังโหลดส่วนขยายอยู่');
    importing = true;
    try {
      const selected = await dialog.showOpenDialog(win, { title: 'เลือกโฟลเดอร์ Side Panel Extension', properties: ['openDirectory'] });
      if (selected.canceled || !selected.filePaths[0]) return null;
      return await manager.serial(() => manager.install(selected.filePaths[0], async manifest => {
        const result = await dialog.showMessageBox(win, {
          type: 'question', title: 'เพิ่ม Side Panel Extension', message: `${manifest.name} ${manifest.version}`,
          detail: `ส่วนขยายนี้อ่านและส่งข้อมูลไปยัง:\n${manifest.host_permissions.join('\n') || '(ไม่มีสิทธิ์เครือข่าย)'}\n\nทำงานในโปรไฟล์แยก ไม่ใช้ cookies ของแท็บหลัก รองรับหน้า Side Panel และปุ่มเปิดแผงเท่านั้น ไม่รัน background worker ทั่วไป`,
          buttons: ['ยกเลิก', 'เพิ่มส่วนขยาย'], defaultId: 0, cancelId: 0, noLink: true,
        });
        return result.response === 1;
      }));
    } finally { importing = false; }
  });
  handle(C.EXTENSIONS_OPEN, id => manager.serial(() => manager.open(checkId(id))));
  handle(C.EXTENSIONS_CLOSE, () => manager.serial(async () => manager.close()));
  handle(C.EXTENSIONS_BOUNDS, bounds => manager.setBounds(bounds));
  handle(C.EXTENSIONS_ENABLE, (id, enabled) => manager.serial(() => manager.setEnabled(checkId(id), enabled)));
  handle(C.EXTENSIONS_REMOVE, id => manager.serial(() => manager.remove(checkId(id))));
}
