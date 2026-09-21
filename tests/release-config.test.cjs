const test = require('node:test');
const assert = require('node:assert/strict');
const { createBuildConfig, getPublishConfig } = require('../scripts/release-config.cjs');

test('local packages cannot advertise working updates or publish a feed', () => {
  const config = createBuildConfig({});
  assert.equal(config.publish, null);
  assert.equal(config.extraMetadata.novaRelease.updatesEnabled, false);
  assert.equal(config.mac.identity, '-');
  assert.deepEqual(config.mac.target, ['dmg', 'zip']);
});

test('production fails before building without distribution and notarization credentials', () => {
  assert.throws(() => createBuildConfig({ NOVA_RELEASE: '1' }), /Developer ID/);
  assert.throws(() => createBuildConfig({ NOVA_RELEASE: '1', CSC_NAME: 'Apple Development: Example' }), /Developer ID/);
  assert.throws(() => createBuildConfig({ NOVA_RELEASE: '1', CSC_NAME: 'Developer ID Application: Example' }), /notarization/);
});

test('signed builds pin a public repository without embedding credentials', () => {
  const config = createBuildConfig({
    NOVA_RELEASE: '1', CSC_LINK: '/tmp/certificate.p12', CSC_KEY_PASSWORD: 'not-a-real-password',
    APPLE_ID: 'test@example.com', APPLE_APP_SPECIFIC_PASSWORD: 'test', APPLE_TEAM_ID: 'TEST',
    NOVA_GITHUB_REPOSITORY: 'novaosai-lab/browser-nova', GH_TOKEN: 'never-embed-this',
  });
  assert.equal(config.extraMetadata.novaRelease.updatesEnabled, true);
  assert.equal(config.forceCodeSigning, true);
  assert.equal(config.mac.notarize, true);
  assert.equal(config.publish[0].owner, 'novaosai-lab');
  assert.equal(config.publish[0].repo, 'browser-nova');
  assert.ok(!JSON.stringify(config).includes('never-embed-this'));
  assert.ok(!JSON.stringify(config).includes('not-a-real-password'));
});

test('feed input rejects HTTP, credentials, ambiguous providers, and malformed repositories', () => {
  for (const url of ['http://updates.example.com', 'https://user:secret@updates.example.com', 'https://updates.example.com?token=secret']) {
    assert.throws(() => getPublishConfig({ NOVA_UPDATE_URL: url }));
  }
  assert.throws(() => getPublishConfig({ NOVA_GITHUB_REPOSITORY: 'bad/repo/extra' }));
  assert.throws(() => getPublishConfig({ NOVA_GITHUB_REPOSITORY: 'owner/repo', NOVA_UPDATE_URL: 'https://updates.example.com' }));
  assert.equal(getPublishConfig({ NOVA_UPDATE_URL: 'https://updates.example.com/mac' })[0].url, 'https://updates.example.com/mac/');
});
