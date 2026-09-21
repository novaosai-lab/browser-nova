import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

// 1. Build main & preload first
const build = spawn('node', ['scripts/build.mjs'], { cwd: root, stdio: 'inherit' });

build.on('close', (code) => {
  if (code !== 0) {
    console.error('Initial build failed');
    process.exit(code);
  }

  // 2. Start Vite Dev Server
  const vite = spawn('npx', ['vite', '--port', '5173'], {
    cwd: root,
    stdio: 'inherit',
    shell: true,
  });

  // 3. Wait a moment for Vite, then start Electron with VITE_DEV_SERVER_URL
  setTimeout(() => {
    const electron = spawn('npx', ['electron', 'dist/main/index.js'], {
      cwd: root,
      stdio: 'inherit',
      env: { ...process.env, VITE_DEV_SERVER_URL: 'http://localhost:5173' },
      shell: true,
    });

    electron.on('close', () => {
      vite.kill();
      process.exit(0);
    });
  }, 2000);
});
