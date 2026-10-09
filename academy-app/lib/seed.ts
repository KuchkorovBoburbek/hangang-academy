import { one, run, transaction, id, now } from './db';
import { QUESTIONS, GRAMMARS, WORDS } from './content';
import bcrypt from 'bcryptjs';
export function ensureSeed() {
  if (one('SELECT key FROM app_meta WHERE key=?', 'initialized')) {
    syncQuestions();
    return;
  }
  transaction(() => {
    if (one('SELECT key FROM app_meta WHERE key=?', 'initialized')) return;
    const demo = process.env.DEMO_MODE === 'true' && process.env.NODE_ENV !== 'production';
    const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    const password = process.env.ADMIN_PASSWORD;
    if (!demo && (!email || !password || password.length < 16))
      throw new Error('ADMIN_EMAIL va kamida 16 belgili ADMIN_PASSWORD kiriting.');
    const teacher = id();
    const time = now();
    run(
      'INSERT INTO users(id,name,email,password_hash,role,created_at,content_editor) VALUES(?,?,?,?,?,?,1)',
      teacher,
      process.env.ADMIN_NAME || 'Boburbek ustoz',
      email || 'teacher@hangang.local',
      bcrypt.hashSync(password || 'HangangTeacher2026!', 12),
      'teacher',
      time,
    );
    const group = id();
    const grammarIds = JSON.stringify(
      GRAMMARS.filter((g) => g.id.startsWith('A'))
        .slice(0, 15)
        .map((g) => g.id),
    );
    run(
      'INSERT INTO groups(id,name,level,invite_code,teacher_id,grammar_ids,vocabulary_ids,created_at) VALUES(?,?,?,?,?,?,?,?)',
      group,
      'Seoul · TOPIK II',
      '3-4-daraja',
      demo ? 'HANGANG26' : id().replaceAll('-', '').slice(0, 12).toUpperCase(),
      teacher,
      grammarIds,
      JSON.stringify(WORDS.map((w) => w.id)),
      time,
    );
    for (const q of QUESTIONS)
      run(
        'INSERT OR IGNORE INTO questions(id,kind,topic_id,prompt,options,answer,explanation,translation) VALUES(?,?,?,?,?,?,?,?)',
        q.id,
        q.kind,
        q.topic_id,
        q.prompt,
        JSON.stringify(q.options),
        q.answer,
        q.explanation,
        q.translation,
      );
    const due = new Date(Date.now() + 7 * 86400000).toISOString();
    run(
      "INSERT OR IGNORE INTO vocabulary_access(group_id,level,book,section,categories) VALUES(?,'topik34','','reading','[\"all\"]')",
      group,
    );
    const writing = id();
    run(
      'INSERT INTO assignments(id,group_id,title,kind,skill,prompt,topic_ids,due_at,created_by,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)',
      writing,
      group,
      '나의 한국어 공부 — Mening o‘qish odatim',
      'writing',
      'writing',
      '한국어를 왜 배우고 있어요? 어떻게 공부해요? 앞으로 어떤 목표가 있어요?\n\nKoreys tilini o‘rganishingiz haqida 150–250 belgili matn yozing. Maqsad va sababni ifodalang. -(으)려고 va -아/어서 shakllaridan foydalaning. Bu o‘quv mashqi; rasmiy TOPIK bahosi emas.',
      '["A04","A12"]',
      due,
      teacher,
      time,
    );
    run(
      'INSERT INTO assignments(id,group_id,title,kind,skill,prompt,topic_ids,due_at,created_by,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)',
      id(),
      group,
      'Maqsad va sababni farqlaymiz',
      'grammar',
      'reading',
      'Bugungi mavzulardan 10 ta savolni ishlang.',
      '["A04","A05","A06","A12"]',
      due,
      teacher,
      time,
    );
    if (demo) {
      const student = id();
      run(
        'INSERT INTO users(id,name,email,password_hash,role,group_id,created_at) VALUES(?,?,?,?,?,?,?)',
        student,
        'Aziza',
        'student@hangang.local',
        bcrypt.hashSync('HangangStudent2026!', 12),
        'student',
        group,
        time,
      );
      const second = id();
      run(
        'INSERT INTO users(id,name,email,password_hash,role,group_id,created_at) VALUES(?,?,?,?,?,?,?)',
        second,
        'Bekzod',
        'bekzod@hangang.local',
        bcrypt.hashSync('HangangStudent2026!', 12),
        'student',
        group,
        time,
      );
      run(
        'INSERT INTO submissions(id,assignment_id,user_id,body,created_at,updated_at) VALUES(?,?,?,?,?,?)',
        id(),
        writing,
        second,
        '저는 한국 대학교에서 공부하려고 한국어를 배워요. 매일 새로운 단어를 공부하고 한국 드라마를 봐요. 문법이 어렵어서 가끔 실수를 해요. 하지만 포기하지 않아요. 내년에 TOPIK 시험에 합격하고 싶어요.',
        time,
        time,
      );
    }
    run('INSERT INTO app_meta(key,value) VALUES(?,?)', 'initialized', time);
  });
}

function syncQuestions() {
  const contentVersion = 'content-v3-seoulte-1a-grammar';
  if (one('SELECT key FROM app_meta WHERE key=?', contentVersion)) return;
  transaction(() => {
    for (const q of QUESTIONS) {
      run(
        'INSERT OR IGNORE INTO questions(id,kind,topic_id,prompt,options,answer,explanation,translation) VALUES(?,?,?,?,?,?,?,?)',
        q.id,
        q.kind,
        q.topic_id,
        q.prompt,
        JSON.stringify(q.options),
        q.answer,
        q.explanation,
        q.translation,
      );
      run(
        'UPDATE questions SET prompt=?,options=? WHERE id=? AND created_by IS NULL',
        q.prompt,
        JSON.stringify(q.options),
        q.id,
      );
    }
    run('INSERT OR IGNORE INTO app_meta(key,value) VALUES(?,?)', contentVersion, now());
  });
}
