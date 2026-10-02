import { test, expect } from '@playwright/test';

test('teacher book access, invite link, topic selection and repeatable vocabulary quizzes work end to end', async ({
  browser,
  playwright,
}) => {
  test.setTimeout(90_000);
  const origin = 'http://localhost:3100';
  const teacher = await playwright.request.newContext({
    baseURL: origin,
    extraHTTPHeaders: { Origin: origin },
  });
  expect(
    (
      await teacher.post('/api/login', {
        data: { email: 'qa-teacher@hangang.local', password: 'Local-QA-Teacher-Only-2026!' },
      })
    ).ok(),
  ).toBe(true);
  const { id: groupId } = await (
    await teacher.post('/api/teacher/groups', {
      data: { name: 'Seoulte curriculum QA', level: 'hangul' },
    })
  ).json();
  const state = await (await teacher.get('/api/state')).json();
  const group = state.groups.find((g: { id: string }) => g.id === groupId);
  const scope = { level: 'hangul', book: '1A', section: 'reading' };
  for (const [ko, uz, topic, book] of [
    ['학교', 'maktab', 'unit-1', '1A'],
    ['학생', 'o‘quvchi', 'unit-1', '1A'],
    ['친구', 'do‘st', 'unit-2', '1A'],
    ['사람', 'inson', 'unit-1', '1B'],
  ]) {
    const response = await teacher.post('/api/teacher/vocabulary/word', {
      data: {
        groupIds: [groupId],
        input: {
          ...scope,
          book,
          ko,
          uz,
          pos: 'Ot',
          example: `${ko}입니다.`,
          translation: `Bu ${uz}.`,
          kind: 'word',
          categories: [topic],
        },
      },
    });
    expect(response.status(), await response.text()).toBe(200);
  }
  const learner = await browser.newContext({
    baseURL: origin,
    viewport: { width: 390, height: 844 },
  });
  const page = await learner.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`/register?invite=${group.invite_code}`);
  await expect(page.getByLabel('Guruh kodi')).toHaveValue(group.invite_code);
  await page.getByLabel('Ismingiz').fill('Curriculum learner');
  await page.getByLabel('Email', { exact: true }).fill('curriculum-learner@example.test');
  await page.getByLabel('Parol', { exact: true }).fill('Curriculum-Testing-2026!');
  await page.getByRole('button', { name: 'Hisob ochish' }).click();
  await expect(page).toHaveURL(origin + '/');
  await page.goto('/vocabulary');
  await expect(page.getByRole('button', { name: 'Seoulte 1A 8 ta mavzu' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.locator('.vocab-topic')).toHaveCount(8);
  await expect(page.locator('.topik-word-card')).toHaveCount(3);
  await expect(
    page.locator('.vocab-topic').filter({ hasText: '3-mavzu' }).getByRole('button'),
  ).toBeDisabled();
  await page.locator('.vocab-topic').filter({ hasText: '1-mavzu' }).getByRole('button').click();
  await expect(page.locator('.topik-word-card')).toHaveCount(2);
  await page.getByLabel('2-mavzu — tanlash').check();
  await expect(page.locator('.topik-word-card')).toHaveCount(3);
  await page.getByLabel('Quiz savollari soni').selectOption('100');
  await page.getByRole('button', { name: 'Quizni boshlash', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  for (let i = 0; i < 3; i++) {
    await expect(page.locator('.quiz-prompt')).not.toContainText('사람');
    await page.locator('.quiz-option').first().click();
    await page.getByRole('button', { name: 'Javobni tekshirish' }).click();
    await page
      .getByRole('button', { name: i === 2 ? 'Natijani ko‘rish' : 'Keyingi savol' })
      .click();
  }
  await expect(
    page.getByText('Natijangiz va keyingi takrorlash muddatlari saqlandi.'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Natijalarimga qaytish' }).click();
  await page.getByRole('button', { name: 'Seoulte 1B 8 ta mavzu' }).click();
  await expect(page.locator('.topik-word-card')).toHaveCount(1);
  await expect(page.locator('.topik-word-card')).toContainText('사람');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/seoulte-student-mobile.png', fullPage: true });

  const staff = await browser.newContext({
    baseURL: origin,
    storageState: await teacher.storageState(),
    viewport: { width: 1440, height: 1000 },
  });
  const editor = await staff.newPage();
  editor.on('pageerror', (e) => errors.push(e.message));
  await editor.goto('/vocabulary');
  await editor.getByRole('button', { name: 'Boshlang‘ich · 한글', exact: true }).click();
  await editor.getByRole('button', { name: 'Guruhga lug‘at ochish', exact: true }).click();
  await expect(editor.getByRole('dialog')).toBeVisible({ timeout: 5000 });
  await editor.getByLabel('Guruh', { exact: true }).selectOption(groupId);
  await expect(editor.getByLabel('1-mavzu', { exact: true })).toBeChecked();
  await editor.getByLabel('1-mavzu', { exact: true }).uncheck();
  await editor.getByLabel('2-mavzu', { exact: true }).uncheck();
  await editor.getByRole('button', { name: 'Ruxsatlarni saqlash', exact: true }).click();
  await expect(editor.getByRole('dialog')).toHaveCount(0);
  await editor.screenshot({ path: 'test-results/seoulte-teacher-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Seoulte 1A 8 ta mavzu' }).click();
  await page.reload();
  await expect(
    page.locator('.vocab-topic').filter({ hasText: '1-mavzu' }).getByRole('button'),
  ).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Quizni boshlash', exact: true })).toBeDisabled();

  await editor.getByRole('button', { name: 'Qo‘lda qo‘shish', exact: true }).click();
  const wordForm = editor.getByRole('dialog');
  await wordForm.getByLabel('Lug‘at darajasi').selectOption('topik56');
  await expect(wordForm.locator('.vocab-groups')).toContainText(
    'TOPIK 5/6 darajasiga mos guruh yo‘q',
  );
  await wordForm.getByLabel('Lug‘at darajasi').selectOption('hangul');
  await expect(wordForm.getByLabel('Seoulte curriculum QA', { exact: true })).toBeChecked();
  await wordForm.getByLabel('Koreyscha so‘z').fill('교실');
  await wordForm.getByLabel('O‘zbekcha ma’nosi').fill('sinfxona');
  await wordForm.getByLabel('So‘z turkumi').fill('Ot');
  await wordForm.getByLabel('Koreyscha misol').fill('교실에서 공부합니다.');
  await wordForm.getByLabel('Misol tarjimasi').fill('Sinfxonada o‘qiymiz.');
  await wordForm.getByRole('button', { name: 'Saqlash', exact: true }).click();
  await expect(wordForm).toHaveCount(0);
  await expect(editor.locator('.topik-word-card').filter({ hasText: '교실' })).toBeVisible();
  expect(errors).toEqual([]);
  await learner.close();
  await staff.close();
  await teacher.dispose();
});
