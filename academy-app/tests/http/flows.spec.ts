import { test, expect, type APIRequestContext } from '@playwright/test';
let teacher: APIRequestContext, student: APIRequestContext, other: APIRequestContext;
let assignmentId: string, submissionId: string, fileId: string, groupId: string;
const origin = 'http://localhost:3100';
test.beforeAll(async ({ playwright }) => {
  const context = () =>
    playwright.request.newContext({ baseURL: origin, extraHTTPHeaders: { Origin: origin } });
  teacher = await context();
  student = await context();
  other = await context();
  const login = await teacher.post('/api/login', {
    data: { email: 'qa-teacher@hangang.local', password: 'Local-QA-Teacher-Only-2026!' },
  });
  expect(login.status()).toBe(200);
  const state = await (await teacher.get('/api/state')).json();
  groupId = state.groups[0].id;
  assignmentId = state.assignments.find(
    (a: { kind: string; group_id: string }) => a.kind === 'writing' && a.group_id === groupId,
  ).id;
  for (const [client, name] of [
    [student, 'QaStudent'],
    [other, 'QaOther'],
  ] as const) {
    const response = await client.post('/api/register', {
      data: {
        name,
        email: `${name.toLowerCase()}@example.test`,
        password: 'Local-Test-Password-2026!',
        invite: state.groups[0].invite_code,
      },
    });
    expect(response.status()).toBe(200);
  }
});
test.afterAll(async () => {
  await Promise.all([teacher.dispose(), student.dispose(), other.dispose()]);
});

test('Quiz results persist, grammar and vocabulary remain separate, and mutations are protected', async () => {
  const start = await student.post('/api/quiz/start', {
    data: { kind: 'grammar', mode: 'practice', topicId: 'A01' },
  });
  expect(start.status()).toBe(200);
  let session = await start.json();
  expect(session.question).not.toHaveProperty('answer');
  expect(session.total).toBeGreaterThan(0);
  while (session.status === 'active') {
    const response = await student.post('/api/quiz/answer', {
      data: { sessionId: session.id, questionId: session.question.id, choice: 0 },
    });
    expect(response.status()).toBe(200);
    const result = await response.json();
    expect(result.explanation).toBeTruthy();
    session = result.session;
  }
  const persisted = await (await student.get(`/api/quiz/${session.id}`)).json();
  expect(persisted.status).toBe('completed');
  expect(persisted.results.length).toBe(session.total);
  expect((await other.get(`/api/quiz/${session.id}`)).status()).toBe(404);
  const vocab = await (
    await student.post('/api/quiz/start', { data: { kind: 'vocabulary' } })
  ).json();
  expect(vocab.question.kind).toBe('vocabulary');
  expect(
    (await student.post('/api/teacher/groups', { data: { name: 'Forbidden' } })).status(),
  ).toBe(403);
  expect(
    (
      await student.post('/api/notes', {
        headers: { Origin: 'https://untrusted.test' },
        data: { title: 'x', body: 'x' },
      })
    ).status(),
  ).toBe(403);
});

test('Private notebook creates, updates and deletes only the owner’s note', async () => {
  expect(
    (
      await student.post('/api/notes', { data: { title: 'Maqsad', body: '한국에 가려고 해요.' } })
    ).status(),
  ).toBe(200);
  const state = await (await student.get('/api/state')).json();
  const note = state.notes.find((n: { title: string }) => n.title === 'Maqsad');
  expect(note).toBeTruthy();
  expect(
    (
      await other.post('/api/notes', { data: { id: note.id, title: 'Boshqa', body: 'No access' } })
    ).status(),
  ).toBe(404);
  expect(
    (
      await student.post('/api/notes', {
        data: { id: note.id, title: 'Maqsad — yangilandi', body: '-려고 expresses intention.' },
      })
    ).status(),
  ).toBe(200);
  expect((await student.delete(`/api/notes/${note.id}`)).status()).toBe(200);
  expect((await (await student.get('/api/state')).json()).notes).toHaveLength(0);
});

test('Text + image + PDF reach the teacher; feedback reaches the correct student', async () => {
  const form = new FormData();
  form.set('assignmentId', assignmentId);
  form.set('body', '한국어를 배우고 있어요. 매일 연습해요.');
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aM9sAAAAASUVORK5CYII=',
    'base64',
  );
  form.append('files', new File([png], 'notebook.png', { type: 'image/png' }));
  form.append(
    'files',
    new File(['%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF'], 'answer.pdf', {
      type: 'application/pdf',
    }),
  );
  const boundaryRequest = new Request(origin, { method: 'POST', body: form });
  const response = await student.post('/api/submissions', {
    headers: { 'Content-Type': boundaryRequest.headers.get('content-type')! },
    data: Buffer.from(await boundaryRequest.arrayBuffer()),
  });
  expect(response.status()).toBe(200);
  submissionId = (await response.json()).id;
  const received = await (await teacher.get(`/api/submissions/${submissionId}`)).json();
  expect(received.attachments).toHaveLength(2);
  fileId = received.attachments[0].id;
  expect((await teacher.get(`/api/files/${fileId}`)).status()).toBe(200);
  expect((await other.get(`/api/files/${fileId}`)).status()).toBe(403);
  expect((await other.get(`/api/submissions/${submissionId}`)).status()).toBe(403);
  expect((await teacher.post('/api/teacher/ai-review', { data: { submissionId } })).status()).toBe(
    503,
  );
  const feedback = 'Maqsadingizni yaxshi ifodalagansiz. Sababni -아/어서 bilan qo‘shing.';
  expect(
    (
      await teacher.post('/api/teacher/feedback', { data: { submissionId, feedback, score: 82 } })
    ).status(),
  ).toBe(200);
  const result = await (await student.get(`/api/submissions/${submissionId}`)).json();
  expect(result.feedback).toBe(feedback);
  expect(result.score).toBe(82);
  expect(result.ai).toBeNull();
});

test('Teacher can add separate quiz questions and valid group assignments', async () => {
  for (const [kind, topicId] of [
    ['grammar', 'A01'],
    ['vocabulary', 'V01'],
  ]) {
    const response = await teacher.post('/api/teacher/questions', {
      data: {
        kind,
        topicId,
        prompt: '테스트 질문을 선택하세요.',
        options: ['하나', '둘', '셋', '넷'],
        answer: 0,
        explanation: 'Bu o‘qituvchi qo‘shgan sinov savolining izohi.',
      },
    });
    expect(response.status()).toBe(200);
  }
  expect(
    (
      await teacher.post('/api/teacher/assignments', {
        data: {
          groupId,
          title: 'Bugungi lug‘at',
          kind: 'vocabulary',
          prompt: 'So‘z ma’nolarini takrorlang.',
          topicIds: [],
          dueAt: new Date(Date.now() + 86400000).toISOString(),
        },
      })
    ).status(),
  ).toBe(200);
  expect(
    (
      await teacher.post('/api/teacher/assignments', {
        data: {
          groupId,
          title: 'Yopiq grammatika',
          kind: 'grammar',
          prompt: 'Qoidalarni takrorlang.',
          topicIds: ['B01'],
          dueAt: new Date(Date.now() + 86400000).toISOString(),
        },
      })
    ).status(),
  ).toBe(400);
  expect((await (await student.get('/api/config')).json()).demo).toBe(false);
});

test('Teacher adds lesson vocabulary, unlocks it for a group and students can practice it', async () => {
  const response = await teacher.post('/api/teacher/words', {
    data: {
      ko: '복습장',
      uz: 'takrorlash daftari',
      category: 'Dars',
      example: '복습장에 써요.',
      translation: 'Takrorlash daftariga yozaman.',
    },
  });
  expect(response.status()).toBe(200);
  const wid = (await response.json()).id;
  const state = await (await teacher.get('/api/state')).json();
  const group = state.groups.find((g: { id: string }) => g.id === groupId);
  expect(
    (
      await teacher.post('/api/teacher/groups', {
        data: {
          id: group.id,
          name: group.name,
          level: group.level,
          grammarIds: JSON.parse(group.grammar_ids),
          vocabularyIds: [...JSON.parse(group.vocabulary_ids), wid],
        },
      })
    ).status(),
  ).toBe(200);
  expect(
    (
      await teacher.post('/api/teacher/questions', {
        data: {
          kind: 'vocabulary',
          topicId: wid,
          prompt: '복습장 so‘zining ma’nosi nima?',
          options: ['takrorlash daftari', 'qalam', 'maktab', 'deraza'],
          answer: 0,
          explanation: '복습 — takrorlash, 장 — daftar ma’nosida qo‘llangan.',
        },
      })
    ).status(),
  ).toBe(200);
  const quiz = await (
    await student.post('/api/quiz/start', { data: { kind: 'vocabulary', topicId: wid } })
  ).json();
  expect(quiz.question.topic_id).toBe(wid);
  expect(quiz.total).toBe(1);
  expect((await student.post('/api/teacher/words', { data: {} })).status()).toBe(403);
});
