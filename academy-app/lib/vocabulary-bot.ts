import { z } from 'zod';
import { many, one, run, transaction, now } from './db';
import { AppError, rateLimit } from './auth';
import { sendTelegram } from './telegram';
import { queueVocabularyJob, vocabularyNotification, validateVocabularyGroups } from './vocabulary';
import {
  VOCABULARY_SECTIONS,
  VOCABULARY_BANDS,
  bandLabel,
  sectionLabel,
  type VocabularySection,
} from './vocabulary-types';
import type { User } from './types';

const sender = z.object({ id: z.number().int().positive(), is_bot: z.boolean().optional() });
const chat = z.object({ id: z.number().int(), type: z.string() });
const message = z.object({
  from: sender.optional(),
  chat,
  text: z.string().max(10000).optional(),
  caption: z.string().max(10000).optional(),
  photo: z
    .array(z.object({ file_id: z.string().max(300), file_size: z.number().optional() }))
    .max(20)
    .optional(),
  document: z
    .object({
      file_id: z.string().max(300),
      mime_type: z.string().optional(),
      file_size: z.number().optional(),
    })
    .optional(),
});
const updateSchema = z.object({
  update_id: z.number().int().nonnegative(),
  message: message.optional(),
  callback_query: z
    .object({
      id: z.string().max(200),
      from: sender,
      data: z.string().max(64).optional(),
      message: z.object({ chat }).optional(),
    })
    .optional(),
});
type BotState = {
  user_id: string;
  section: VocabularySection;
  category: string;
  group_ids: string;
  stage: 'section' | 'category' | 'groups' | 'ready';
  updated_at: string;
};
type Button = { text: string; callback_data: string };
const rows = (buttons: Button[], width = 3) =>
  Array.from({ length: Math.ceil(buttons.length / width) }, (_, i) =>
    buttons.slice(i * width, (i + 1) * width),
  );
function menu(user: User, state: BotState, key: string) {
  const cancel = [{ text: 'Bekor qilish', callback_data: 'v:cancel' }];
  let text = '',
    buttons: Button[][] = [];
  if (state.stage === 'section') {
    text = 'Lug‘at yordamchisi 🌿\nQaysi TOPIK bo‘limiga so‘z qo‘shamiz?';
    buttons = [
      VOCABULARY_SECTIONS.map((s) => ({
        text: `${s.ko} · ${s.label}`,
        callback_data: `v:section:${s.id}`,
      })),
      cancel,
    ];
  } else if (state.stage === 'category') {
    text = `${sectionLabel(state.section)} · Qaysi savollar uchun?`;
    buttons = [
      ...rows(
        VOCABULARY_BANDS[state.section].map((b) => ({
          text: bandLabel(b),
          callback_data: `v:band:${b}`,
        })),
      ),
      [{ text: '← Bo‘lim', callback_data: 'v:back' }],
      cancel,
    ];
  } else if (state.stage === 'groups') {
    const selected: string[] = JSON.parse(state.group_ids);
    text = `${sectionLabel(state.section)} · ${bandLabel(state.category)}\nSo‘zlar qaysi guruhlarga qo‘shilsin? Bir nechtasini tanlashingiz mumkin. Yangi so‘zlar saqlangach, ularga bildirishnoma boradi.`;
    buttons = many<{ id: string; name: string }>(
      'SELECT id,name FROM groups WHERE teacher_id=? ORDER BY name',
      user.id,
    ).map((g) => [
      {
        text: `${selected.includes(g.id) ? '✓ ' : ''}${g.name}`.slice(0, 60),
        callback_data: `v:group:${g.id}`,
      },
    ]);
    buttons.push([{ text: 'Tanlov tayyor →', callback_data: 'v:ready' }], cancel);
  } else {
    const groupNames = many<{ id: string; name: string }>(
      'SELECT id,name FROM groups WHERE teacher_id=?',
      user.id,
    )
      .filter((g) => JSON.parse(state.group_ids).includes(g.id))
      .map((g) => g.name);
    text = `Tayyor! ${sectionLabel(state.section)} · ${bandLabel(state.category)}\nGuruhlar: ${groupNames.join(', ')}\n\nKoreyscha so‘zlarni yozing yoki bitta rasm yuboring (5 MB gacha). Bir so‘rovda 40 tagacha so‘z. Aniq o‘qilgan so‘zlar tarjima va misol bilan avtomatik saqlanadi; takrorlari o‘zgartirilmaydi.\n\nBu tanlov 24 soat amal qiladi. Boshqa bo‘lim yoki guruh: /lugat. Tugatish: /bekor.`;
    buttons = [[{ text: 'Tanlovni o‘zgartirish', callback_data: 'v:back' }], cancel];
  }
  vocabularyNotification(user.id, text, key, { inline_keyboard: buttons });
}
export async function handleVocabularyBot(raw: unknown): Promise<boolean> {
  const parsed = updateSchema.safeParse(raw);
  if (!parsed.success) return false;
  const update = parsed.data;
  const callback = update.callback_query;
  const msg = update.message;
  if (callback && !callback.data?.startsWith('v:')) return false;
  const actor = callback?.from || msg?.from;
  const room = callback?.message?.chat || msg?.chat;
  if (!actor || actor.is_bot || room?.type !== 'private' || room.id !== actor.id) return false;
  const user = one<User>('SELECT * FROM users WHERE telegram_id=?', String(actor.id));
  const command = (msg?.text || '').split(/\s/)[0].split('@')[0].toLowerCase();
  if (command === '/start') return false;
  if (!user || user.role !== 'teacher') {
    if (command === '/lugat' || callback) {
      rateLimit(`vocab-bot-unlinked:${actor.id}`, 3, 60000);
      if (user)
        vocabularyNotification(
          user.id,
          'Lug‘at qo‘shish faqat ustoz uchun. Ustoz hisobini saytdagi Sozlamalar → Telegram orqali bog‘lang.',
          `vocab-denied:${update.update_id}`,
        );
      else
        await sendTelegram(
          String(actor.id),
          'Lug‘at yordamchisi ustozlar uchun. Avval ustoz hisobiga kirib, Sozlamalar → Telegram orqali hisobingizni bog‘lang.',
        );
      return true;
    }
    return false;
  }
  if (callback) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (token)
      await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callback_query_id: callback.id }),
        signal: AbortSignal.timeout(5000),
      }).catch(() => undefined);
  }
  if (one('SELECT update_id FROM vocabulary_bot_updates WHERE update_id=?', update.update_id))
    return true;
  rateLimit(`vocab-bot:${user.id}`, 80, 60000);
  let state = one<BotState>('SELECT * FROM vocabulary_bot_state WHERE user_id=?', user.id);
  if (state && Date.parse(state.updated_at) < Date.now() - 86400000) state = undefined;
  const key = `vocab-bot:${update.update_id}`;
  try {
    if (command === '/bekor' || command === '/cancel' || callback?.data === 'v:cancel') {
      transaction(() => {
        run('DELETE FROM vocabulary_bot_state WHERE user_id=?', user.id);
        vocabularyNotification(
          user.id,
          'Lug‘at kiritish tugatildi. Yana boshlash uchun /lugat yuboring.',
          key,
        );
        run(
          'INSERT OR IGNORE INTO vocabulary_bot_updates(update_id,created_at) VALUES(?,?)',
          update.update_id,
          now(),
        );
      });
      return true;
    }
    if (
      command === '/lugat' ||
      command === '/vocabulary' ||
      callback ||
      !state ||
      state.stage !== 'ready'
    ) {
      transaction(() => {
        if (one('SELECT update_id FROM vocabulary_bot_updates WHERE update_id=?', update.update_id))
          return;
        if (!many('SELECT id FROM groups WHERE teacher_id=?', user.id).length)
          throw new AppError(400, 'Avval saytda guruh yarating. Keyin /lugat yuboring.');
        let next: BotState = state || {
          user_id: user.id,
          section: 'reading',
          category: 'general',
          group_ids: '[]',
          stage: 'section',
          updated_at: now(),
        };
        const action = callback?.data || '';
        if (command === '/lugat' || command === '/vocabulary' || action === 'v:back')
          next = { ...next, stage: 'section' };
        else if (action.startsWith('v:section:')) {
          const section = action.slice('v:section:'.length) as VocabularySection;
          if (!VOCABULARY_SECTIONS.some((s) => s.id === section))
            throw new AppError(400, 'Bo‘limni qayta tanlang.');
          next = { ...next, section, category: 'general', stage: 'category' };
        } else if (action.startsWith('v:band:') && next.stage === 'category') {
          const category = action.slice('v:band:'.length);
          if (!VOCABULARY_BANDS[next.section].includes(category))
            throw new AppError(400, 'Diapazonni qayta tanlang.');
          next = { ...next, category, group_ids: '[]', stage: 'groups' };
        } else if (action.startsWith('v:group:') && next.stage === 'groups') {
          const gid = action.slice('v:group:'.length);
          validateVocabularyGroups(user, [gid]);
          const selected: string[] = JSON.parse(next.group_ids);
          next = {
            ...next,
            group_ids: JSON.stringify(
              selected.includes(gid) ? selected.filter((x) => x !== gid) : [...selected, gid],
            ),
          };
        } else if (action === 'v:ready' && next.stage === 'groups') {
          validateVocabularyGroups(user, JSON.parse(next.group_ids));
          next = { ...next, stage: 'ready' };
        }
        run(
          'INSERT INTO vocabulary_bot_state(user_id,section,category,group_ids,stage,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET section=excluded.section,category=excluded.category,group_ids=excluded.group_ids,stage=excluded.stage,updated_at=excluded.updated_at',
          user.id,
          next.section,
          next.category,
          next.group_ids,
          next.stage,
          now(),
        );
        menu(user, next, key);
        run(
          'INSERT OR IGNORE INTO vocabulary_bot_updates(update_id,created_at) VALUES(?,?)',
          update.update_id,
          now(),
        );
      });
      return true;
    }
    if (command.startsWith('/')) {
      vocabularyNotification(
        user.id,
        'So‘zlar yoki rasm yuboring. Tanlovni o‘zgartirish: /lugat. Tugatish: /bekor.',
        key,
      );
    } else {
      const photo = msg?.photo?.at(-1);
      const file = photo || msg?.document;
      if (file && (file.file_size || 0) > 5 * 1024 * 1024)
        throw new AppError(400, 'Rasm 5 MB dan kichik bo‘lsin.');
      if (
        !photo &&
        msg?.document &&
        !['image/jpeg', 'image/png', 'image/webp'].includes(msg.document.mime_type || '')
      )
        throw new AppError(400, 'JPG, PNG yoki WebP rasm yuboring.');
      const queued = queueVocabularyJob(
        user,
        { section: state.section, category: state.category, groupIds: JSON.parse(state.group_ids) },
        {
          text: msg?.text || msg?.caption || '',
          telegramFileId: file?.file_id,
          source: 'telegram',
          requestKey: `telegram:${update.update_id}`,
        },
      );
      vocabularyNotification(
        user.id,
        `So‘zlar qabul qilindi ⏳\n${sectionLabel(queued.section)} · ${bandLabel(queued.category)}\nTarjima, misol va saqlash tugagach, natijani shu yerga yuboraman.`,
        key,
      );
    }
    run(
      'INSERT OR IGNORE INTO vocabulary_bot_updates(update_id,created_at) VALUES(?,?)',
      update.update_id,
      now(),
    );
  } catch (error) {
    if (!(error instanceof AppError) && !(error instanceof z.ZodError)) throw error;
    vocabularyNotification(
      user.id,
      error instanceof AppError
        ? error.message
        : 'So‘z yoki tanlov ma’lumoti yaroqsiz. /lugat orqali qayta tanlang.',
      `${key}:error`,
    );
    run(
      'INSERT OR IGNORE INTO vocabulary_bot_updates(update_id,created_at) VALUES(?,?)',
      update.update_id,
      now(),
    );
  }
  return true;
}
