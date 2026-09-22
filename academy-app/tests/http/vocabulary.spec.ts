import { test, expect, type APIRequestContext } from '@playwright/test';
let teacher: APIRequestContext, student: APIRequestContext, other: APIRequestContext;
let groupId: string, otherGroupId: string;
const origin = 'http://localhost:3100';
test.beforeAll(async ({ playwright }) => {
  const context = () =>
    playwright.request.newContext({ baseURL: origin, extraHTTPHeaders: { Origin: origin } });
  teacher = await context();
  student = await context();
  other = await context();
  expect(
    (
      await teacher.post('/api/login', {
        data: { email: 'qa-teacher@hangang.local', password: 'Local-QA-Teacher-Only-2026!' },
      })
    ).status(),
  ).toBe(200);
  const state = await (await teacher.get('/api/state')).json();
  groupId = state.groups[0].id;
  expect(
    (
      await teacher.post('/api/teacher/groups', {
        data: { name: 'Vocabulary other group', level: '3', grammarIds: [], vocabularyIds: [] },
      })
    ).status(),
  ).toBe(200);
  const after = await (await teacher.get('/api/state')).json();
  const otherGroup = after.groups.find(
    (g: { name: string }) => g.name === 'Vocabulary other group',
  );
  otherGroupId = otherGroup.id;
  for (const [client, name, invite] of [
    [student, 'vocabstudent', state.groups[0].invite_code],
    [other, 'vocabother', otherGroup.invite_code],
  ] as const) {
    expect(
      (
        await client.post('/api/register', {
          data: { name, email: `${name}@example.test`, password: 'Vocabulary-Test-2026!', invite },
        })
      ).status(),
    ).toBe(200);
  }
});
test.afterAll(async () => {
  await Promise.all([teacher.dispose(), student.dispose(), other.dispose()]);
});

test('Three vocabulary sections, saved manual words, teacher edits and group access work through HTTP', async () => {
  const reading = await (await student.get('/api/vocabulary?section=reading&category=1-4')).json();
  expect(reading.items.length).toBeGreaterThan(0);
  expect(reading.items.every((w: { section: string }) => w.section === 'reading')).toBe(true);
  expect((await student.get('/api/vocabulary?section=writing&category=1-4')).status()).toBe(400);
  const input = {
    ko: '흐름도',
    uz: 'oqim diagrammasi',
    pos: 'Ot',
    example: '흐름도를 그려요.',
    translation: 'Oqim diagrammasini chizaman.',
    kind: 'word',
    section: 'writing',
    categories: ['53'],
  };
  expect(
    (
      await student.post('/api/teacher/vocabulary/word', { data: { input, groupIds: [groupId] } })
    ).status(),
  ).toBe(403);
  const created = await teacher.post('/api/teacher/vocabulary/word', {
    data: { input, groupIds: [groupId], requestKey: crypto.randomUUID() },
  });
  expect(created.status()).toBe(200);
  const { id } = await created.json();
  expect(
    (await (await student.get('/api/vocabulary?section=writing&category=53')).json()).items.some(
      (w: { id: string }) => w.id === id,
    ),
  ).toBe(true);
  expect(
    (await (await other.get('/api/vocabulary?section=writing')).json()).items.some(
      (w: { id: string }) => w.id === id,
    ),
  ).toBe(false);
  expect(
    (
      await other.post('/api/study/word', {
        data: { wordId: id, remembered: true, eventKey: crypto.randomUUID() },
      })
    ).status(),
  ).toBe(404);
  expect(
    (
      await student.post('/api/study/word', {
        data: { wordId: id, remembered: false, eventKey: crypto.randomUUID() },
      })
    ).status(),
  ).toBe(200);
  expect(
    (
      await teacher.post('/api/teacher/vocabulary/word', {
        data: { id, revision: 0, input: { ...input, uz: 'jarayon sxemasi' } },
      })
    ).status(),
  ).toBe(200);
  expect(
    (
      await teacher.post('/api/teacher/vocabulary/word', { data: { id, revision: 0, input } })
    ).status(),
  ).toBe(409);
  const edited = (await (await student.get('/api/vocabulary?section=writing')).json()).items.find(
    (w: { id: string }) => w.id === id,
  );
  expect(edited.uz).toBe('jarayon sxemasi');
  expect(edited.revision).toBe(1);
  expect((await student.get('/api/teacher/vocabulary/jobs')).status()).toBe(403);
  expect((await teacher.get('/api/teacher/vocabulary/jobs')).status()).toBe(200);
});

test('Vocabulary endpoints enforce origin, return safe errors when AI is unconfigured and keep secrets out of responses', async () => {
  const payload = {
    input: {
      ko: '새말',
      uz: 'yangi so‘z',
      pos: 'Ot',
      example: '새말을 배워요.',
      translation: 'Yangi so‘z o‘rganaman.',
      kind: 'word',
      section: 'listening',
      categories: ['1-5'],
    },
    groupIds: [otherGroupId],
  };
  expect(
    (
      await teacher.post('/api/teacher/vocabulary/word', {
        headers: { Origin: 'https://evil.invalid' },
        data: payload,
      })
    ).status(),
  ).toBe(403);
  const form = new FormData();
  form.set('section', 'reading');
  form.set('category', '1-4');
  form.append('groupIds', groupId);
  form.set('requestKey', crypto.randomUUID());
  form.set('text', '도전');
  const request = new Request(origin, { method: 'POST', body: form });
  const result = await teacher.post('/api/teacher/vocabulary/import', {
    headers: { 'Content-Type': request.headers.get('content-type')! },
    data: Buffer.from(await request.arrayBuffer()),
  });
  expect(result.status()).toBe(503);
  expect((await result.json()).error).toContain('hali ulanmagan');
  const publicItems = JSON.stringify(await (await student.get('/api/vocabulary')).json());
  expect(publicItems).not.toContain('password_hash');
  expect(publicItems).not.toContain('API_KEY');
  expect(publicItems).not.toContain('image_data');
});

test('Vocabulary screens work on desktop and mobile with teacher editing and student flashcards', async ({
  browser,
}) => {
  const context = await browser.newContext({
    baseURL: origin,
    storageState: await teacher.storageState(),
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/vocabulary');
  await expect(page.getByRole('heading', { name: /So‘zdan boshlanadi/ })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'TOPIK 읽기 O‘qish lug‘ati' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(page.getByRole('button', { name: /— tahrirlash/ }).first()).toBeVisible();
  await page.screenshot({ path: 'test-results/vocabulary-teacher-desktop.png' });
  await page.getByRole('button', { name: 'AI bilan qo‘shish' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByLabel('TOPIK bo‘limi', { exact: true }).selectOption('listening');
  await page.getByLabel('Savollar diapazoni', { exact: true }).selectOption('6-10');
  await page.getByLabel('Koreyscha so‘zlar', { exact: true }).fill('경험\n참여하다');
  await page.screenshot({ path: 'test-results/vocabulary-assistant-desktop.png' });
  await page.getByRole('button', { name: 'Yopish', exact: true }).click();
  await page.getByRole('tab', { name: 'TOPIK 쓰기 Yozish lug‘ati' }).click();
  await page.getByRole('button', { name: '흐름도 — tahrirlash' }).click();
  await page.getByLabel('O‘zbekcha ma’nosi', { exact: true }).fill('jarayon chizmasi');
  await page.getByRole('button', { name: 'Saqlash', exact: true }).click();
  await expect(page.getByText('jarayon chizmasi', { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'test-results/vocabulary-teacher-mobile.png' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await context.close();
  const learner = await browser.newContext({
    baseURL: origin,
    storageState: await student.storageState(),
    viewport: { width: 390, height: 844 },
  });
  const p = await learner.newPage();
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto('/vocabulary/writing');
  await expect(p.getByText('jarayon chizmasi', { exact: true })).toBeVisible();
  await expect(p.getByRole('button', { name: /tahrirlash/ })).toHaveCount(0);
  await p.getByRole('button', { name: '흐름도 — daftarimga' }).click();
  await p.getByLabel('Shaxsiy izohim').fill('Diagramma so‘zini misol bilan eslayman.');
  await p.getByRole('button', { name: 'Daftarimga saqlash', exact: true }).click();
  await expect(p.getByRole('dialog')).toHaveCount(0);
  const privateState = await (await student.get('/api/state')).json();
  expect(
    privateState.notes.some(
      (n: { title: string; body: string }) =>
        n.title === '흐름도' && n.body.includes('Diagramma so‘zini'),
    ),
  ).toBe(true);
  await p.getByRole('button', { name: 'Kartalar bilan mashq' }).click();
  await p.getByRole('button', { name: 'Ma’nosini ochish' }).click();
  await p.getByRole('button', { name: 'Esladim', exact: true }).click();
  await expect(p.getByRole('heading', { name: 'Kartalar yakunlandi' })).toBeVisible();
  await p.goto('/vocabulary/reading');
  await expect(p.getByRole('heading', { name: 'TOPIK uchun faol lug‘at' })).toBeVisible();
  await p.screenshot({ path: 'test-results/vocabulary-student-mobile.png' });
  expect(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await p.goto('/topik/vocabulary');
  await expect(p).toHaveURL(/\/vocabulary\/reading$/);
  await p.goto('/topik');
  await expect(
    p.locator('.topik-tabs').getByRole('button', { name: 'Lug‘at', exact: true }),
  ).toHaveCount(0);
  expect(errors).toEqual([]);
  await learner.close();
});
