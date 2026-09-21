import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { UpdateController, type UpdateDriver } from '../../src/main/update-controller';

class FakeUpdater extends EventEmitter implements UpdateDriver {
  autoDownload = true;
  autoInstallOnAppQuit = true;
  allowDowngrade = true;
  allowPrerelease = true;
  checks = 0;
  downloads = 0;
  installs = 0;
  checkAction: () => Promise<unknown> = async () => {
    this.emit('update-available', { version: '0.2.0' });
    return {};
  };
  downloadAction: () => Promise<unknown> = async () => {
    this.emit('download-progress', { percent: 50 });
    this.emit('update-downloaded', { version: '0.2.0' });
    return [];
  };
  async checkForUpdates() { this.checks++; return this.checkAction(); }
  async downloadUpdate() { this.downloads++; return this.downloadAction(); }
  quitAndInstall() { this.installs++; }
}

test('local/dev builds cannot check, download, or install', async () => {
  const updates = new UpdateController(null, '0.1.0', 'local');
  assert.equal((await updates.check()).status, 'disabled');
  assert.equal((await updates.download()).status, 'disabled');
  assert.equal(updates.install(), false);
});

test('requires download then explicit installation; no downgrade/prerelease or quit-time install', async () => {
  const driver = new FakeUpdater();
  const updates = new UpdateController(driver, '0.1.0');
  assert.equal(driver.autoDownload, false);
  assert.equal(driver.autoInstallOnAppQuit, false);
  assert.equal(driver.allowDowngrade, false);
  assert.equal(driver.allowPrerelease, false);
  await updates.download();
  assert.equal(driver.downloads, 0);
  assert.equal(updates.install(), false);
  assert.equal((await updates.check()).status, 'available');
  assert.equal(driver.downloads, 0);
  const percentages: number[] = [];
  updates.on('changed', state => { if (state.percent !== undefined) percentages.push(state.percent); });
  assert.equal((await updates.download()).status, 'downloaded');
  assert.ok(percentages.includes(50));
  assert.equal(driver.installs, 0);
  await updates.check();
  assert.equal(driver.checks, 1, 'checking again must preserve a downloaded update');
  assert.equal(updates.install(), true);
  assert.equal(updates.install(), false);
  assert.equal(driver.installs, 1);
});

test('duplicate checks and downloads are coalesced while requests are pending', async () => {
  const driver = new FakeUpdater();
  const updates = new UpdateController(driver, '0.1.0');
  let finishCheck!: () => void;
  driver.checkAction = () => new Promise(resolve => { finishCheck = () => {
    driver.emit('update-available', { version: '0.2.0' }); resolve({});
  }; });
  const first = updates.check();
  await updates.check();
  assert.equal(driver.checks, 1);
  finishCheck(); await first;
  let finishDownload!: () => void;
  driver.downloadAction = () => new Promise(resolve => { finishDownload = () => {
    driver.emit('update-downloaded', { version: '0.2.0' }); resolve([]);
  }; });
  const downloading = updates.download();
  await updates.download(); await updates.check();
  assert.equal(driver.downloads, 1);
  assert.equal(driver.checks, 1);
  assert.equal(updates.install(), false);
  finishDownload(); await downloading;
  assert.equal(updates.getState().status, 'downloaded');
});

test('network/feed errors can retry and no-update clears stale version', async () => {
  const driver = new FakeUpdater();
  const updates = new UpdateController(driver, '0.1.0');
  driver.checkAction = async () => { throw new Error('network'); };
  assert.equal((await updates.check()).status, 'error');
  driver.checkAction = async () => { driver.emit('update-not-available', { version: '0.1.0' }); return {}; };
  const state = await updates.check();
  assert.equal(state.status, 'not-available');
  assert.ok(state.lastCheckedAt);
  assert.equal(state.availableVersion, undefined);
});

test('failed or cancelled downloads cannot install and must check again', async () => {
  const driver = new FakeUpdater();
  const updates = new UpdateController(driver, '0.1.0');
  await updates.check();
  driver.downloadAction = async () => { driver.emit('error', new Error('signature/checksum mismatch')); throw new Error('failed'); };
  assert.equal((await updates.download()).status, 'error');
  assert.equal(updates.install(), false);
  await updates.download();
  assert.equal(driver.downloads, 1);
  await updates.check();
  driver.downloadAction = async () => { driver.emit('update-cancelled'); return []; };
  assert.equal((await updates.download()).status, 'error');
});

test('asynchronous installer errors leave a retryable state and never report success', async () => {
  const driver = new FakeUpdater();
  const updates = new UpdateController(driver, '0.1.0');
  await updates.check(); await updates.download(); updates.install();
  driver.emit('error', new Error('native installer failed'));
  assert.equal(updates.getState().status, 'error');
  assert.equal(updates.install(), false);
});
