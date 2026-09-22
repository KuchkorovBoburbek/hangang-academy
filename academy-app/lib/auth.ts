import { createHash, randomBytes, createHmac, timingSafeEqual } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { one, run, now } from './db';
import type { User } from './types';
export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
export const safeUser = (u: User) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  content_editor: u.content_editor || 0,
  group_id: u.group_id,
  telegram_id: u.telegram_id,
  timezone: u.timezone,
  reminder_time: u.reminder_time,
  reminder_enabled: u.reminder_enabled,
  created_at: u.created_at,
});
export async function currentUser(): Promise<User | null> {
  const token = (await cookies()).get('hangang_session')?.value;
  if (!token) return null;
  const user = one<User>(
    'SELECT u.* FROM sessions s JOIN users u ON s.user_id=u.id WHERE s.token_hash=? AND s.expires_at>?',
    hashToken(token),
    now(),
  );
  return user || null;
}
export async function requireUser() {
  const user = await currentUser();
  if (!user) throw new AppError(401, 'Hisobingizga kiring.');
  return user;
}
export function requireTeacher(user: User) {
  if (user.role !== 'teacher') throw new AppError(403, 'Bu bo‘lim o‘qituvchilar uchun.');
}
export function teacherGroup(user: User, groupId: string) {
  requireTeacher(user);
  if (!one('SELECT id FROM groups WHERE id=? AND teacher_id=?', groupId, user.id))
    throw new AppError(403, 'Bu guruhga kirish huquqi yo‘q.');
}
export async function signIn(userId: string) {
  const token = randomBytes(32).toString('base64url');
  const expires = new Date(Date.now() + 14 * 86400000);
  run('DELETE FROM sessions WHERE expires_at<?', now());
  run(
    'INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)',
    hashToken(token),
    userId,
    expires.toISOString(),
  );
  (await cookies()).set('hangang_session', token, {
    httpOnly: true,
    secure: (process.env.APP_URL || '').startsWith('https:'),
    sameSite: 'lax',
    path: '/',
    expires,
  });
}
export async function signOut() {
  const jar = await cookies();
  const token = jar.get('hangang_session')?.value;
  if (token) run('DELETE FROM sessions WHERE token_hash=?', hashToken(token));
  jar.delete('hangang_session');
}
export const hashPassword = (s: string) => bcrypt.hashSync(s, 12);
export const checkPassword = (p: string, h: string) => bcrypt.compareSync(p, h);
export function enforceOrigin(request: Request) {
  const origin = request.headers.get('origin');
  const expected = new URL(process.env.APP_URL || request.url).origin;
  if (!origin || origin !== expected)
    throw new AppError(403, 'So‘rov manbasi tasdiqlanmadi. Sahifani yangilang.');
}
export function rateLimit(key: string, limit = 20, windowMs = 60000) {
  const t = Date.now();
  const r = one<{ count: number; expires_at: number }>(
    'SELECT * FROM rate_limits WHERE key=?',
    key,
  );
  if (!r || r.expires_at < t) {
    run(
      'INSERT INTO rate_limits(key,count,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=1,expires_at=excluded.expires_at',
      key,
      t + windowMs,
    );
    return;
  }
  if (r.count >= limit)
    throw new AppError(429, 'Juda ko‘p urinish. Birozdan keyin qayta urinib ko‘ring.');
  run('UPDATE rate_limits SET count=count+1 WHERE key=?', key);
}
export function verifyTelegram(initData: string, botToken: string) {
  const data = new URLSearchParams(initData);
  const hash = data.get('hash');
  if (!hash || !/^[a-f0-9]{64}$/i.test(hash))
    throw new AppError(401, 'Telegram tasdig‘i yaroqsiz.');
  data.delete('hash');
  const check = Array.from(data.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const expected = createHmac('sha256', secret).update(check).digest();
  if (!timingSafeEqual(expected, Buffer.from(hash, 'hex')))
    throw new AppError(401, 'Telegram tasdig‘i noto‘g‘ri.');
  const auth = Number(data.get('auth_date'));
  if (!auth || auth > Date.now() / 1000 + 60 || Date.now() / 1000 - auth > 3600)
    throw new AppError(401, 'Telegram oynasini qayta oching.');
  let tg;
  try {
    tg = JSON.parse(data.get('user') || '{}');
  } catch {
    throw new AppError(401, 'Telegram foydalanuvchisi aniqlanmadi.');
  }
  if (!Number.isSafeInteger(tg.id) || typeof tg.first_name !== 'string')
    throw new AppError(401, 'Telegram foydalanuvchisi aniqlanmadi.');
  return tg as { id: number; first_name: string; last_name?: string };
}

export function requireContentEditor(user: User) {
  if (!one("SELECT id FROM users WHERE id=? AND role='teacher' AND content_editor=1", user.id))
    throw new AppError(403, 'Yechimlarni faqat bosh ustoz yoki admin tahrirlay oladi.');
}
