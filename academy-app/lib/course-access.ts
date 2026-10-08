import { many, one, now } from './db';
import { AppError } from './auth';
import type { User } from './types';
import type { CourseLevel, LessonBody } from './course-types';
export function courseAccess(user: User) {
  if (user.role === 'teacher')
    return {
      managed: false,
      topik: true,
      level: null,
      grammarIds: [] as string[],
      wordIds: [] as string[],
      words: [] as LessonBody['materials'][number]['words'],
    };
  const course = one<{ level: CourseLevel }>(
    'SELECT c.level FROM groups g JOIN courses c ON c.id=g.course_id WHERE g.id=?',
    user.group_id || '',
  );
  const snapshots = course
    ? many<{ id: string; snapshot: string }>(
        'SELECT id,snapshot FROM course_releases WHERE group_id=?',
        user.group_id || '',
      ).map((r) => {
        const snapshot = JSON.parse(r.snapshot) as LessonBody;
        const active = new Set(
          many<{ item_id: string }>(
            'SELECT item_id FROM course_release_items WHERE release_id=? AND available_at<=?',
            r.id,
            now(),
          ).map((item) => item.item_id),
        );
        return {
          ...snapshot,
          youtubeUrl: active.has('video') ? snapshot.youtubeUrl : '',
          materials: snapshot.materials.filter((material) => active.has(material.id)),
        };
      })
    : [];
  const materials = snapshots.flatMap((s) => s.materials);
  return {
    managed: !!course,
    topik: !course || course.level !== 'hangul',
    level: course?.level || null,
    grammarIds: [...new Set(materials.flatMap((m) => m.grammarIds))],
    wordIds: [...new Set(materials.flatMap((m) => m.words.map((w) => w.id)))],
    words: materials.flatMap((m) => m.words),
  };
}
export function requireTopikAccess(user: User) {
  if (!courseAccess(user).topik)
    throw new AppError(
      403,
      'Bu bo‘lim guruhingiz darajasi uchun ochilmagan. Darslaringizdan foydalaning.',
    );
}
