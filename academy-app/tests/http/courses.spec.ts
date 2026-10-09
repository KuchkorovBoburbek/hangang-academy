import { test, expect, type APIRequestContext } from '@playwright/test';
let teacher: APIRequestContext,
  student: APIRequestContext,
  groupmate: APIRequestContext,
  outsider: APIRequestContext;
let group: any, lesson: any, releaseId: string, otherGroup: any;
const origin = 'http://localhost:3100';
const material = (kind: string, task: string) => ({
  id: crypto.randomUUID(),
  kind,
  title:
    kind === 'vocabulary'
      ? 'Oila lug‘ati'
      : kind === 'grammar'
        ? 'Maqsad va sabab grammatikasi'
        : 'Oilangizni tanishtiring',
  body:
    kind === 'grammar'
      ? 'Oilangiz haqida gapirganda maqsad va sababni to‘g‘ri ifodalang.'
      : 'Oila a’zolaringiz haqida yozing.',
  url: '',
  fileIds: [],
  words:
    kind === 'vocabulary'
      ? [
          {
            id: crypto.randomUUID(),
            ko: '가족',
            uz: 'oila',
            example: '우리 가족이에요.',
            translation: 'Bu bizning oilamiz.',
          },
          {
            id: crypto.randomUUID(),
            ko: '동생',
            uz: 'uka yoki singil',
            example: '동생이 있어요.',
            translation: 'Ukam bor.',
          },
        ]
      : [],
  grammarIds: kind === 'grammar' ? ['A04', 'A12', 'S1A-01-01'] : [],
  topikCategory: '',
  task,
  required: true,
  questions: [],
});
test.beforeAll(async ({ playwright }) => {
  const context = () =>
    playwright.request.newContext({ baseURL: origin, extraHTTPHeaders: { Origin: origin } });
  teacher = await context();
  student = await context();
  groupmate = await context();
  outsider = await context();
  expect(
    (
      await teacher.post('/api/login', {
        data: { email: 'qa-teacher@hangang.local', password: 'Local-QA-Teacher-Only-2026!' },
      })
    ).status(),
  ).toBe(200);
  for (const name of ['Course morning', 'Course evening'])
    expect(
      (await teacher.post('/api/teacher/groups', { data: { name, level: 'hangul' } })).status(),
    ).toBe(200);
  const catalog = await (await teacher.get('/api/courses/catalog')).json();
  group = catalog.groups.find((g: any) => g.name === 'Course morning');
  otherGroup = catalog.groups.find((g: any) => g.name === 'Course evening');
  for (const [client, name, invite] of [
    [student, 'coursestudent', group.invite_code],
    [groupmate, 'coursegroupmate', group.invite_code],
    [outsider, 'courseoutside', otherGroup.invite_code],
  ] as const)
    expect(
      (
        await client.post('/api/register', {
          data: { name, email: `${name}@example.test`, password: 'Course-Test-2026!', invite },
        })
      ).status(),
    ).toBe(200);
  lesson = await (
    await teacher.post('/api/courses/lessons', { data: { courseId: group.course_id } })
  ).json();
  lesson = await (
    await teacher.post(`/api/courses/lessons/${lesson.id}`, {
      data: {
        ...lesson,
        title: 'Oila — 가족',
        description: 'Oila a’zolarini tanishtirishni o‘rganamiz.',
        youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        materials: [
          material('vocabulary', 'self'),
          material('writing', 'text'),
          material('speaking', 'audio'),
          material('grammar', 'none'),
        ],
        warmup: [
          {
            id: crypto.randomUUID(),
            prompt: '가족 tarjimasi?',
            options: ['Oila', 'Maktab'],
            answer: 0,
            explanation: '가족 — oila.',
          },
        ],
      },
    })
  ).json();
});
test.afterAll(async () => {
  await Promise.all([
    teacher.dispose(),
    student.dispose(),
    groupmate.dispose(),
    outsider.dispose(),
  ]);
});
test('Drafts and attachments stay private; publishing to one group never opens another group', async () => {
  expect((await student.get(`/api/courses/lessons/${lesson.id}`)).status()).toBe(403);
  expect((await student.get('/api/courses/bank')).status()).toBe(403);
  expect((await student.get('/api/vocabulary')).status()).toBe(200);
  expect((await (await student.get('/api/vocabulary')).json()).items).toHaveLength(0);
  expect((await student.get('/api/topik/catalog')).status()).toBe(403);
  expect((await student.post('/api/study/daily', { data: { minutes: 10 } })).status()).toBe(403);
  const form = new FormData();
  form.set(
    'file',
    new Blob([Buffer.from('%PDF-1.4\nTest fixture\n%%EOF')], { type: 'application/pdf' }),
    'lesson.pdf',
  );
  const request = new Request(origin, { method: 'POST', body: form });
  const uploaded = await teacher.post(`/api/courses/lessons/${lesson.id}/files`, {
    headers: { 'Content-Type': request.headers.get('content-type')! },
    data: Buffer.from(await request.arrayBuffer()),
  });
  expect(uploaded.status()).toBe(200);
  const file = await uploaded.json();
  expect((await student.get(`/api/courses/files/${file.id}`)).status()).toBe(404);
  lesson = await (
    await teacher.post(`/api/courses/lessons/${lesson.id}`, {
      data: {
        ...lesson,
        materials: lesson.materials.map((m: any, i: number) =>
          i === 1 ? { ...m, fileIds: [file.id] } : m,
        ),
      },
    })
  ).json();
  const opened = await teacher.post(`/api/courses/lessons/${lesson.id}/open`, {
    data: { groupId: group.id, date: '2026-09-22', dueAt: '2026-10-01T12:00:00.000Z' },
  });
  expect(opened.status()).toBe(200);
  releaseId = (await opened.json()).id;
  expect((await student.get(`/api/courses/files/${file.id}`)).status()).toBe(200);
  expect((await outsider.get(`/api/courses/files/${file.id}`)).status()).toBe(404);
  expect((await outsider.get(`/api/courses/releases/${releaseId}`)).status()).toBe(404);
  expect((await (await outsider.get('/api/courses/mine')).json()).releases).toHaveLength(0);
  const view = await (await student.get(`/api/courses/releases/${releaseId}`)).json();
  expect(view.snapshot.warmup).toHaveLength(0);
  expect(view.snapshot.youtubeUrl).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  expect(JSON.stringify(view)).not.toContain('"answer":');
  expect((await (await student.get('/api/vocabulary')).json()).items.map((w: any) => w.ko)).toEqual(
    ['가족', '동생'],
  );
  expect(
    (
      await teacher.post(`/api/courses/lessons/${lesson.id}`, {
        headers: { Origin: 'https://evil.invalid' },
        data: lesson,
      })
    ).status(),
  ).toBe(403);
});
test('Student work is private to its owner while teachers retain the complete group view', async () => {
  const view = await (await student.get(`/api/courses/releases/${releaseId}`)).json();
  expect(
    (
      await student.post(`/api/courses/releases/${releaseId}/complete`, {
        data: { materialId: lesson.materials[0].id },
      })
    ).status(),
  ).toBe(200);
  const files = [null, Buffer.from('ID3test-audio')];
  const submissions: string[] = [];
  for (let i = 1; i < 3; i++) {
    const t = view.tasks.find((t: any) => t.materialId === lesson.materials[i].id);
    const form = new FormData();
    form.set('assignmentId', t.assignmentId);
    form.set('body', 'PRIVATE COURSE WORK');
    if (files[i - 1])
      form.append('files', new Blob([files[i - 1]!], { type: 'audio/mpeg' }), 'voice.mp3');
    const req = new Request(origin, { method: 'POST', body: form });
    const response = await student.post('/api/submissions', {
      headers: { 'Content-Type': req.headers.get('content-type')! },
      data: Buffer.from(await req.arrayBuffer()),
    });
    expect(response.status()).toBe(200);
    submissions.push((await response.json()).id);
  }
  const groupmateView = await (await groupmate.get(`/api/courses/releases/${releaseId}`)).json();
  const groupmateTask = groupmateView.tasks.find(
    (task: any) => task.materialId === lesson.materials[1].id,
  );
  const groupmateForm = new FormData();
  groupmateForm.set('assignmentId', groupmateTask.assignmentId);
  groupmateForm.set('body', 'PRIVATE GROUPMATE WORK');
  const groupmateRequest = new Request(origin, { method: 'POST', body: groupmateForm });
  expect(
    (
      await groupmate.post('/api/submissions', {
        headers: { 'Content-Type': groupmateRequest.headers.get('content-type')! },
        data: Buffer.from(await groupmateRequest.arrayBuffer()),
      })
    ).status(),
  ).toBe(200);
  expect(
    (await (await student.get(`/api/courses/board/${group.id}`)).json()).students[0].lessons[0]
      .status,
  ).toBe('submitted');
  for (const sid of submissions)
    expect(
      (
        await teacher.post('/api/teacher/feedback', {
          data: {
            submissionId: sid,
            feedback: 'Guruhga ko‘rinadigan ustoz izohi: yaxshi bajarilgan.',
            score: 90,
            outcome: 'success',
          },
        })
      ).status(),
    ).toBe(200);
  const board = await (await student.get(`/api/courses/board/${group.id}`)).json();
  expect(board.students[0].lessons[0].status).toBe('done');
  expect(board.submissions).toHaveLength(2);
  expect(board.submissions.every((item: any) => item.review_outcome === 'success')).toBe(true);
  expect(JSON.stringify(board)).toContain('Guruhga ko‘rinadigan ustoz izohi');
  expect(JSON.stringify(board)).not.toContain('PRIVATE GROUPMATE WORK');
  const teacherBoard = await (await teacher.get(`/api/courses/board/${group.id}`)).json();
  expect(teacherBoard.submissions).toHaveLength(3);
  expect(JSON.stringify(teacherBoard)).toContain('PRIVATE GROUPMATE WORK');
  expect(
    (
      await teacher.post('/api/teacher/ai-review', { data: { submissionId: submissions[1] } })
    ).status(),
  ).toBe(400);
  expect(
    (
      await student.post(`/api/courses/releases/${releaseId}/points`, {
        data: { userId: board.students[0].id, points: 10 },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await teacher.post(`/api/courses/releases/${releaseId}/points`, {
        data: { userId: board.students[0].id, points: 9 },
      })
    ).status(),
  ).toBe(200);
  expect((await outsider.get(`/api/courses/board/${group.id}`)).status()).toBe(404);
});
test('Teacher opens live quiz; server ranks correct answers and elapsed time only within the group', async () => {
  expect(
    (
      await teacher.post(`/api/courses/releases/${releaseId}/live`, { data: { action: 'open' } })
    ).status(),
  ).toBe(200);
  const started = await (
    await student.post(`/api/courses/releases/${releaseId}/live`, { data: { action: 'start' } })
  ).json();
  expect(started.questions).toHaveLength(1);
  expect(started.questions[0]).not.toHaveProperty('answer');
  const submitted = await (
    await student.post(`/api/courses/releases/${releaseId}/live`, {
      data: { action: 'submit', answers: [0] },
    })
  ).json();
  expect(submitted.attempt.score).toBe(1);
  expect(submitted.results).toHaveLength(0);
  expect(
    (
      await teacher.post(`/api/courses/releases/${releaseId}/live`, { data: { action: 'close' } })
    ).status(),
  ).toBe(200);
  const closed = await (await student.get(`/api/courses/releases/${releaseId}/live`)).json();
  expect(closed.results).toHaveLength(1);
  expect(closed.results[0].elapsed_ms).toBeGreaterThanOrEqual(0);
});
test('Premium course editor and student lesson are usable on desktop and phone', async ({
  browser,
}) => {
  const tc = await browser.newContext({
    storageState: await teacher.storageState(),
    viewport: { width: 1440, height: 1100 },
  });
  const page = await tc.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('https://www.youtube-nocookie.com/**', (route) => route.abort());
  await page.goto('/courses', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Dars dasturlari', exact: true })).toBeVisible();
  await page.screenshot({ path: 'test-results/courses-desktop.png', fullPage: true });
  await page.getByRole('button', { name: /Oila — 가족/ }).click();
  await expect(page.getByRole('heading', { name: 'Dars tayyorlash' })).toBeVisible();
  await expect(page.getByLabel('YouTube video havolasi')).toHaveValue(
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  );
  await expect(page.getByTitle('Oila — 가족 videosi')).toHaveAttribute(
    'src',
    'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0',
  );
  await page.getByRole('button', { name: 'Mavjud grammatikadan tanlash' }).click();
  const grammarPicker = page.getByRole('dialog');
  await expect(grammarPicker.getByText('Grammatika mavzulari', { exact: true })).toBeVisible();
  await grammarPicker.getByLabel('Grammatika bazasi kitobi').selectOption('seoulte-1a');
  await grammarPicker.getByLabel('Grammatika bazasi mavzusi').selectOption('seoulte-1a-unit-1');
  await expect(grammarPicker.getByText('N은/는 N이에요/예요', { exact: true })).toBeVisible();
  await grammarPicker.getByLabel('Grammatika bazasi kitobi').selectOption('all');
  await grammarPicker.getByRole('button', { name: /Maqsad va niyat/ }).click();
  await expect(grammarPicker.getByText('-(으)려고', { exact: true })).toBeVisible();
  await expect(grammarPicker.getByRole('checkbox', { name: /\-\(으\)려고/ })).toBeChecked();
  await grammarPicker.getByRole('button', { name: 'Tanlanganlarni qo‘shish' }).click();
  await page.getByLabel('Dars nomi', { exact: true }).fill('Oila — 가족 · Yangilangan qoralama');
  await page.getByRole('button', { name: 'Saqlash', exact: true }).first().click();
  await expect(page.getByRole('status')).toContainText('Dars qoralamasi saqlandi.');
  await page.screenshot({ path: 'test-results/course-editor-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Guruhga ochish', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Ochiladigan qismlar');
  await expect(page.getByRole('dialog')).toContainText('dars ochilgan, material qo‘shish mumkin');
  await expect(page.getByLabel('O‘quvchilarga ochiladigan vaqt')).toBeVisible();
  await expect(page.getByText('O‘quvchilarga xabar yuborish')).toBeVisible();
  await page.getByRole('button', { name: 'Yopish', exact: true }).click();
  await page.getByRole('button', { name: 'O‘quvchi ko‘rinishi' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Yopish', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'test-results/course-editor-mobile.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  expect(errors).toHaveLength(0);
  await tc.close();
  const sc = await browser.newContext({
    storageState: await student.storageState(),
    viewport: { width: 390, height: 844 },
  });
  const sp = await sc.newPage();
  await sp.route('https://www.youtube-nocookie.com/**', (route) => route.abort());
  await sp.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(sp.getByRole('heading', { name: /안녕하세요/ })).toBeVisible();
  await expect(sp.getByRole('button', { name: 'TOPIK 읽기', exact: true })).toHaveCount(0);
  await expect(
    sp.getByRole('navigation', { name: 'Telefon menyusi' }).locator('.mobile-review-notice'),
  ).toHaveText('2');
  await sp.screenshot({ path: 'test-results/course-student-home-mobile.png', fullPage: true });
  await sp.goto(`/lessons/${releaseId}`, { waitUntil: 'domcontentloaded' });
  await expect(sp.getByRole('heading', { name: 'Oila — 가족', exact: true })).toBeVisible();
  await expect(sp.getByTitle('Oila — 가족 video darsi')).toHaveAttribute(
    'src',
    'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0',
  );
  await expect(sp.getByText('Shu dars grammatikasi')).toBeVisible();
  await expect(sp.getByText('Maqsad va niyat', { exact: true })).toBeVisible();
  await sp.getByRole('button', { name: '-(으)려고 grammatikasini o‘rganish' }).click();
  const grammarLesson = sp.getByRole('dialog');
  await expect(
    grammarLesson.getByRole('heading', { name: '1. Qaysi vaziyatda ishlatiladi?' }),
  ).toBeVisible();
  await grammarLesson.getByRole('button', { name: 'Eslab ko‘rish' }).click();
  await expect(grammarLesson.getByRole('heading', { name: 'Ma’noni eslab ko‘ring' })).toBeVisible();
  await grammarLesson.getByRole('button', { name: 'Yopish' }).click();
  await sp.getByRole('button', { name: 'Kartochka', exact: true }).click();
  await expect(sp.getByRole('button', { name: /Tarjimani ko‘rish/ })).toBeVisible();
  await sp.getByRole('button', { name: /Tarjimani ko‘rish/ }).click();
  await sp.screenshot({ path: 'test-results/course-student-lesson-mobile.png', fullPage: true });
  expect(await sp.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await sp.goto('/grammar', { waitUntil: 'domcontentloaded' });
  await expect(sp.getByLabel('Grammatika kitobi')).toHaveValue('seoulte-1a');
  await expect(sp.getByText('N은/는 N이에요/예요', { exact: true })).toBeVisible();
  await sp.getByLabel('Grammatika mavzusi').selectOption('seoulte-1a-unit-1');
  await expect(sp.locator('.grammar-card')).toHaveCount(1);
  await expect(sp.getByText('Seoulte 1A · 1-mavzu', { exact: true })).toBeVisible();
  await sp.screenshot({ path: 'test-results/student-grammar-mobile.png', fullPage: true });
  await sp.getByRole('button', { name: 'Quizni boshlash' }).click();
  await expect(sp.locator('.quiz-content')).toBeVisible();
  await expect(sp.getByText('1 / 3 SAVOL', { exact: true })).toBeVisible();
  await sp.getByRole('button', { name: 'Yopish', exact: true }).click();
  await sp.goto('/my-group', { waitUntil: 'domcontentloaded' });
  await expect(sp.getByRole('heading', { name: 'Guruh reytingi' })).toBeVisible();
  await expect(sp.locator('.mobile-review-notice')).toHaveCount(0);
  await expect(sp.locator('.course-shared-card.success')).toHaveCount(2);
  await sp.screenshot({ path: 'test-results/course-board-mobile.png', fullPage: true });
  await sc.close();
});
