import '../lib/env';
import fs from 'node:fs';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { createBackup } from '../lib/backup';

const base = path.resolve(process.env.BACKUP_DIR || 'backups');
let stopping = false;
process.on('SIGTERM', () => {
  stopping = true;
});
process.on('SIGINT', () => {
  stopping = true;
});
function backups() {
  if (!fs.existsSync(base)) return [];
  return fs
    .readdirSync(base)
    .filter((name) => {
      if (!/^\d{4}-\d\d-\d\dT\d\d-\d\d-\d\d\.\d{3}Z$/.test(name)) return false;
      try {
        const metadata = JSON.parse(fs.readFileSync(path.join(base, name, 'backup.json'), 'utf8'));
        return metadata.app === 'HangangAcademy' && metadata.version === 2;
      } catch {
        return false;
      }
    })
    .sort();
}
async function main() {
  while (!stopping) {
    try {
      const today = new Date().toISOString().slice(0, 10);
      if (!backups().some((name) => name.startsWith(today))) {
        console.log(`Kunlik zaxira tayyor: ${createBackup(base)}`);
        // Retain seven complete snapshots; only this app's completed backups are removed.
        for (const name of backups().slice(0, -7))
          fs.rmSync(path.join(base, name), { recursive: true });
      }
    } catch {
      console.error('Kunlik zaxira yaratilmadi. Disk joyi va fayllarni tekshiring.');
    }
    for (let i = 0; i < 720 && !stopping; i++) await delay(5000);
  }
}
main().catch(() => {
  process.exitCode = 1;
});
