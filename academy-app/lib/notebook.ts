import { z } from 'zod';
import { id, now, one, run } from './db';
import { AppError } from './auth';
import type { Note, User } from './types';
export const noteSchema = z.object({
  id: z.string().max(50).optional(),
  title: z.string().trim().min(1).max(150),
  body: z.string().trim().max(8000),
  topicId: z.string().max(180).nullable().optional(),
  kind: z.enum(['note', 'grammar', 'word']).optional(),
  folder: z.string().trim().max(50).optional(),
  tags: z.array(z.string().trim().min(1).max(30)).max(8).optional(),
  pinned: z.boolean().optional(),
});
export function saveNote(user: User, value: unknown) {
  const b = noteSchema.parse(value),
    previous = b.id
      ? one<Note>('SELECT * FROM notes WHERE id=? AND user_id=?', b.id, user.id)
      : undefined;
  if (b.id && !previous) throw new AppError(404, 'Qayd topilmadi.');
  if (!b.body && previous?.kind !== 'solution') throw new AppError(400, 'Qayd matnini yozing.');
  const kind =
    previous?.kind === 'solution'
      ? 'solution'
      : b.kind ||
        previous?.kind ||
        (b.topicId ? (/^[ABCD]\d{2}$/.test(b.topicId) ? 'grammar' : 'word') : 'note');
  const folder = b.folder ?? previous?.folder ?? '',
    tags = JSON.stringify([...new Set(b.tags || JSON.parse(previous?.tags || '[]'))]);
  const noteId = b.id || id();
  if (previous)
    run(
      'UPDATE notes SET title=?,body=?,kind=?,folder=?,tags=?,pinned=?,updated_at=? WHERE id=? AND user_id=?',
      b.title,
      b.body,
      kind,
      folder,
      tags,
      b.pinned === undefined ? previous.pinned || 0 : +b.pinned,
      now(),
      noteId,
      user.id,
    );
  else
    run(
      'INSERT INTO notes(id,user_id,topic_id,title,body,kind,folder,tags,pinned,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)',
      noteId,
      user.id,
      b.topicId || null,
      b.title,
      b.body,
      kind,
      folder,
      tags,
      +(b.pinned || false),
      now(),
      now(),
    );
  return { ok: true, id: noteId };
}
export function organizeNote(
  user: User,
  noteId: string,
  changes: { pinned?: boolean; archived?: boolean; folder?: string },
) {
  const note = one<Note>('SELECT * FROM notes WHERE id=? AND user_id=?', noteId, user.id);
  if (!note) throw new AppError(404, 'Qayd topilmadi.');
  run(
    'UPDATE notes SET pinned=?,archived=?,folder=? WHERE id=? AND user_id=?',
    changes.pinned === undefined ? note.pinned || 0 : +changes.pinned,
    changes.archived === undefined ? note.archived || 0 : +changes.archived,
    changes.folder ?? note.folder ?? '',
    noteId,
    user.id,
  );
  return { ok: true };
}
