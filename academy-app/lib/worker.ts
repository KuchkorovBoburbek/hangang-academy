import { many, one, run, transaction, id, now } from './db';
import { evaluateSubmission } from './ai';
import { sendTelegram, TelegramError } from './telegram';
import type { AIJob, User } from './types';

export function claimAIJob() {
  return transaction(() => {
    const job = one<AIJob>(
      "SELECT * FROM ai_jobs WHERE status='queued' ORDER BY created_at LIMIT 1",
    );
    if (job) run("UPDATE ai_jobs SET status='running',updated_at=? WHERE id=?", now(), job.id);
    return job;
  });
}
export async function processAIJob() {
  const job = claimAIJob();
  if (!job) return;
  try {
    const result = await evaluateSubmission(job.submission_id, job.model, job.provider);
    run(
      "UPDATE ai_jobs SET status='completed',result=?,error=NULL,updated_at=? WHERE id=?",
      JSON.stringify(result),
      now(),
      job.id,
    );
  } catch (error) {
    const safe = error instanceof Error ? error.message : 'AI tekshirishda xatolik.';
    run(
      "UPDATE ai_jobs SET status='failed',error=?,updated_at=? WHERE id=?",
      safe.slice(0, 500),
      now(),
      job.id,
    );
  }
}
export function queueReminders(date = new Date()) {
  for (const user of many<User>(
    "SELECT * FROM users WHERE role='student' AND reminder_enabled=1 AND telegram_id IS NOT NULL",
  )) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: user.timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(date);
    const p = Object.fromEntries(parts.map((v) => [v.type, v.value]));
    const day = `${p.year}-${p.month}-${p.day}`;
    // Catch up within the selected hour after a short worker restart; never send old reminders.
    const localMinutes = Number(p.hour) * 60 + Number(p.minute);
    const [h, m] = user.reminder_time.split(':').map(Number);
    if (localMinutes < h * 60 + m || localMinutes >= h * 60 + m + 60) continue;
    const done = many<{ completed_at: string }>(
      "SELECT completed_at FROM quiz_sessions WHERE user_id=? AND status='completed' AND completed_at>?",
      user.id,
      new Date(date.getTime() - 36 * 3600000).toISOString(),
    );
    if (
      done.some(
        (s) =>
          new Intl.DateTimeFormat('en-CA', {
            timeZone: user.timezone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
          }).format(new Date(s.completed_at)) === day,
      )
    )
      continue;
    run(
      'INSERT OR IGNORE INTO notifications(id,user_id,kind,body,dedupe_key,created_at) VALUES(?,?,?,?,?,?)',
      id(),
      user.id,
      'reminder',
      '오늘도 한 걸음 🌱 Bugun 10 daqiqa o‘zingiz uchun! Lug‘at yoki grammatika mashqini bajaring.',
      `daily-${user.id}-${day}`,
      now(),
    );
  }
}
export async function sendNotifications() {
  if (!process.env.TELEGRAM_BOT_TOKEN) return;
  const notifications = many<{
    id: string;
    telegram_id: string;
    body: string;
    telegram_markup: string | null;
    kind: string;
    reminder_enabled: number;
    created_at: string;
  }>(
    "SELECT n.*,u.telegram_id,u.reminder_enabled FROM notifications n JOIN users u ON u.id=n.user_id WHERE n.status='pending' AND n.attempts<3 AND u.telegram_id IS NOT NULL ORDER BY n.created_at LIMIT 15",
  );
  for (const n of notifications) {
    if (
      n.kind === 'reminder' &&
      (!n.reminder_enabled || Date.now() - Date.parse(n.created_at) > 3600000)
    ) {
      run("UPDATE notifications SET status='skipped' WHERE id=?", n.id);
      continue;
    }
    try {
      await sendTelegram(
        n.telegram_id,
        n.body,
        n.telegram_markup ? JSON.parse(n.telegram_markup) : undefined,
      );
      run("UPDATE notifications SET status='sent',sent_at=?,error=NULL WHERE id=?", now(), n.id);
    } catch (error) {
      run(
        "UPDATE notifications SET attempts=attempts+1,error=?,status=CASE WHEN attempts>=2 OR ?=1 THEN 'failed' ELSE 'pending' END WHERE id=?",
        error instanceof Error ? error.message.slice(0, 300) : 'Telegram xatosi',
        error instanceof TelegramError && error.permanent ? 1 : 0,
        n.id,
      );
    }
  }
}
export function cleanExpired() {
  run(
    "UPDATE course_word_jobs SET status='failed',error='So‘rov uzildi. /dars orqali qayta yuboring.',telegram_file_id=NULL,updated_at=? WHERE status='running' AND updated_at<?",
    now(),
    new Date(Date.now() - 20 * 60000).toISOString(),
  );

  run('DELETE FROM sessions WHERE expires_at<?', now());
  run('DELETE FROM telegram_links WHERE expires_at<?', now());
  run('DELETE FROM rate_limits WHERE expires_at<?', Date.now());
  run(
    'DELETE FROM vocabulary_bot_updates WHERE created_at<?',
    new Date(Date.now() - 7 * 86400000).toISOString(),
  );
  run(
    "UPDATE vocabulary_jobs SET status='failed',error=?,updated_at=? WHERE status='running' AND updated_at<?",
    'Tayyorlash uzildi. Sarfni tekshirib, saytda qayta yuboring.',
    now(),
    new Date(Date.now() - 20 * 60000).toISOString(),
  );
  run(
    "UPDATE vocabulary_jobs SET image_data=NULL,telegram_file_id=NULL WHERE status='failed' AND updated_at<?",
    new Date(Date.now() - 7 * 86400000).toISOString(),
  );
  // Interrupted paid requests are not retried automatically: a teacher explicitly retries them.
  run(
    "UPDATE ai_jobs SET status='failed',error=?,updated_at=? WHERE status='running' AND updated_at<?",
    'Tekshirish uzilib qoldi. Qayta yuborish mumkin; avval AI xizmatidagi sarfni tekshiring.',
    now(),
    new Date(Date.now() - 20 * 60000).toISOString(),
  );
}
