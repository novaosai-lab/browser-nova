import builder from 'electron-builder';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createRequire } from 'node:module';
import { writeChecksums } from './write-checksums.mjs';

const require = createRequire(import.meta.url);
const { createBuildConfig } = require('./release-config.cjs');
const args = new Set(process.argv.slice(2));
const allowed = new Set(['--release', '--arm64', '--x64', '--universal']);
for (const arg of args) if (!allowed.has(arg)) throw new Error(`Unknown option: ${arg}`);
if (['--arm64', '--x64', '--universal'].filter((arg) => args.has(arg)).length > 1) throw new Error('Select one architecture');
if (process.platform !== 'darwin') throw new Error('Build macOS packages on a Mac');
process.chdir(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'));

const isRelease = args.has('--release');
// Validate before spending time building. This also prevents accidental unsigned
// production packages or silently skipped notarization.
const config = createBuildConfig({ ...process.env, NOVA_RELEASE: isRelease ? '1' : '0' });
const architecture = args.has('--universal') || (isRelease && !args.has('--arm64') && !args.has('--x64'))
  ? builder.Arch.universal : args.has('--x64') ? builder.Arch.x64 : builder.Arch.arm64;
execFileSync('npm', ['run', 'build'], { stdio: 'inherit' });
const artifacts = await builder.build({
  targets: builder.Platform.MAC.createTarget(['dmg', 'zip'], architecture), config, publish: 'never',
});
await writeChecksums(config.directories.output);
console.log(`\n${isRelease ? 'Signed release' : 'Local test build'} complete (nothing published):`);
for (const artifact of artifacts) console.log(artifact);
