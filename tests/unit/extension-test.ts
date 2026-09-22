import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { validateManifest, permitsUrl, inspectFolder, copyPanelFolder } from '../../src/main/extensions/manifest';
const base = { manifest_version: 3, name: 'Fixture panel', version: '1.0', permissions: ['sidePanel'], host_permissions: ['http://127.0.0.1/*'], side_panel: { default_path: 'panel.html' } };
test('supported side-panel subset and unsafe manifest inputs', () => {
  assert.equal(validateManifest(base).name, 'Fixture panel');
  for (const patch of [{ manifest_version: 2 }, { permissions: ['tabs'] }, { host_permissions: ['<all_urls>'] }, { host_permissions: ['http://*.example.com/*'] }, { content_scripts: [] }, { side_panel: { default_path: '../outside.html' } }, { side_panel: { default_path: '%2e%2e/outside.html' } }, { action: { default_popup: 'popup.html' } }]) assert.throws(() => validateManifest({ ...base, ...patch }));
});
test('host boundary rejects different scheme, suffix tricks, credentials and file access', () => {
  const hosts = ['http://example.test/*'];
  assert.equal(permitsUrl(hosts, 'http://example.test:8080/a'), true);
  for (const url of ['https://example.test/a','http://example.test.evil/a','http://user:secret@example.test/a','file:///etc/hosts','data:text/html,hi']) assert.equal(permitsUrl(hosts, url), false);
});
test('import accepts the side-panel bootstrap but rejects arbitrary workers and symlinks', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'nova-extension-unit-'));
  try {
    const source = path.join(root, 'source'); await fs.mkdir(source);
    await fs.writeFile(path.join(source, 'manifest.json'), JSON.stringify({ ...base, background: { service_worker: 'background.js' } }));
    await fs.writeFile(path.join(source, 'panel.html'), '<h1>Fixture</h1>');
    await fs.writeFile(path.join(source, 'background.js'), 'chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((error) => console.error(error));');
    const copy = path.join(root, 'copy'); await copyPanelFolder(source, copy);
    assert.equal((await inspectFolder(copy)).name, 'Fixture panel');
    await fs.writeFile(path.join(copy, 'background.js'), 'fetch("https://example.test")');
    await assert.rejects(inspectFolder(copy), /Background|background/);
    await fs.symlink(path.join(source, 'panel.html'), path.join(source, 'linked.html'));
    await assert.rejects(copyPanelFolder(source, path.join(root, 'symlink-copy')), /Symlinks/);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});
