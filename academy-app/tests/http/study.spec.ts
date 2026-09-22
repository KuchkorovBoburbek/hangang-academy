import { test, expect, type APIRequestContext } from '@playwright/test';
const origin = 'http://localhost:3100';
let teacher: APIRequestContext,
  student: APIRequestContext,
  outsider: APIRequestContext,
  groupId: string;
test.beforeAll(async ({ playwright }) => {
  const context = () =>
    playwright.request.newContext({ baseURL: origin, extraHTTPHeaders: { Origin: origin } });
  teacher = await context();
  student = await context();
  outsider = await context();
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
      await student.post('/api/register', {
        data: {
          name: 'Study learner',
          email: 'study@example.test',
          password: 'Study-Test-Password-2026!',
          invite: state.groups[0].invite_code,
        },
      })
    ).status(),
  ).toBe(200);
  await teacher.post('/api/teacher/groups', {
    data: { name: 'Other study group', level: 'TOPIK II', grammarIds: [], vocabularyIds: [] },
  });
  const next = await (await teacher.get('/api/state')).json();
  const group = next.groups.find((g: { name: string }) => g.name === 'Other study group');
  await outsider.post('/api/register', {
    data: {
      name: 'Other learner',
      email: 'outsider-study@example.test',
      password: 'Study-Test-Password-2026!',
      invite: group.invite_code,
    },
  });
});
test.afterAll(async () => {
  await Promise.all([teacher.dispose(), student.dispose(), outsider.dispose()]);
});
test('daily plan resumes, confidence persists and TOPIK updates home progress', async () => {
  const before = await (await student.get('/api/state')).json();
  const plan = await (await student.post('/api/study/daily', { data: { minutes: 10 } })).json();
  expect(plan.steps).toHaveLength(3);
  const again = await (await student.post('/api/study/daily', { data: { minutes: 10 } })).json();
  expect(again.id).toBe(plan.id);
  expect(
    (await outsider.post('/api/study/daily/step', { data: { planId: plan.id, step: 1 } })).status(),
  ).toBe(404);
  const attempt = await (
    await student.post('/api/study/daily/step', { data: { planId: plan.id, step: 1 } })
  ).json();
  const q = attempt.groups[0].questions[0];
  expect(
    (
      await student.post('/api/topik/uncertain', {
        data: { sessionId: attempt.id, questionId: q.id, value: true },
      })
    ).status(),
  ).toBe(200);
  expect(
    (await (await student.get(`/api/topik/sessions/${attempt.id}`)).json()).uncertain[q.id],
  ).toBe(true);
  await student.post('/api/topik/finish', { data: { sessionId: attempt.id } });
  const after = await (await student.get('/api/state')).json();
  expect(after.stats.completed).toBe(before.stats.completed + 1);
  expect(after.stats.today).toBeGreaterThan(before.stats.today);
  const updated = await (await student.post('/api/study/daily', { data: { minutes: 10 } })).json();
  expect(updated.steps[1].complete).toBe(true);
  const reviews = await (await student.get('/api/study/reviews')).json();
  expect(reviews.items.some((r: { item_id: string }) => r.item_id === q.id)).toBe(true);
});
test('vocabulary ratings are durable and retry-safe', async () => {
  const { items } = await (await student.get('/api/topik/vocabulary')).json();
  const word = items[0];
  const data = { wordId: word.id, remembered: false, eventKey: 'http-card-1' };
  await student.post('/api/study/word', { data });
  await student.post('/api/study/word', { data });
  const state = await (await student.get('/api/study/reviews')).json();
  expect(state.items.find((r: { item_id: string }) => r.item_id === word.id).wrong_count).toBe(1);
  expect((await student.post('/api/study/word/save', { data: { wordId: word.id } })).status()).toBe(
    200,
  );
});
test('teacher can assign targeted TOPIK and vocabulary only to owned groups', async () => {
  expect((await student.get('/api/teacher/topik-report')).status()).toBe(403);
  const report = await (await teacher.get('/api/teacher/topik-report')).json();
  expect(
    report.find((g: { groupId: string }) => g.groupId === groupId).categories.length,
  ).toBeGreaterThan(0);
  const create = await teacher.post('/api/teacher/topik-assignment', {
    data: { groupId, category: '1-2', dueAt: new Date(Date.now() + 86400000).toISOString() },
  });
  expect(create.status()).toBe(200);
  const { id } = await create.json();
  expect((await outsider.get(`/api/study/assignment/${id}`)).status()).toBe(404);
  const assigned = await (await student.post(`/api/study/assignment/${id}`)).json();
  expect(assigned.session.category).toBe('1-2');
  const resumed = await (await student.post(`/api/study/assignment/${id}`)).json();
  expect(resumed.session.id).toBe(assigned.session.id);
  await student.post('/api/topik/finish', { data: { sessionId: assigned.session.id } });
  expect((await (await student.get(`/api/study/assignment/${id}`)).json()).complete).toBe(true);
  expect((await (await student.get('/api/state')).json()).completedAssignments).toContain(id);
  const words = await (await student.get('/api/topik/vocabulary')).json();
  const wordId = words.items[0].id;
  const wordAssignment = await (
    await teacher.post('/api/teacher/topik-assignment', {
      data: { groupId, wordIds: [wordId], dueAt: new Date(Date.now() + 86400000).toISOString() },
    })
  ).json();
  await student.post('/api/study/word', {
    data: { wordId, remembered: true, eventKey: `assignment:${wordAssignment.id}:${wordId}` },
  });
  expect(
    (await (await student.get(`/api/study/assignment/${wordAssignment.id}`)).json()).complete,
  ).toBe(true);
});
