import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
const globalDb = globalThis as unknown as {
  academyDb?: DatabaseSync;
  academySchemaVersion?: number;
};
export const dataDir = () =>
  path.resolve(/* turbopackIgnore: true */ process.env.DATA_DIR || 'data');
export const now = () => new Date().toISOString();
export const id = () => randomUUID();
export function db() {
  if (globalDb.academyDb && globalDb.academySchemaVersion === 16) return globalDb.academyDb;
  fs.mkdirSync(dataDir(), { recursive: true });
  const connection = globalDb.academyDb || new DatabaseSync(path.join(dataDir(), 'academy.sqlite'));
  connection.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=10000;');
  connection.exec(`
 CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,name TEXT NOT NULL,email TEXT UNIQUE NOT NULL,password_hash TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('teacher','student')),group_id TEXT REFERENCES groups(id),telegram_id TEXT UNIQUE,timezone TEXT NOT NULL DEFAULT 'Asia/Tashkent',reminder_time TEXT NOT NULL DEFAULT '19:00',reminder_enabled INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS groups(id TEXT PRIMARY KEY,name TEXT NOT NULL,level TEXT NOT NULL,invite_code TEXT NOT NULL UNIQUE,teacher_id TEXT NOT NULL REFERENCES users(id),grammar_ids TEXT NOT NULL DEFAULT '[]',vocabulary_ids TEXT NOT NULL DEFAULT '[]',created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,expires_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS questions(id TEXT PRIMARY KEY,kind TEXT NOT NULL,topic_id TEXT NOT NULL,prompt TEXT NOT NULL,options TEXT NOT NULL,answer INTEGER NOT NULL,explanation TEXT NOT NULL,translation TEXT NOT NULL,created_by TEXT REFERENCES users(id));
 CREATE TABLE IF NOT EXISTS custom_words(id TEXT PRIMARY KEY,ko TEXT NOT NULL,uz TEXT NOT NULL,category TEXT NOT NULL,example TEXT NOT NULL,translation TEXT NOT NULL,created_by TEXT NOT NULL REFERENCES users(id),created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS vocabulary_entries(id TEXT PRIMARY KEY,body TEXT NOT NULL,normalized_ko TEXT NOT NULL,section TEXT NOT NULL,group_ids TEXT NOT NULL DEFAULT '[]',created_by TEXT NOT NULL REFERENCES users(id),created_at TEXT NOT NULL);
 CREATE INDEX IF NOT EXISTS vocabulary_entry_word ON vocabulary_entries(section,normalized_ko);
 CREATE TABLE IF NOT EXISTS vocabulary_edits(word_id TEXT PRIMARY KEY,body TEXT NOT NULL,revision INTEGER NOT NULL,edited_by TEXT NOT NULL REFERENCES users(id),updated_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS vocabulary_revisions(id TEXT PRIMARY KEY,word_id TEXT NOT NULL,body TEXT NOT NULL,revision INTEGER NOT NULL,edited_by TEXT NOT NULL REFERENCES users(id),created_at TEXT NOT NULL,UNIQUE(word_id,revision));
 CREATE TABLE IF NOT EXISTS vocabulary_jobs(id TEXT PRIMARY KEY,requested_by TEXT NOT NULL REFERENCES users(id),source TEXT NOT NULL,request_key TEXT NOT NULL UNIQUE,section TEXT NOT NULL,category TEXT NOT NULL,group_ids TEXT NOT NULL,input_text TEXT NOT NULL,image_data TEXT,image_mime TEXT,telegram_file_id TEXT,status TEXT NOT NULL DEFAULT 'queued',model TEXT NOT NULL,provider TEXT NOT NULL,result TEXT,error TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS vocabulary_bot_state(user_id TEXT PRIMARY KEY REFERENCES users(id),section TEXT NOT NULL DEFAULT 'reading',category TEXT NOT NULL DEFAULT 'general',group_ids TEXT NOT NULL DEFAULT '[]',stage TEXT NOT NULL DEFAULT 'section',updated_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS vocabulary_bot_updates(update_id INTEGER PRIMARY KEY,created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS assignments(id TEXT PRIMARY KEY,group_id TEXT NOT NULL REFERENCES groups(id),title TEXT NOT NULL,kind TEXT NOT NULL,skill TEXT NOT NULL DEFAULT 'reading',prompt TEXT NOT NULL,topic_ids TEXT NOT NULL DEFAULT '[]',due_at TEXT NOT NULL,created_by TEXT NOT NULL REFERENCES users(id),created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS quiz_sessions(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),kind TEXT NOT NULL,mode TEXT NOT NULL,assignment_id TEXT REFERENCES assignments(id),question_ids TEXT NOT NULL,answers TEXT NOT NULL DEFAULT '[]',status TEXT NOT NULL DEFAULT 'active',score INTEGER NOT NULL DEFAULT 0,started_at TEXT NOT NULL,completed_at TEXT);
 CREATE TABLE IF NOT EXISTS reviews(user_id TEXT NOT NULL REFERENCES users(id),question_id TEXT NOT NULL REFERENCES questions(id),box INTEGER NOT NULL DEFAULT 0,due_at TEXT NOT NULL,correct_count INTEGER NOT NULL DEFAULT 0,wrong_count INTEGER NOT NULL DEFAULT 0,last_at TEXT NOT NULL,PRIMARY KEY(user_id,question_id));
 CREATE TABLE IF NOT EXISTS notes(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),topic_id TEXT,title TEXT NOT NULL,body TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS submissions(id TEXT PRIMARY KEY,assignment_id TEXT NOT NULL REFERENCES assignments(id),user_id TEXT NOT NULL REFERENCES users(id),body TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'submitted',feedback TEXT,score INTEGER,published_at TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,UNIQUE(assignment_id,user_id));
 CREATE TABLE IF NOT EXISTS attachments(id TEXT PRIMARY KEY,submission_id TEXT NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,name TEXT NOT NULL,mime TEXT NOT NULL,size INTEGER NOT NULL,disk_name TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS ai_jobs(id TEXT PRIMARY KEY,submission_id TEXT NOT NULL REFERENCES submissions(id),requested_by TEXT NOT NULL REFERENCES users(id),status TEXT NOT NULL DEFAULT 'queued',model TEXT NOT NULL,result TEXT,error TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
 CREATE UNIQUE INDEX IF NOT EXISTS ai_active ON ai_jobs(submission_id) WHERE status IN ('queued','running');
 CREATE TABLE IF NOT EXISTS notifications(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),kind TEXT NOT NULL,body TEXT NOT NULL,dedupe_key TEXT NOT NULL UNIQUE,status TEXT NOT NULL DEFAULT 'pending',attempts INTEGER NOT NULL DEFAULT 0,error TEXT,created_at TEXT NOT NULL,sent_at TEXT,available_at TEXT NOT NULL DEFAULT '');
 CREATE TABLE IF NOT EXISTS telegram_links(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),expires_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS rate_limits(key TEXT PRIMARY KEY,count INTEGER NOT NULL,expires_at INTEGER NOT NULL);
 CREATE INDEX IF NOT EXISTS quiz_user ON quiz_sessions(user_id,started_at);
 CREATE INDEX IF NOT EXISTS review_due ON reviews(user_id,due_at);
 CREATE INDEX IF NOT EXISTS submission_assignment ON submissions(assignment_id,status);
 CREATE INDEX IF NOT EXISTS student_group ON users(group_id);
 CREATE TABLE IF NOT EXISTS topik_assignment_attempts(user_id TEXT NOT NULL REFERENCES users(id),assignment_id TEXT NOT NULL REFERENCES assignments(id),session_id TEXT NOT NULL REFERENCES topik_sessions(id),PRIMARY KEY(user_id,assignment_id));
 CREATE TABLE IF NOT EXISTS topik_timing_events(session_id TEXT NOT NULL REFERENCES topik_sessions(id),event_id TEXT NOT NULL,question_id TEXT NOT NULL,seconds INTEGER NOT NULL,PRIMARY KEY(session_id,event_id));
 CREATE TABLE IF NOT EXISTS daily_plans(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),day TEXT NOT NULL,minutes INTEGER NOT NULL,steps TEXT NOT NULL,created_at TEXT NOT NULL,UNIQUE(user_id,day,minutes));
 CREATE TABLE IF NOT EXISTS study_reviews(user_id TEXT NOT NULL REFERENCES users(id),kind TEXT NOT NULL,item_id TEXT NOT NULL,stage INTEGER NOT NULL DEFAULT 0,due_at TEXT NOT NULL,correct_count INTEGER NOT NULL DEFAULT 0,wrong_count INTEGER NOT NULL DEFAULT 0,last_at TEXT NOT NULL,PRIMARY KEY(user_id,kind,item_id));
 CREATE INDEX IF NOT EXISTS study_review_due ON study_reviews(user_id,due_at);
 CREATE TABLE IF NOT EXISTS study_events(user_id TEXT NOT NULL REFERENCES users(id),event_key TEXT NOT NULL,kind TEXT NOT NULL,item_id TEXT NOT NULL,correct INTEGER NOT NULL,uncertain INTEGER NOT NULL DEFAULT 0,at TEXT NOT NULL,PRIMARY KEY(user_id,event_key));
 CREATE TABLE IF NOT EXISTS courses(id TEXT PRIMARY KEY,teacher_id TEXT NOT NULL REFERENCES users(id),level TEXT NOT NULL,title TEXT NOT NULL,created_at TEXT NOT NULL,UNIQUE(teacher_id,level));
 CREATE TABLE IF NOT EXISTS course_lessons(id TEXT PRIMARY KEY,course_id TEXT NOT NULL REFERENCES courses(id),position INTEGER NOT NULL,body TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 0,updated_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS course_files(id TEXT PRIMARY KEY,lesson_id TEXT NOT NULL REFERENCES course_lessons(id),name TEXT NOT NULL,mime TEXT NOT NULL,size INTEGER NOT NULL,disk_name TEXT NOT NULL,created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS course_releases(id TEXT PRIMARY KEY,group_id TEXT NOT NULL REFERENCES groups(id),lesson_id TEXT NOT NULL REFERENCES course_lessons(id),lesson_date TEXT NOT NULL,due_at TEXT NOT NULL,snapshot TEXT NOT NULL,opened_at TEXT NOT NULL,UNIQUE(group_id,lesson_id));
 CREATE TABLE IF NOT EXISTS course_release_items(release_id TEXT NOT NULL REFERENCES course_releases(id),item_id TEXT NOT NULL,available_at TEXT NOT NULL,due_at TEXT NOT NULL,published_at TEXT NOT NULL,PRIMARY KEY(release_id,item_id));
 CREATE TABLE IF NOT EXISTS course_assignments(release_id TEXT NOT NULL REFERENCES course_releases(id),material_id TEXT NOT NULL,assignment_id TEXT NOT NULL UNIQUE REFERENCES assignments(id),PRIMARY KEY(release_id,material_id));
 CREATE TABLE IF NOT EXISTS course_tasks(release_id TEXT NOT NULL REFERENCES course_releases(id),material_id TEXT NOT NULL,user_id TEXT NOT NULL REFERENCES users(id),score INTEGER NOT NULL,total INTEGER NOT NULL,completed_at TEXT NOT NULL,PRIMARY KEY(release_id,material_id,user_id));
 CREATE TABLE IF NOT EXISTS course_bot_state(user_id TEXT PRIMARY KEY REFERENCES users(id),lesson_id TEXT REFERENCES course_lessons(id),updated_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS course_word_jobs(id TEXT PRIMARY KEY,lesson_id TEXT NOT NULL REFERENCES course_lessons(id),requested_by TEXT NOT NULL REFERENCES users(id),request_key TEXT NOT NULL UNIQUE,input_text TEXT NOT NULL,telegram_file_id TEXT,provider TEXT NOT NULL,model TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'queued',result TEXT,error TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS course_points(release_id TEXT NOT NULL REFERENCES course_releases(id),user_id TEXT NOT NULL REFERENCES users(id),points INTEGER NOT NULL CHECK(points BETWEEN 0 AND 10),updated_by TEXT NOT NULL REFERENCES users(id),updated_at TEXT NOT NULL,PRIMARY KEY(release_id,user_id));
 CREATE TABLE IF NOT EXISTS course_gifts(group_id TEXT NOT NULL REFERENCES groups(id),user_id TEXT NOT NULL REFERENCES users(id),milestone INTEGER NOT NULL,awarded_at TEXT NOT NULL,PRIMARY KEY(group_id,user_id,milestone));
 CREATE TABLE IF NOT EXISTS course_live(id TEXT PRIMARY KEY,release_id TEXT NOT NULL REFERENCES course_releases(id),questions TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'open',opened_at TEXT NOT NULL,closed_at TEXT);
 CREATE UNIQUE INDEX IF NOT EXISTS course_live_once ON course_live(release_id);
 CREATE TABLE IF NOT EXISTS course_live_attempts(live_id TEXT NOT NULL REFERENCES course_live(id),user_id TEXT NOT NULL REFERENCES users(id),started_at TEXT NOT NULL,completed_at TEXT,score INTEGER,elapsed_ms INTEGER,PRIMARY KEY(live_id,user_id));
 CREATE TABLE IF NOT EXISTS app_meta(key TEXT PRIMARY KEY,value TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS vocabulary_access(group_id TEXT NOT NULL REFERENCES groups(id),level TEXT NOT NULL,book TEXT NOT NULL DEFAULT '',section TEXT NOT NULL,categories TEXT NOT NULL,PRIMARY KEY(group_id,level,book,section));
 CREATE TABLE IF NOT EXISTS topik_groups(id TEXT PRIMARY KEY,category TEXT NOT NULL,origin TEXT NOT NULL,source TEXT NOT NULL,instruction TEXT NOT NULL,passage TEXT NOT NULL,blocks TEXT NOT NULL,corpus_version TEXT NOT NULL,current INTEGER NOT NULL DEFAULT 1);
 CREATE TABLE IF NOT EXISTS topik_questions(id TEXT PRIMARY KEY,group_id TEXT NOT NULL REFERENCES topik_groups(id),number INTEGER NOT NULL,prompt TEXT NOT NULL,options TEXT NOT NULL,option_images TEXT NOT NULL DEFAULT '[]',answer INTEGER CHECK(answer BETWEEN 0 AND 3),explanation TEXT NOT NULL,translation TEXT NOT NULL DEFAULT '',grammar_ids TEXT NOT NULL DEFAULT '[]',servable INTEGER NOT NULL DEFAULT 0,corpus_version TEXT NOT NULL,current INTEGER NOT NULL DEFAULT 1);
 CREATE INDEX IF NOT EXISTS topik_question_group ON topik_questions(group_id,current,servable);
 CREATE TABLE IF NOT EXISTS topik_vocabulary(id TEXT PRIMARY KEY,ko TEXT NOT NULL,uz TEXT NOT NULL,pos TEXT NOT NULL,example TEXT NOT NULL,translation TEXT NOT NULL,categories TEXT NOT NULL,source_question_ids TEXT NOT NULL,frequency INTEGER NOT NULL,kind TEXT NOT NULL,corpus_version TEXT NOT NULL,current INTEGER NOT NULL DEFAULT 1);
 CREATE TABLE IF NOT EXISTS topik_mock_forms(id TEXT PRIMARY KEY,number INTEGER NOT NULL,group_ids TEXT NOT NULL,corpus_version TEXT NOT NULL,current INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS topik_sessions(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),mode TEXT NOT NULL,category TEXT NOT NULL,form_id TEXT REFERENCES topik_mock_forms(id),requested_count INTEGER NOT NULL,actual_count INTEGER NOT NULL,snapshot TEXT NOT NULL,choices TEXT NOT NULL DEFAULT '{}',status TEXT NOT NULL DEFAULT 'active',score INTEGER NOT NULL DEFAULT 0,started_at TEXT NOT NULL,deadline TEXT,completed_at TEXT,timed_out INTEGER NOT NULL DEFAULT 0,notice TEXT);
 CREATE INDEX IF NOT EXISTS topik_session_user ON topik_sessions(user_id,started_at);
 CREATE TABLE IF NOT EXISTS topik_solutions(question_id TEXT PRIMARY KEY REFERENCES topik_questions(id),source_hash TEXT NOT NULL,body TEXT NOT NULL,revision INTEGER NOT NULL,status TEXT NOT NULL DEFAULT 'published',edited_by TEXT REFERENCES users(id),updated_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS topik_solution_revisions(id TEXT PRIMARY KEY,question_id TEXT NOT NULL REFERENCES topik_questions(id),source_hash TEXT NOT NULL,body TEXT NOT NULL,revision INTEGER NOT NULL,status TEXT NOT NULL,edited_by TEXT REFERENCES users(id),updated_at TEXT NOT NULL,UNIQUE(question_id,revision));
 CREATE TABLE IF NOT EXISTS topik_bookmarks(user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,question_id TEXT NOT NULL REFERENCES topik_questions(id),saved_at TEXT NOT NULL,PRIMARY KEY(user_id,question_id));
 `);
  connection.exec('BEGIN IMMEDIATE');
  try {
    const groupColumns = connection.prepare('PRAGMA table_info(groups)').all() as {
      name: string;
    }[];
    if (!groupColumns.some((c) => c.name === 'course_id'))
      connection.exec('ALTER TABLE groups ADD COLUMN course_id TEXT REFERENCES courses(id)');
    const assignmentColumns = connection.prepare('PRAGMA table_info(assignments)').all() as {
      name: string;
    }[];
    if (!assignmentColumns.some((c) => c.name === 'skill')) {
      connection.exec("ALTER TABLE assignments ADD COLUMN skill TEXT NOT NULL DEFAULT 'reading'");
      connection.exec(
        "UPDATE assignments SET skill=CASE WHEN kind='writing' THEN 'writing' ELSE 'reading' END",
      );
    }
    const columns = connection.prepare('PRAGMA table_info(ai_jobs)').all() as { name: string }[];
    for (const table of ['vocabulary_jobs', 'vocabulary_bot_state']) {
      const fields = connection.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
      if (!fields.some((c) => c.name === 'level'))
        connection.exec(`ALTER TABLE ${table} ADD COLUMN level TEXT NOT NULL DEFAULT 'topik34'`);
      if (!fields.some((c) => c.name === 'book'))
        connection.exec(`ALTER TABLE ${table} ADD COLUMN book TEXT`);
    }
    // Preserve the previous reading access of existing legacy groups once.
    // Newly created groups start closed until their teacher grants access.
    if (!connection.prepare("SELECT key FROM app_meta WHERE key='vocabulary-access-v1'").get()) {
      connection.exec(`INSERT OR IGNORE INTO vocabulary_access(group_id,level,book,section,categories)
        SELECT id,'topik34','','reading','["all"]' FROM groups WHERE course_id IS NULL;
        INSERT INTO app_meta(key,value) VALUES('vocabulary-access-v1','1');`);
      for (const row of connection
        .prepare('SELECT body,group_ids FROM vocabulary_entries')
        .all() as { body: string; group_ids: string }[]) {
        const word = JSON.parse(row.body);
        for (const groupId of JSON.parse(row.group_ids) as string[]) {
          const previous = connection
            .prepare(
              "SELECT categories FROM vocabulary_access WHERE group_id=? AND level='topik34' AND book='' AND section=?",
            )
            .get(groupId, word.section) as { categories: string } | undefined;
          connection
            .prepare(
              "INSERT INTO vocabulary_access(group_id,level,book,section,categories) VALUES(?,'topik34','',?,?) ON CONFLICT(group_id,level,book,section) DO UPDATE SET categories=excluded.categories",
            )
            .run(
              groupId,
              word.section,
              JSON.stringify([
                ...new Set([
                  ...(previous ? JSON.parse(previous.categories) : []),
                  ...word.categories,
                ]),
              ]),
            );
        }
      }
    }
    const notificationColumns = connection.prepare('PRAGMA table_info(notifications)').all() as {
      name: string;
    }[];
    if (!notificationColumns.some((c) => c.name === 'telegram_markup'))
      connection.exec('ALTER TABLE notifications ADD COLUMN telegram_markup TEXT');
    if (!notificationColumns.some((c) => c.name === 'available_at'))
      connection.exec("ALTER TABLE notifications ADD COLUMN available_at TEXT NOT NULL DEFAULT ''");
    if (!connection.prepare("SELECT key FROM app_meta WHERE key='course-release-items-v1'").get()) {
      for (const release of connection
        .prepare('SELECT id,snapshot,due_at,opened_at FROM course_releases')
        .all() as { id: string; snapshot: string; due_at: string; opened_at: string }[]) {
        const snapshot = JSON.parse(release.snapshot) as {
          youtubeUrl?: string;
          materials?: { id: string }[];
        };
        const itemIds = [
          ...(snapshot.youtubeUrl ? ['video'] : []),
          ...(snapshot.materials || []).map((material) => material.id),
        ];
        for (const itemId of itemIds)
          connection
            .prepare(
              'INSERT OR IGNORE INTO course_release_items(release_id,item_id,available_at,due_at,published_at) VALUES(?,?,?,?,?)',
            )
            .run(release.id, itemId, release.opened_at, release.due_at, release.opened_at);
      }
      connection
        .prepare("INSERT INTO app_meta(key,value) VALUES('course-release-items-v1',?)")
        .run(now());
    }
    if (!columns.some((c) => c.name === 'provider'))
      connection.exec("ALTER TABLE ai_jobs ADD COLUMN provider TEXT NOT NULL DEFAULT 'openai'");
    const vocabularyColumns = connection.prepare('PRAGMA table_info(topik_vocabulary)').all() as {
      name: string;
    }[];
    for (const column of ['category_frequencies', 'category_question_ids']) {
      if (!vocabularyColumns.some((c) => c.name === column))
        connection.exec(
          `ALTER TABLE topik_vocabulary ADD COLUMN ${column} TEXT NOT NULL DEFAULT '{}'`,
        );
    }
    const sessionColumns = connection.prepare('PRAGMA table_info(topik_sessions)').all() as {
      name: string;
    }[];
    for (const column of ['uncertain', 'timings', 'seen_before', 'checked']) {
      if (!sessionColumns.some((c) => c.name === column))
        connection.exec(
          `ALTER TABLE topik_sessions ADD COLUMN ${column} TEXT NOT NULL DEFAULT '{}'`,
        );
    }
    const userColumns = connection.prepare('PRAGMA table_info(users)').all() as { name: string }[];
    if (!userColumns.some((c) => c.name === 'content_editor'))
      connection.exec('ALTER TABLE users ADD COLUMN content_editor INTEGER NOT NULL DEFAULT 0');
    if (
      process.env.ADMIN_EMAIL &&
      !connection.prepare("SELECT key FROM app_meta WHERE key='content_editor_initialized'").get()
    ) {
      const grant = connection
        .prepare("UPDATE users SET content_editor=1 WHERE role='teacher' AND lower(email)=?")
        .run(process.env.ADMIN_EMAIL.toLowerCase());
      if (grant.changes)
        connection
          .prepare("INSERT INTO app_meta(key,value) VALUES('content_editor_initialized',?)")
          .run(now());
    }
    const noteColumns = connection.prepare('PRAGMA table_info(notes)').all() as { name: string }[];
    const noteFields: Record<string, string> = {
      kind: "TEXT NOT NULL DEFAULT 'note'",
      folder: "TEXT NOT NULL DEFAULT ''",
      tags: "TEXT NOT NULL DEFAULT '[]'",
      pinned: 'INTEGER NOT NULL DEFAULT 0',
      archived: 'INTEGER NOT NULL DEFAULT 0',
      question_id: 'TEXT',
      source_session_id: 'TEXT',
      solution_revision: 'INTEGER',
      solution_snapshot: 'TEXT',
    };
    for (const [name, type] of Object.entries(noteFields))
      if (!noteColumns.some((c) => c.name === name))
        connection.exec(`ALTER TABLE notes ADD COLUMN ${name} ${type}`);
    connection.exec(
      "CREATE UNIQUE INDEX IF NOT EXISTS note_solution_unique ON notes(user_id,question_id) WHERE kind='solution'",
    );
    if (!noteColumns.some((c) => c.name === 'kind'))
      connection.exec(
        "UPDATE notes SET kind=CASE WHEN topic_id GLOB '[ABCD][0-9][0-9]' THEN 'grammar' WHEN topic_id IS NOT NULL THEN 'word' ELSE 'note' END",
      );
    connection.exec('COMMIT');
  } catch (error) {
    connection.exec('ROLLBACK');
    throw error;
  }
  globalDb.academyDb = connection;
  globalDb.academySchemaVersion = 16;
  return connection;
}
export function one<T = Record<string, unknown>>(
  sql: string,
  ...params: SQLInputValue[]
): T | undefined {
  return db()
    .prepare(sql)
    .get(...params) as T | undefined;
}
export function many<T = Record<string, unknown>>(sql: string, ...params: SQLInputValue[]): T[] {
  return db()
    .prepare(sql)
    .all(...params) as T[];
}
export function run(sql: string, ...params: SQLInputValue[]) {
  return db()
    .prepare(sql)
    .run(...params);
}
export function transaction<T>(fn: () => T): T {
  db().exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db().exec('COMMIT');
    return result;
  } catch (error) {
    db().exec('ROLLBACK');
    throw error;
  }
}
export function resetDbForTests() {
  globalDb.academyDb?.close();
  globalDb.academyDb = undefined;
}
