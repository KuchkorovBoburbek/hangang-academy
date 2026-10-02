import { createHash } from 'node:crypto';
import { z } from 'zod';
import { AppError } from './auth';
import { id, now, run, transaction } from './db';
import { scopeSchema, validateCategories } from './vocabulary-access';
import { vocabularyList } from './vocabulary-data';
import { matchesCategory } from './vocabulary-types';
import { getSession, shuffle, viewSession } from './learning';
import type { User } from './types';

export function startVocabularyQuiz(user: User, input: unknown) {
  if (user.role !== 'student' || !user.group_id)
    throw new AppError(403, 'Mashq o‘quvchi hisobidan boshlanadi.');
  const b = z
    .object({
      scope: scopeSchema,
      categories: z.array(z.string()).min(1).max(30),
      kind: z.enum(['word', 'idiom']).default('word'),
      count: z.number().int().min(1).max(100).default(20),
    })
    .parse(input);
  validateCategories(b.scope, b.categories, true);
  const visible = vocabularyList(user, b.scope.section, 'all', b.kind, b.scope);
  const selected = shuffle(
    visible.filter((w) => b.categories.some((c) => matchesCategory(w.categories, c))),
  ).slice(0, b.count);
  if (!selected.length)
    throw new AppError(400, 'Tanlangan mavzularda siz uchun ochilgan so‘z yo‘q.');
  return transaction(() => {
    const questions = selected.map((word) => {
      const distractors = shuffle([
        ...new Set(visible.filter((w) => w.uz !== word.uz).map((w) => w.uz)),
      ]).slice(0, 3);
      const options = shuffle([
        word.uz,
        ...(distractors.length ? distractors : ['Bu ma’no mos emas']),
      ]);
      const prompt = `“${word.ko}” tarjimasini tanlang.`;
      const qid =
        'vw-' +
        createHash('sha256')
          .update(JSON.stringify([word.id, prompt, options, word.example, word.translation]))
          .digest('hex')
          .slice(0, 32);
      run(
        'INSERT OR IGNORE INTO questions(id,kind,topic_id,prompt,options,answer,explanation,translation) VALUES(?,?,?,?,?,?,?,?)',
        qid,
        'vocabulary',
        word.id,
        prompt,
        JSON.stringify(options),
        options.indexOf(word.uz),
        `${word.ko} — ${word.uz}\n${word.example}`,
        word.translation,
      );
      return qid;
    });
    const sid = id();
    run(
      'INSERT INTO quiz_sessions(id,user_id,kind,mode,question_ids,started_at) VALUES(?,?,?,?,?,?)',
      sid,
      user.id,
      'vocabulary',
      'practice',
      JSON.stringify(questions),
      now(),
    );
    return viewSession(getSession(sid, user));
  });
}
