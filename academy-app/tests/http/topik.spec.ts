import { test, expect, type APIRequestContext } from '@playwright/test';
import fs from 'node:fs';
import type {
  TopikBookmark,
  TopikCatalog,
  TopikPublicGroup,
  TopikSession,
  TopikGroup,
} from '../../lib/topik-types';

const origin = 'http://localhost:3100';
let teacher: APIRequestContext, student: APIRequestContext, other: APIRequestContext;

function expectPublicQuestions(groups: TopikPublicGroup[]) {
  for (const group of groups) {
    expect(group.passage).not.toContain('NOT disclosed');
    expect(group.passage).not.toContain('공개하지 않습니다');
    for (const question of group.questions) {
      expect(question.options).toHaveLength(4);
      for (const privateField of [
        'answer',
        'explanation',
        'translation',
        'grammarIds',
        'verified',
        'withheld',
      ]) {
        expect(question).not.toHaveProperty(privateField);
      }
    }
  }
}

function expectActive(session: TopikSession) {
  expect(session.status).toBe('active');
  expect(session.score).toBeNull();
  expect(session.percent).toBeNull();
  expect(session).not.toHaveProperty('results');
  expectPublicQuestions(session.groups);
}

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
  for (const [client, name] of [
    [student, 'TopikStudent'],
    [other, 'TopikOther'],
  ] as const) {
    const response = await client.post('/api/register', {
      data: {
        name,
        email: `${name.toLowerCase()}@example.test`,
        password: 'Local-TOPIK-Password-2026!',
        invite: state.groups[0].invite_code,
      },
    });
    expect(response.status()).toBe(200);
  }
});

test.afterAll(async () => {
  await Promise.all([teacher?.dispose(), student?.dispose(), other?.dispose()]);
});

test('Imported TOPIK catalog excludes withheld passages and offers 12 authentic mocks', async ({
  request,
}) => {
  expect((await request.get('/api/topik/catalog')).status()).toBe(401);
  const response = await student.get('/api/topik/catalog');
  expect(response.status()).toBe(200);
  const catalog: TopikCatalog = await response.json();
  expect(catalog.corpusVersion).toBeTruthy();
  expect(catalog.official).toBe(574);
  expect(catalog.generated).toBe(111);
  expect(catalog.total).toBe(685);
  expect(catalog.excluded).toBe(26);
  expect(catalog.categories).toHaveLength(18);
  expect(catalog.categories.find((category) => category.id === '42-43')).toMatchObject({
    available: 0,
    official: 0,
  });
  expect(catalog.mock).toMatchObject({
    requestedForms: 12,
    readyForms: 12,
    minutes: 70,
    questionCount: 48,
    skippedNumbers: [42, 43],
  });
  expect(catalog.mock.forms).toHaveLength(12);
  expect(catalog.mock.forms.every((form) => form.ready && form.questionCount === 48)).toBe(true);
  expect(catalog.mock.shortages).toEqual([]);
  expect(
    (
      await student.post('/api/topik/start', {
        data: { mode: 'practice', category: '42-43', count: 10 },
      })
    ).status(),
  ).toBe(409);
});

test('TOPIK choices resume privately, grading unlocks results, and saved mistakes retain their passage', async () => {
  const start = await student.post('/api/topik/start', {
    data: { mode: 'practice', category: '19-20', count: 10 },
  });
  expect(start.status()).toBe(200);
  const session: TopikSession = await start.json();
  expectActive(session);
  expect(session).toMatchObject({ mode: 'practice', actualCount: 10, answeredCount: 0 });
  expect(session.groups).toHaveLength(5);
  for (const group of session.groups) {
    expect(group.category).toBe('19-20');
    expect(group.questions.map((question) => question.number)).toEqual([19, 20]);
  }
  const questions = session.groups.flatMap((group) => group.questions);
  expect(new Set(questions.map((question) => question.id)).size).toBe(10);
  expect(questions.map((question) => question.displayNumber)).toEqual([
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
  ]);
  const questionId = questions[0].id;
  const answer = await student.post('/api/topik/answer', {
    data: { sessionId: session.id, questionId, choice: 0 },
  });
  expect(answer.status()).toBe(200);
  expectActive(await answer.json());
  const resumedResponse = await student.get(`/api/topik/sessions/${session.id}`);
  expect(resumedResponse.status()).toBe(200);
  const resumed: TopikSession = await resumedResponse.json();
  expectActive(resumed);
  expect(resumed.choices).toEqual({ [questionId]: 0 });
  expect(resumed.answeredCount).toBe(1);
  expect(resumed.groups).toEqual(session.groups);

  expect((await other.get(`/api/topik/sessions/${session.id}`)).status()).toBe(404);
  expect(
    (
      await other.post('/api/topik/answer', {
        data: { sessionId: session.id, questionId, choice: 3 },
      })
    ).status(),
  ).toBe(404);
  expect(
    (await other.post('/api/topik/finish', { data: { sessionId: session.id } })).status(),
  ).toBe(404);

  const finish = await student.post('/api/topik/finish', { data: { sessionId: session.id } });
  expect(finish.status()).toBe(200);
  const completed: TopikSession = await finish.json();
  expect(completed.status).toBe('completed');
  expect(completed.results).toHaveLength(10);
  expect(completed.score).toBe(completed.results!.filter((result) => result.correct).length);
  expect(completed.percent).toBe(completed.score! * 10);
  expect(completed.results![0].choice).toBe(0);
  for (const result of completed.results!) {
    expect(result.answer).toBeGreaterThanOrEqual(0);
    expect(result.answer).toBeLessThanOrEqual(3);
    expect(result.explanation).toBeTruthy();
  }
  // An unanswered question is a guaranteed mistake, independent of the random draw.
  const mistake = completed.results!.find((result) => result.choice === null)!;
  expect(mistake.correct).toBe(false);
  expect(
    (
      await student.post('/api/topik/bookmarks', {
        data: { questionId: mistake.questionId, saved: true },
      })
    ).status(),
  ).toBe(200);
  const savedResponse = await student.get('/api/topik/bookmarks');
  expect(savedResponse.status()).toBe(200);
  const saved: { items: TopikBookmark[] } = await savedResponse.json();
  expect(saved.items).toHaveLength(1);
  expect(saved.items[0].questionId).toBe(mistake.questionId);
  expectPublicQuestions([saved.items[0].group]);

  expect(
    (
      await other.post('/api/topik/bookmarks', {
        data: { questionId: mistake.questionId, saved: true },
      })
    ).status(),
  ).toBe(403);
  expect((await (await other.get('/api/topik/bookmarks')).json()).items).toEqual([]);
  expect(
    (
      await other.post('/api/topik/start', {
        data: { mode: 'review', questionIds: [mistake.questionId] },
      })
    ).status(),
  ).toBe(403);

  const retry = await student.post('/api/topik/start', {
    data: { mode: 'review', questionIds: [mistake.questionId] },
  });
  expect(retry.status()).toBe(200);
  const review: TopikSession = await retry.json();
  expectActive(review);
  expect(review.id).not.toBe(session.id);
  expect(review.mode).toBe('review');
  expect(review.actualCount).toBe(2);
  expect(review.choices).toEqual({});
  expect(review.groups).toHaveLength(1);
  expect(review.groups[0].id).toBe(saved.items[0].group.id);
  expect(review.groups[0].questions.map((question) => question.number)).toEqual([19, 20]);
  expect(review.groups[0].questions.some((question) => question.id === mistake.questionId)).toBe(
    true,
  );

  const persisted: TopikSession = await (
    await student.get(`/api/topik/sessions/${session.id}`)
  ).json();
  expect(persisted.status).toBe('completed');
  expect(persisted.score).toBe(completed.score);
  expect(persisted.results!.find((result) => result.questionId === mistake.questionId)?.saved).toBe(
    true,
  );
  const catalog: TopikCatalog = await (await student.get('/api/topik/catalog')).json();
  expect(
    catalog.history.some((item) => item.id === session.id && item.status === 'completed'),
  ).toBe(true);
  expect(catalog.activeSessions.some((item) => item.id === review.id)).toBe(true);
  expect(catalog.savedCount).toBe(1);
});

test('Real mock preserves the empty 42–43 slots and grades only its 48 authentic questions', async () => {
  const catalog: TopikCatalog = await (await student.get('/api/topik/catalog')).json();
  const response = await student.post('/api/topik/start', {
    data: { mode: 'mock', formId: catalog.mock.forms[0].id },
  });
  expect(response.status()).toBe(200);
  const session: TopikSession = await response.json();
  expectActive(session);
  expect(session.actualCount).toBe(48);
  expect(session.skippedNumbers).toEqual([42, 43]);
  expect(session.notice).toContain('tashlab o‘ting');
  expect(session.groups.every((group) => group.origin === 'official')).toBe(true);
  const questions = session.groups.flatMap((group) => group.questions);
  const numbers = Array.from({ length: 50 }, (_, i) => i + 1).filter((n) => n !== 42 && n !== 43);
  expect(questions.map((q) => q.displayNumber)).toEqual(numbers);
  const corpus: TopikGroup[] = JSON.parse(fs.readFileSync('content/topik/groups.json', 'utf8'));
  const answers = new Map(corpus.flatMap((g) => g.questions.map((q) => [q.id, q.answer] as const)));
  for (const number of [1, 44]) {
    const q = questions.find((q) => q.displayNumber === number)!;
    expect(
      (
        await student.post('/api/topik/answer', {
          data: { sessionId: session.id, questionId: q.id, choice: answers.get(q.id) },
        })
      ).status(),
    ).toBe(200);
  }
  const completed: TopikSession = await (
    await student.post('/api/topik/finish', {
      data: { sessionId: session.id },
    })
  ).json();
  expect(completed.score).toBe(2);
  expect(completed.results).toHaveLength(48);
  expect(completed.results?.map((r) => r.number)).toEqual(numbers);
  expect(completed.results?.filter((r) => !r.correct)).toHaveLength(46);
  expect(completed.skippedNumbers).toEqual([42, 43]);
});

test('solutions unlock on request after checking, support head teacher edits and save as private organized notes', async () => {
  const session: TopikSession = await (
    await student.post('/api/topik/start', {
      data: { mode: 'practice', category: '1-2', count: 10 },
    })
  ).json();
  const questionId = session.groups[0].questions[0].id;
  const payload = { sessionId: session.id, questionId };
  const url = `/api/topik/solution?sessionId=${session.id}&questionId=${questionId}`;
  expect((await student.get('/api/teacher/solutions')).status()).toBe(403);
  expect((await student.get(`/api/teacher/solutions/${questionId}`)).status()).toBe(403);
  const detail = await (await teacher.get(`/api/teacher/solutions/${questionId}`)).json();
  const content = {
    reason: 'Sinov yechimi: to‘g‘ri javob matndagi vaqt munosabatiga mos keladi.',
    evidence: '',
    elimination: 'Sinovdagi boshqa variantlar gapning ko‘zlangan vaqt munosabatini bermaydi.',
    tip: 'Sinov eslatmasi: ikkala gap orasidagi aloqani tekshiring.',
  };
  const edit = { content, revision: detail.revision, sourceHash: detail.sourceHash };
  expect(
    (await teacher.post(`/api/teacher/solutions/${questionId}`, { data: edit })).status(),
  ).toBe(200);
  expect(
    (await teacher.post(`/api/teacher/solutions/${questionId}`, { data: edit })).status(),
  ).toBe(409);
  expect(
    (await student.post(`/api/teacher/solutions/${questionId}`, { data: edit })).status(),
  ).toBe(403);
  expect((await student.get(url)).status()).toBe(403);
  expect((await student.post('/api/topik/solution/save', { data: payload })).status()).toBe(403);
  expect((await student.post('/api/topik/check', { data: payload })).status()).toBe(400);
  await student.post('/api/topik/answer', { data: { ...payload, choice: detail.question.answer } });
  expect((await student.get(url)).status()).toBe(403);
  const checked: TopikSession = await (
    await student.post('/api/topik/check', { data: payload })
  ).json();
  expect(checked.checkedResults).toHaveLength(1);
  expect(checked.checkedResults![0].correct).toBe(true);
  expectPublicQuestions(checked.groups);
  expect(
    (await student.post('/api/topik/answer', { data: { ...payload, choice: 0 } })).status(),
  ).toBe(409);
  expect((await (await student.get(url)).json()).content).toEqual(content);
  expect((await other.get(url)).status()).toBe(404);
  const note = await (await student.post('/api/topik/solution/save', { data: payload })).json();
  expect(
    (await (await student.post('/api/topik/solution/save', { data: payload })).json()).id,
  ).toBe(note.id);
  expect(
    (
      await student.post('/api/notes', {
        data: {
          id: note.id,
          title: 'Mening yechimim',
          body: 'Shaxsiy izoh',
          folder: 'Takrorlash',
          tags: ['sabab'],
          pinned: true,
        },
      })
    ).status(),
  ).toBe(200);
  expect((await other.patch(`/api/notes/${note.id}`, { data: { archived: true } })).status()).toBe(
    404,
  );
  expect(
    (await student.patch(`/api/notes/${note.id}`, { data: { archived: true } })).status(),
  ).toBe(200);
  let state = await (await student.get('/api/state')).json();
  expect(state.notes.find((n: { id: string }) => n.id === note.id)).toMatchObject({
    kind: 'solution',
    archived: 1,
    body: 'Shaxsiy izoh',
    folder: 'Takrorlash',
    pinned: 1,
  });
  await student.post('/api/topik/solution/save', { data: payload });
  state = await (await student.get('/api/state')).json();
  expect(state.notes.find((n: { id: string }) => n.id === note.id).archived).toBe(0);
  const retry = await student.post('/api/topik/start', {
    data: { mode: 'review', questionIds: [questionId] },
  });
  expect(retry.status()).toBe(200);
  expect((await retry.json()).checked).toEqual({});
});
