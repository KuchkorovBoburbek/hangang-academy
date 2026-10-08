import { test, expect, type APIRequestContext } from '@playwright/test';
const origin = 'http://localhost:3100';
let teacher: APIRequestContext,
  student: APIRequestContext,
  empty: APIRequestContext,
  legacy: APIRequestContext;
let releaseId: string, releasePosition: number;
const materials = [
  ['reading', 'self', '학교 · Maktab haqida o‘qing'],
  ['listening', 'none', '인사 · Salomlashishni tinglang'],
  ['speaking', 'audio', '자기소개 · O‘zingizni tanishtiring'],
  ['writing', 'text', '나의 하루 · Mening kunim'],
  ['vocabulary', 'none', '학교 · Maktab so‘zlari'],
].map(([kind, task, title]) => ({
  id: crypto.randomUUID(),
  kind,
  task,
  title,
  body: '안녕하세요. 저는 한국어를 공부해요.',
  url: '',
  fileIds: [],
  grammarIds: [],
  topikCategory: '',
  required: true,
  questions: [],
  words:
    kind === 'vocabulary'
      ? [
          { id: crypto.randomUUID(), ko: '학교', uz: 'maktab', example: '', translation: '' },
          { id: crypto.randomUUID(), ko: '친구', uz: 'do‘st', example: '', translation: '' },
        ]
      : [],
}));
test.beforeAll(async ({ playwright }) => {
  const context = () =>
    playwright.request.newContext({ baseURL: origin, extraHTTPHeaders: { Origin: origin } });
  teacher = await context();
  student = await context();
  empty = await context();
  legacy = await context();
  expect(
    (
      await teacher.post('/api/login', {
        data: { email: 'qa-teacher@hangang.local', password: 'Local-QA-Teacher-Only-2026!' },
      })
    ).status(),
  ).toBe(200);
  const original = await (await teacher.get('/api/state')).json();
  for (const name of ['Mobile Hangul', 'Mobile Empty'])
    expect(
      (await teacher.post('/api/teacher/groups', { data: { name, level: 'hangul' } })).status(),
    ).toBe(200);
  const catalog = await (await teacher.get('/api/courses/catalog')).json();
  const group = catalog.groups.find((g: any) => g.name === 'Mobile Hangul');
  const other = catalog.groups.find((g: any) => g.name === 'Mobile Empty');
  for (const [client, name, email, invite] of [
    [student, 'Madina', 'mobile-student@example.test', group.invite_code],
    [empty, 'Aziza', 'mobile-empty@example.test', other.invite_code],
    [legacy, 'Bobur', 'mobile-legacy@example.test', original.groups[0].invite_code],
  ] as const)
    expect(
      (
        await client.post('/api/register', {
          data: { name, email, password: 'Local-Mobile-Test-2026!', invite },
        })
      ).status(),
    ).toBe(200);
  const draft = await (
    await teacher.post('/api/courses/lessons', { data: { courseId: group.course_id } })
  ).json();
  releasePosition = draft.position;
  expect(
    (
      await teacher.post(`/api/courses/lessons/${draft.id}`, {
        data: {
          ...draft,
          title: 'Mening birinchi darsim',
          description: '학교에서 만나요',
          materials,
          warmup: [],
        },
      })
    ).status(),
  ).toBe(200);
  const release = await teacher.post(`/api/courses/lessons/${draft.id}/open`, {
    data: { groupId: group.id, date: '2026-09-22', dueAt: '2026-10-01T12:00:00.000Z' },
  });
  expect(release.status()).toBe(200);
  releaseId = (await release.json()).id;
  expect(
    (
      await teacher.post('/api/teacher/assignments', {
        data: {
          groupId: group.id,
          title: 'Qo‘shimcha insho',
          kind: 'writing',
          prompt: 'Dam olish kuningiz haqida koreys tilida yozing.',
          topicIds: [],
          dueAt: new Date(Date.now() + 7 * 86400000).toISOString(),
        },
      })
    ).status(),
  ).toBe(200);
  expect(
    (
      await student.post(`/api/courses/releases/${releaseId}/complete`, {
        data: { materialId: materials[0].id },
      })
    ).status(),
  ).toBe(200);
  const lesson = await (await student.get(`/api/courses/releases/${releaseId}`)).json();
  const form = new FormData();
  form.set('assignmentId', lesson.tasks.find((t: any) => t.kind === 'writing').assignmentId);
  form.set('body', '저는 매일 한국어를 공부해요.');
  const request = new Request(origin, { method: 'POST', body: form });
  expect(
    (
      await student.post('/api/submissions', {
        headers: { 'Content-Type': request.headers.get('content-type')! },
        data: Buffer.from(await request.arrayBuffer()),
      })
    ).status(),
  ).toBe(200);
});
test.afterAll(async () => {
  await Promise.all([teacher.dispose(), student.dispose(), empty.dispose(), legacy.dispose()]);
});

test('Mobile home shows four real states, preserves access, opens exact practice and keeps five navigation items', async ({
  browser,
}) => {
  const context = await browser.newContext({
    storageState: await student.storageState(),
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /안녕하세요/ })).toBeVisible();
  await expect(page.locator('[data-skill=reading]')).toContainText('Bajarilgan');
  await expect(page.locator('[data-skill=listening]')).toContainText('Vazifa yo‘q');
  await expect(page.locator('[data-skill=speaking]')).toContainText('Bajarish kerak');
  await expect(page.locator('[data-skill=writing]')).toContainText('Tekshirilmoqda');
  await expect(page.getByText('Bajarilishi shart', { exact: true })).toBeVisible();
  await expect(page.locator('.home-required-list .home-task-row')).toHaveCount(3);
  await expect(page.locator('.home-required-list')).toContainText(
    `${releasePosition}-dars · Mening birinchi darsim`,
  );
  await expect(page.getByRole('heading', { name: 'Qo‘shimcha vazifalar' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Qo‘shimcha insho/ })).toBeVisible();
  await expect(page.getByRole('progressbar', { name: 'Vazifalar bajarilishi' })).toHaveAttribute(
    'aria-valuenow',
    '33',
  );
  await expect(
    page.getByRole('navigation', { name: 'Telefon menyusi' }).getByRole('button'),
  ).toHaveCount(5);
  for (const width of [320, 390, 430, 1440]) {
    await page.setViewportSize({ width, height: width === 1440 ? 1100 : 844 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    const cards = await page
      .locator('.home-skill-card')
      .evaluateAll((els) =>
        els.map((el) => ({ x: el.getBoundingClientRect().x, y: el.getBoundingClientRect().y })),
      );
    expect(cards[0].y).toBe(cards[1].y);
    expect(cards[2].y).toBe(cards[3].y);
    expect(cards[0].x).toBe(cards[2].x);
    await page.screenshot({ path: `test-results/student-home-${width}.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .locator('.home-required-list')
    .getByRole('button', { name: /자기소개/ })
    .click();
  await expect(page).toHaveURL(new RegExp(`lessons/${releaseId}#material-${materials[2].id}`));
  await page.goto('/');
  await page.getByRole('button', { name: /Qo‘shimcha insho/ }).click();
  await expect(page).toHaveURL(/\/writing\?assignment=/);
  await expect(page.getByRole('dialog')).toContainText('Qo‘shimcha insho');
  await page.getByRole('button', { name: 'Yopish', exact: true }).click();
  await page.goto('/');
  await page.getByRole('button', { name: '듣기 · Tinglash uchun qo‘shimcha mashqlar' }).click();
  await expect(page.getByRole('dialog')).toContainText('인사 · Salomlashishni tinglang');
  await page.getByRole('button', { name: /인사 · Salomlashishni tinglang/ }).click();
  await expect(page).toHaveURL(new RegExp(`lessons/${releaseId}#material-${materials[1].id}`));
  await expect(page.locator(`#material-${materials[1].id}`)).toBeInViewport();
  await page.goto('/');
  await page.getByRole('button', { name: '쓰기 · Yozish: Tekshirilmoqda' }).click();
  await expect(page.getByRole('dialog')).toContainText('Tekshirilmoqda');
  await page.getByRole('button', { name: 'Yopish', exact: true }).click();
  await page.getByRole('button', { name: 'Yana', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('button', { name: /TOPIK/ })).toHaveCount(0);
  await page.getByRole('dialog').getByRole('button', { name: 'Grammatika', exact: true }).click();
  await expect(page).toHaveURL(/\/grammar$/);
  await page.goto('/');
  await page.getByRole('button', { name: /So‘z yodlaymiz/ }).click();
  await expect(page.locator('.quiz-content')).toBeVisible();
  expect(errors).toHaveLength(0);
  await context.close();
});
test('Empty groups show no invented homework, and legacy students use the same landing', async ({
  browser,
}) => {
  for (const [client, name] of [
    [empty, 'empty'],
    [legacy, 'legacy'],
  ] as const) {
    const context = await browser.newContext({
      storageState: await client.storageState(),
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    await page.goto('/');
    await expect(page.locator('.home-skill-card')).toHaveCount(4);
    if (name === 'empty') {
      await expect(page.locator('.home-skill-card.empty')).toHaveCount(4);
      await page
        .getByRole('button', { name: '말하기 · Gapirish uchun qo‘shimcha mashqlar' })
        .click();
      await expect(page.getByRole('dialog')).toContainText('Hozircha mashq yo‘q');
      await page.getByRole('button', { name: 'Yopish', exact: true }).click();
    } else {
      await expect(page.locator('[data-skill=writing]')).toContainText('Vazifa yo‘q');
      await expect(page.getByRole('heading', { name: 'Qo‘shimcha vazifalar' })).toBeVisible();
      await page.getByRole('button', { name: '읽기 · O‘qish uchun qo‘shimcha mashqlar' }).click();
      await expect(page.getByRole('dialog')).toContainText('TOPIK II · 읽기');
      await page.getByRole('button', { name: 'Yopish', exact: true }).click();
    }
    await page.screenshot({ path: `test-results/student-home-${name}.png`, fullPage: true });
    await context.close();
  }
});
