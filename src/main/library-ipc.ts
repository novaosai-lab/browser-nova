import { loginFillScript } from './login-fill';
import { BrowserWindow, ipcMain, safeStorage, dialog } from 'electron';
import { LibraryStore } from './library-store';
import { TabManager } from './tab-manager';
export function registerLibrary(win: BrowserWindow, tm: TabManager, root: string) {
  const store = new LibraryStore(root, {
    available: () => safeStorage.isEncryptionAvailable() && (process.platform !== 'linux' || safeStorage.getSelectedStorageBackend() !== 'basic_text'),
    encrypt: value => safeStorage.encryptString(value), decrypt: value => safeStorage.decryptString(value),
  });
  ipcMain.handle('library:action', async (event, action: string, data: any = {}) => {
    if (event.sender !== win.webContents || event.senderFrame !== win.webContents.mainFrame) throw new Error('Untrusted caller');
    if (action === 'state') return store.state();
    if (action === 'bookmark') store.bookmark(data.title, data.url);
    else if (action === 'saveLogin') store.saveLogin(data.url, data.username, data.password);
    else if (action === 'remove') store.remove(data.kind, data.id);
    else if (action === 'fill') {
      const row = store.login(data.id), tab = tm.getActiveTab();
      if (!tab || new URL(tab.view.webContents.getURL()).origin !== row.origin) throw new Error('Open a page on the saved origin before filling');
      if (tab.info.profile === 'isolated-test') throw new Error('Use the normal browsing profile');
      const result = await dialog.showMessageBox(win, { type: 'question', buttons: ['Cancel', 'Fill'], defaultId: 0, cancelId: 0,
        message: `Fill ${row.username} on ${row.origin}?`, detail: `${row.origin.startsWith('http:') ? 'HTTP is unencrypted. ' : ''}The page can read filled credentials. No form will be submitted.` });
      if (result.response !== 1) return store.state();
      if (tm.getActiveTab() !== tab || tab.view.webContents.isDestroyed()) throw new Error('Active tab changed');
      // Isolated world protects native DOM access from page overrides; origin is checked again inside the frame.
      const filled = await tab.view.webContents.executeJavaScriptInIsolatedWorld(999, [{ code: loginFillScript(row) }]);
      if (!filled) throw new Error('No unambiguous login form found on this page (iframes are not supported)');
    } else throw new Error('Unknown library action');
    return store.state();
  });
}
