import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export async function writeChecksums(directory) {
  const names = (await fs.readdir(directory)).filter(name => /\.(dmg|zip|blockmap|yml)$/.test(name) && !name.startsWith('builder-')).sort();
  const lines = [];
  for (const name of names) {
    const hash = createHash('sha256');
    for await (const chunk of createReadStream(path.join(directory, name))) hash.update(chunk);
    lines.push(`${hash.digest('hex')}  ${name}`);
  }
  await fs.writeFile(path.join(directory, 'SHA256SUMS'), lines.join('\n') + '\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!process.argv[2]) throw new Error('Usage: node scripts/write-checksums.mjs release/local');
  await writeChecksums(process.argv[2]);
}
