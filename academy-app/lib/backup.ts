import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createHash, randomUUID } from 'node:crypto';
import { db, dataDir } from './db';

export function createBackup(base = process.env.BACKUP_DIR || 'backups') {
  const stamp = new Date().toISOString().replaceAll(':', '-');
  const target = path.resolve(base, stamp);
  const partial = path.resolve(base, `.partial-${randomUUID()}`);
  fs.mkdirSync(partial, { recursive: true, mode: 0o700 });
  let snapshot: DatabaseSync | undefined;
  try {
    const file = path.join(partial, 'academy.sqlite');
    db().prepare('VACUUM INTO ?').run(file);
    fs.chmodSync(file, 0o600);
    snapshot = new DatabaseSync(file, { readOnly: true });
    const integrity = snapshot.prepare('PRAGMA integrity_check').all();
    if (
      integrity.length !== 1 ||
      Object.values(integrity[0])[0] !== 'ok' ||
      snapshot.prepare('PRAGMA foreign_key_check').all().length
    )
      throw new Error('Zaxira bazasi yaxlitlik tekshiruvidan o‘tmadi.');
    const files = snapshot
      .prepare(
        'SELECT disk_name,size FROM attachments UNION ALL SELECT disk_name,size FROM course_files',
      )
      .all() as {
      disk_name: string;
      size: number;
    }[];
    fs.mkdirSync(path.join(partial, 'uploads'), { mode: 0o700 });
    const manifest: { file: string; sha256: string }[] = [];
    for (const item of files) {
      if (!/^[a-f0-9-]{36}$/.test(item.disk_name))
        throw new Error('Zaxirada yaroqsiz fayl manzili.');
      const destination = path.join(partial, 'uploads', item.disk_name);
      fs.copyFileSync(path.join(dataDir(), 'uploads', item.disk_name), destination);
      if (fs.statSync(destination).size !== item.size)
        throw new Error('Zaxira fayli hajmi mos emas.');
      fs.chmodSync(destination, 0o600);
      manifest.push({
        file: `uploads/${item.disk_name}`,
        sha256: createHash('sha256').update(fs.readFileSync(destination)).digest('hex'),
      });
    }
    snapshot.close();
    snapshot = undefined;
    manifest.push({
      file: 'academy.sqlite',
      sha256: createHash('sha256').update(fs.readFileSync(file)).digest('hex'),
    });
    fs.writeFileSync(
      path.join(partial, 'backup.json'),
      JSON.stringify(
        { createdAt: new Date().toISOString(), app: 'HangangAcademy', version: 2, files: manifest },
        null,
        2,
      ),
      { mode: 0o600 },
    );
    fs.renameSync(partial, target);
    return target;
  } catch (error) {
    snapshot?.close();
    fs.rmSync(partial, { recursive: true, force: true });
    throw error;
  }
}
