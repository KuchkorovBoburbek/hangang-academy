import { beforeEach, afterEach, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { resetDbForTests, one, run, id } from '../lib/db';
import { ensureSeed } from '../lib/seed';
import { createBackup } from '../lib/backup';
let root: string;
let disk: string;
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'hangang-backup-'));
  process.env.DATA_DIR = path.join(root, 'live');
  process.env.DEMO_MODE = 'true';
  process.env.ADMIN_EMAIL = 'backup-test@example.test';
  process.env.ADMIN_PASSWORD = 'Temporary-test-password!';
  ensureSeed();
  const submission = one<{ id: string }>('SELECT id FROM submissions LIMIT 1')!;
  disk = id();
  const bytes = Buffer.from('%PDF-1.7\nbackup test');
  fs.mkdirSync(path.join(root, 'live', 'uploads'));
  fs.writeFileSync(path.join(root, 'live', 'uploads', disk), bytes);
  run(
    'INSERT INTO attachments(id,submission_id,name,mime,size,disk_name) VALUES(?,?,?,?,?,?)',
    id(),
    submission.id,
    'answer.pdf',
    'application/pdf',
    bytes.length,
    disk,
  );
});
afterEach(() => {
  resetDbForTests();
  fs.rmSync(root, { recursive: true, force: true });
});
it('restores a consistent database and all referenced private files from a complete snapshot', () => {
  const backup = createBackup(path.join(root, 'backups'));
  const restored = path.join(root, 'restored');
  fs.cpSync(backup, restored, { recursive: true });
  const snapshot = new DatabaseSync(path.join(restored, 'academy.sqlite'), { readOnly: true });
  expect(snapshot.prepare('PRAGMA integrity_check').get()?.integrity_check).toBe('ok');
  expect(snapshot.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
  expect(snapshot.prepare('SELECT disk_name FROM attachments').get()?.disk_name).toBe(disk);
  snapshot.close();
  const manifest = JSON.parse(fs.readFileSync(path.join(restored, 'backup.json'), 'utf8'));
  expect(manifest.files).toHaveLength(2);
  for (const file of manifest.files)
    expect(
      createHash('sha256')
        .update(fs.readFileSync(path.join(restored, file.file)))
        .digest('hex'),
    ).toBe(file.sha256);
});
it('does not mark an incomplete snapshot as usable when an attachment is missing', () => {
  fs.unlinkSync(path.join(root, 'live', 'uploads', disk));
  expect(() => createBackup(path.join(root, 'backups'))).toThrow();
  expect(fs.readdirSync(path.join(root, 'backups'))).toEqual([]);
});
