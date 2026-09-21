import esbuild from 'esbuild';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const commonConfig = {
  bundle: true,
  platform: 'node',
  target: 'node20',
  sourcemap: true,
  external: ['electron', 'electron-updater'],
  format: 'esm',
};

async function build() {
  console.log('Building Electron Main, Preload, Fixtures, and CLI...');

  // 1. Build Main Process
  await esbuild.build({
    ...commonConfig,
    entryPoints: [path.resolve(root, 'src/main/index.ts')],
    outfile: path.resolve(root, 'dist/main/index.js'),
    banner: {
      js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
    },
  });

  // 2. Build Preload Bridge (CommonJS / CJS is standard for electron preload to avoid sandbox issues)
  await esbuild.build({
    bundle: true,
    platform: 'node',
    target: 'node20',
    sourcemap: true,
    external: ['electron'],
    format: 'cjs',
    entryPoints: [path.resolve(root, 'src/preload/index.ts')],
    outfile: path.resolve(root, 'dist/preload/index.cjs'),
  });

  // 3. Build Test Fixtures Server
  await esbuild.build({
    ...commonConfig,
    entryPoints: [path.resolve(root, 'tests/fixtures/server.ts')],
    outfile: path.resolve(root, 'dist/fixtures/server.js'),
    banner: {
      js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
    },
  });

  // 4. Build CLI
  await esbuild.build({
    ...commonConfig,
    entryPoints: [path.resolve(root, 'packages/cli/bin.ts')],
    outfile: path.resolve(root, 'dist/packages/cli/bin.js'),
    banner: {
      js: "#!/usr/bin/env node\nimport { createRequire } from 'module'; const require = createRequire(import.meta.url);",
    },
  });

  // 5. Build Smoke Test
  await esbuild.build({
    ...commonConfig,
    entryPoints: [path.resolve(root, 'tests/e2e/smoke-test.ts')],
    outfile: path.resolve(root, 'dist/tests/smoke-test.js'),
    banner: {
      js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
    },
  });

  // 6. Build Unit Tests (network-free)
  await esbuild.build({
    ...commonConfig,
    entryPoints: [path.resolve(root, 'tests/unit/unit-test.ts')],
    outfile: path.resolve(root, 'dist/tests/unit-test.js'),
    banner: {
      js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
    },
  });

  await esbuild.build({
    ...commonConfig,
    entryPoints: [path.resolve(root, 'tests/unit/update-test.ts')],
    outfile: path.resolve(root, 'dist/tests/update-test.js'),
  });

  console.log('Build completed successfully.');
}

build().catch((err) => {
  console.error('Build failed:', err);
  process.exit(1);
});
