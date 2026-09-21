function getPublishConfig(env) {
  const repository = env.NOVA_GITHUB_REPOSITORY || 'novaosai-lab/browser-nova';
  if (env.NOVA_UPDATE_URL) {
    if (env.NOVA_GITHUB_REPOSITORY) throw new Error('Choose NOVA_UPDATE_URL or NOVA_GITHUB_REPOSITORY, not both');
    const url = new URL(env.NOVA_UPDATE_URL);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
      throw new Error('NOVA_UPDATE_URL must be a public HTTPS directory without credentials, query, or fragment');
    }
    if (!url.pathname.endsWith('/')) url.pathname += '/';
    return [{ provider: 'generic', url: url.toString() }];
  }
  if (!/^[a-zA-Z0-9][a-zA-Z0-9-]*\/[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(repository)) {
    throw new Error('NOVA_GITHUB_REPOSITORY must be OWNER/REPO');
  }
  const [owner, repo] = repository.split('/');
  return [{ provider: 'github', owner, repo, releaseType: 'release' }];
}

function assertReleaseCredentials(env) {
  if (!env.CSC_LINK && !env.CSC_NAME?.startsWith('Developer ID Application:')) {
    throw new Error('Release requires a Developer ID Application certificate via CSC_NAME or CSC_LINK');
  }
  const appleId = env.APPLE_ID && env.APPLE_APP_SPECIFIC_PASSWORD && env.APPLE_TEAM_ID;
  const apiKey = env.APPLE_API_KEY && env.APPLE_API_KEY_ID && env.APPLE_API_ISSUER;
  const keychain = env.APPLE_KEYCHAIN_PROFILE;
  if (!appleId && !apiKey && !keychain) throw new Error('Release requires Apple notarization credentials (see RELEASE.md)');
}

function createBuildConfig(env = process.env) {
  const release = env.NOVA_RELEASE === '1';
  if (release) assertReleaseCredentials(env);
  return {
    appId: 'ai.novaos.browser-nova',
    productName: 'Browser Nova',
    directories: { output: release ? 'release/production' : 'release/local', buildResources: 'build' },
    artifactName: 'Browser-Nova-${version}-${arch}.${ext}',
    asar: true,
    npmRebuild: false,
    files: ['dist/main/**', 'dist/preload/**', 'dist/renderer/**', 'package.json', '!**/*.map'],
    extraMetadata: { novaRelease: { updatesEnabled: release, distribution: release ? 'release' : 'local' } },
    publish: release ? getPublishConfig(env) : null,
    forceCodeSigning: release,
    mac: {
      target: ['dmg', 'zip'],
      category: 'public.app-category.developer-tools',
      minimumSystemVersion: '11.0.0',
      identity: release ? env.CSC_NAME : '-',
      hardenedRuntime: release,
      notarize: release,
      entitlements: 'build/entitlements.mac.plist',
      entitlementsInherit: 'build/entitlements.mac.plist',
      electronUpdaterCompatibility: '>=2.16',
    },
    dmg: {
      title: 'Browser Nova ${version}',
      contents: [{ x: 140, y: 180 }, { x: 420, y: 180, type: 'link', path: '/Applications' }],
    },
  };
}

module.exports = { createBuildConfig, getPublishConfig, assertReleaseCredentials };
