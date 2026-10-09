import { beforeAll, afterAll, beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHmac } from 'node:crypto';
vi.mock('next/headers', () => ({ cookies: vi.fn() }));
import { resetDbForTests, one, many, run, id, now } from '../lib/db';
import { ensureSeed } from '../lib/seed';
import { verifyTelegram, enforceOrigin } from '../lib/auth';
import {
  startQuiz,
  answerQuiz,
  getSession,
  viewSession,
  submissionAccess,
  withSubmissionDetails,
  feedbackNotification,
} from '../lib/learning';
import { validateFile } from '../lib/files';
import { normalizeReview, evaluateSubmission } from '../lib/ai';
import { aiConfig } from '../lib/ai-config';
import { claimAIJob, queueReminders } from '../lib/worker';
import type { User, Question, Submission } from '../lib/types';
let root: string;
let student: User;
let other: User;
let teacher: User;
beforeAll(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'hangang-test-'));
  process.env.DATA_DIR = root;
  process.env.DEMO_MODE = 'true';
  process.env.ADMIN_EMAIL = 'teacher@hangang.local';
  process.env.ADMIN_PASSWORD = 'HangangTeacher2026!';
  process.env.APP_URL = 'http://localhost:3000';
  ensureSeed();
  student = one<User>('SELECT * FROM users WHERE email=?', 'student@hangang.local')!;
  other = one<User>('SELECT * FROM users WHERE email=?', 'bekzod@hangang.local')!;
  teacher = one<User>("SELECT * FROM users WHERE role='teacher'")!;
});
afterAll(() => {
  resetDbForTests();
  fs.rmSync(root, { recursive: true, force: true });
  vi.unstubAllGlobals();
});

describe('Learning and access boundaries', () => {
  it('keeps answers on the server, separates kinds, rejects duplicate and foreign attempts', () => {
    const s = startQuiz(student, 'vocabulary', 'practice');
    expect(s.question?.kind).toBe('vocabulary');
    expect(s.question).not.toHaveProperty('answer');
    expect(s.question).not.toHaveProperty('explanation');
    const q = one<Question>('SELECT * FROM questions WHERE id=?', s.question!.id)!;
    const response = answerQuiz(student, s.id, q.id, q.answer);
    expect(response.correct).toBe(true);
    expect(response.explanation).toBeTruthy();
    expect(() => answerQuiz(student, s.id, q.id, q.answer)).toThrow('javob berilgan');
    expect(() => getSession(s.id, other)).toThrow('topilmadi');
    expect(startQuiz(student, 'vocabulary', 'practice').id).toBe(s.id);
    expect(startQuiz(student, 'grammar', 'practice').question?.kind).toBe('grammar');
    expect(
      one<{ box: number }>(
        'SELECT box FROM reviews WHERE user_id=? AND question_id=?',
        student.id,
        q.id,
      )?.box,
    ).toBe(1);
  });
  it('completes a test without revealing explanations before the result', () => {
    let s = startQuiz(student, 'grammar', 'test', 'A01');
    let count = 0;
    while (s.status === 'active') {
      const q = one<Question>('SELECT * FROM questions WHERE id=?', s.question!.id)!;
      const result = answerQuiz(student, s.id, q.id, q.answer);
      expect(result.explanation).toBeUndefined();
      s = result.session;
      count++;
    }
    expect(s.score).toBe(count);
    expect(s.results).toHaveLength(count);
    expect(viewSession(getSession(s.id, student)).status).toBe('completed');
  });
  it('keeps submissions private to their owner and teacher, including inside one group', () => {
    const s = one<Submission>('SELECT * FROM submissions WHERE user_id=?', other.id)!;
    expect(() => submissionAccess(student, s.id)).toThrow('kirish huquqi');
    expect(submissionAccess(other, s.id).id).toBe(s.id);
    expect(submissionAccess(teacher, s.id).id).toBe(s.id);
    run(
      'INSERT INTO ai_jobs(id,submission_id,requested_by,model,status,result,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)',
      id(),
      s.id,
      teacher.id,
      'test',
      'completed',
      '{"summary":"private"}',
      now(),
      now(),
    );
    expect(withSubmissionDetails(s, false).ai).toBeNull();
    expect(withSubmissionDetails(s, true).ai?.result).toContain('private');
  });
  it('prevents cross-origin mutations and disguised executable uploads', () => {
    expect(() =>
      enforceOrigin(
        new Request('http://localhost:3000/api/notes', {
          headers: { origin: 'https://evil.test' },
        }),
      ),
    ).toThrow('manbasi');
    expect(() => validateFile(Buffer.from('<script>alert(1)</script>'), 'image/png')).toThrow(
      'faylini',
    );
    expect(() => validateFile(Buffer.from('%PDF-1.7\n'), 'application/pdf')).not.toThrow();
    expect(() => validateFile(Buffer.alloc(6 * 1024 * 1024), 'image/png')).toThrow('5 MB');
  });
});

describe('Telegram identity and reminders', () => {
  function signed(age = 0) {
    const p = new URLSearchParams({
      auth_date: String(Math.floor(Date.now() / 1000) - age),
      user: JSON.stringify({ id: 123456, first_name: 'Aziza' }),
    });
    const check = [...p]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');
    const secret = createHmac('sha256', 'WebAppData').update('test-token').digest();
    p.set('hash', createHmac('sha256', secret).update(check).digest('hex'));
    return p.toString();
  }
  it('accepts signed fresh identity and rejects tampering and expiration', () => {
    expect(verifyTelegram(signed(), 'test-token').id).toBe(123456);
    expect(() => verifyTelegram(signed(), 'other-token')).toThrow('noto‘g‘ri');
    expect(() => verifyTelegram(signed(7200), 'test-token')).toThrow('qayta oching');
  });
  it('deduplicates reminders by the student’s local day', () => {
    run(
      'UPDATE users SET telegram_id=?,reminder_enabled=1,reminder_time=?,timezone=? WHERE id=?',
      '123456',
      '19:00',
      'Asia/Tashkent',
      other.id,
    );
    const date = new Date('2026-10-05T14:10:00Z');
    queueReminders(date);
    queueReminders(date);
    expect(
      many("SELECT * FROM notifications WHERE kind='reminder' AND user_id=?", other.id),
    ).toHaveLength(1);
  });
  it('puts the review outcome and teacher comment directly in Telegram notifications', () => {
    expect(feedbackNotification('Insho', 'success', 'Juda yaxshi yozilgan.', 92)).toContain(
      '✅ SUCCESS\n“Insho”\nBaho: 92/100\n\nUstoz izohi:\nJuda yaxshi yozilgan.',
    );
    expect(feedbackNotification('Gapirish', 'fail', 'Talaffuzni qayta yozing.', 48)).toContain(
      '❌ FAIL · QAYTA TOPSHIRISH KERAK',
    );
  });
});

describe('AI review orchestration', () => {
  beforeEach(() => {
    vi.stubEnv('AI_PROVIDER', 'openai');
    vi.stubEnv('OPENAI_API_KEY', 'test-only');
    vi.stubEnv('OPENROUTER_API_KEY', '');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });
  const review = {
    summary: 'Yaxshi urinish.',
    strengths: ['Maqsad tushunarli.'],
    corrections: [],
    improved_text: '한국어를 배워요.',
    next_steps: ['Sababga misol yozing.'],
    rubric: { task: 20, grammar: 20, vocabulary: 15, coherence: 15 },
    score: 99,
    uncertainty: [],
  };
  it('validates rubric bounds and computes the total independently', () => {
    expect(normalizeReview(review).score).toBe(70);
    expect(() =>
      normalizeReview({ ...review, rubric: { ...review.rubric, grammar: 500 } }),
    ).toThrow();
  });
  it('claims a queued job once', () => {
    const s = one<Submission>('SELECT * FROM submissions LIMIT 1')!;
    run(
      'INSERT INTO ai_jobs(id,submission_id,requested_by,model,created_at,updated_at) VALUES(?,?,?,?,?,?)',
      id(),
      s.id,
      teacher.id,
      'test',
      now(),
      now(),
    );
    expect(claimAIJob()).toBeDefined();
    expect(claimAIJob()).toBeUndefined();
  });
  it('uses structured private Responses requests and never publishes feedback', async () => {
    process.env.OPENAI_API_KEY = 'test-only';
    const mock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          status: 'completed',
          output: [{ content: [{ type: 'output_text', text: JSON.stringify(review) }] }],
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal('fetch', mock);
    const s = one<Submission>('SELECT * FROM submissions LIMIT 1')!;
    fs.mkdirSync(path.join(root, 'uploads'), { recursive: true });
    for (const [mime, name, bytes] of [
      ['image/png', 'answer.png', Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])],
      ['application/pdf', 'answer.pdf', Buffer.from('%PDF-1.4')],
    ] as const) {
      const disk = id();
      fs.writeFileSync(path.join(root, 'uploads', disk), bytes);
      run(
        'INSERT INTO attachments(id,submission_id,name,mime,size,disk_name) VALUES(?,?,?,?,?,?)',
        id(),
        s.id,
        name,
        mime,
        bytes.length,
        disk,
      );
    }
    expect((await evaluateSubmission(s.id, 'test-model')).score).toBe(70);
    const request = JSON.parse(mock.mock.calls[0][1].body);
    expect(request.store).toBe(false);
    expect(request.input[0].content.map((c: { type: string }) => c.type)).toEqual([
      'input_text',
      'input_image',
      'input_file',
    ]);
    expect(request.input[0].content[2].file_data).toMatch(/^data:application\/pdf;base64,/);
    expect(request.text.format.strict).toBe(true);
    expect(request.model).toBe('test-model');
    expect(one<Submission>('SELECT * FROM submissions WHERE id=?', s.id)?.published_at).toBeNull();
    delete process.env.OPENAI_API_KEY;
  });
  it('routes OpenRouter text, image and PDF through its own key and strict schema', async () => {
    vi.stubEnv('AI_PROVIDER', 'openrouter');
    vi.stubEnv('OPENROUTER_API_KEY', 'sk-or-test-only');
    const mock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(review) } }],
        }),
      ),
    );
    vi.stubGlobal('fetch', mock);
    const s = one<Submission>('SELECT * FROM submissions LIMIT 1')!;
    expect((await evaluateSubmission(s.id, 'openai/test-model', 'openrouter')).score).toBe(70);
    const [url, options] = mock.mock.calls[0];
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(options.headers.Authorization).toBe('Bearer sk-or-test-only');
    const request = JSON.parse(options.body);
    expect(request.messages[1].content.map((p: { type: string }) => p.type)).toEqual([
      'text',
      'image_url',
      'file',
    ]);
    expect(request.messages[1].content[2].file.file_data).toMatch(/^data:application\/pdf;base64,/);
    expect(request.plugins[0].pdf.engine).toBe('native');
    expect(request.response_format.json_schema.strict).toBe(true);
    expect(request.provider).toEqual({ require_parameters: true, data_collection: 'deny' });
    expect(JSON.stringify(request)).not.toContain(other.email);
    expect(one<Submission>('SELECT * FROM submissions WHERE id=?', s.id)?.published_at).toBeNull();
  });
  it('rejects a truncated provider answer and credit errors without an automatic paid retry', async () => {
    vi.stubEnv('OPENROUTER_API_KEY', 'sk-or-test-only');
    const mock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [{ finish_reason: 'length', message: { content: JSON.stringify(review) } }],
          }),
        ),
      )
      .mockResolvedValueOnce(new Response('{}', { status: 402 }));
    vi.stubGlobal('fetch', mock);
    const s = one<Submission>('SELECT * FROM submissions LIMIT 1')!;
    await expect(evaluateSubmission(s.id, 'test', 'openrouter')).rejects.toThrow('yakunlanmadi');
    await expect(evaluateSubmission(s.id, 'test', 'openrouter')).rejects.toThrow('balansini');
    expect(mock).toHaveBeenCalledTimes(2);
  });
  it('never sends a misplaced OpenRouter key to OpenAI and respects a queued provider', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'sk-or-legacy-test');
    vi.stubEnv('AI_PROVIDER', '');
    expect(aiConfig().provider).toBe('openrouter');
    expect(aiConfig().key).toBe('sk-or-legacy-test');
    const mock = vi.fn();
    vi.stubGlobal('fetch', mock);
    await expect(evaluateSubmission('unused', 'test', 'openai')).rejects.toThrow(
      'kaliti sozlanmagan',
    );
    expect(mock).not.toHaveBeenCalled();
  });
});
