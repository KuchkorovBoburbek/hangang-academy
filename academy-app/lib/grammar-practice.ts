import { z } from 'zod';
import { AppError } from './auth';
import { courseAccess } from './course-access';
import { id, many, now, one, run, transaction } from './db';
import { GRAMMARS } from './content';
import { SEOULTE_1A_PRACTICE, type GrammarPracticeSpec } from './grammar-practice-content';
import { seoulte1AUnitForGrammar } from './seoulte-1a';
import type {
  GrammarPracticeExercise,
  GrammarPracticeReply,
  GrammarPracticeView,
} from './grammar-practice-types';
import type { User } from './types';

type PracticeRow = {
  id: string;
  user_id: string;
  grammar_id: string;
  variant: number;
  step: number;
  mistakes: number;
  answers: string;
  status: 'active' | 'completed';
  started_at: string;
  completed_at: string | null;
};

type SavedAnswer = {
  step: number;
  answer: number | string | string[];
  correct: boolean;
  at: string;
};

const answerSchema = z.union([
  z.number().int().min(0).max(3),
  z.string().trim().min(1).max(500),
  z.array(z.string().trim().min(1).max(300)).length(3),
]);

const stepIndexes = [
  [0, 2],
  [1, 3],
  [2, 0],
  [3, 1],
] as const;

function allowedGrammar(user: User, grammarId: string) {
  if (user.role !== 'student')
    throw new AppError(403, 'Amaliy mashq o‘quvchi hisobidan bajariladi.');
  const grammar = GRAMMARS.find((item) => item.id === grammarId);
  const practice = SEOULTE_1A_PRACTICE[grammarId];
  if (!grammar || !practice) throw new AppError(404, 'Amaliy grammatika mashqi topilmadi.');
  const access = courseAccess(user);
  if (access.managed && !access.grammarIds.includes(grammarId))
    throw new AppError(403, 'Bu grammatika guruhingizga hali ochilmagan.');
  return { grammar, practice };
}

function hash(text: string) {
  return [...text].reduce((total, char) => (total * 31 + char.charCodeAt(0)) >>> 0, 7);
}

function example(specification: GrammarPracticeSpec, variant: number, step: number) {
  const index = stepIndexes[step as 0 | 1 | 2 | 3]?.[variant as 0 | 1];
  if (index === undefined) throw new AppError(409, 'Mashq bosqichi yaroqsiz.');
  return specification.examples[index];
}

function blank(sentence: string, target: string) {
  return sentence.replace(target, '___');
}

function selectOptions(specification: GrammarPracticeSpec, variant: number) {
  const selected = example(specification, variant, 0).target;
  const unitIds = seoulte1AUnitForGrammar(specification.grammarId)?.grammarIds || [];
  const candidates = [
    ...unitIds.flatMap((grammarId) =>
      SEOULTE_1A_PRACTICE[grammarId]
        ? SEOULTE_1A_PRACTICE[grammarId].examples.map((item) => item.target)
        : [],
    ),
    ...Object.values(SEOULTE_1A_PRACTICE).flatMap((item) =>
      item.examples.map((entry) => entry.target),
    ),
  ];
  const distractors = [...new Set(candidates)].filter((item) => item !== selected).slice(0, 3);
  const options = [...distractors];
  options.splice(hash(`${specification.grammarId}:${variant}`) % 4, 0, selected);
  return { options, answer: options.indexOf(selected) };
}

function orderedTokens(sentence: string, grammarId: string, variant: number) {
  const tokens = sentence.trim().split(/\s+/);
  if (tokens.length < 2) return tokens;
  const shift = 1 + (hash(`${grammarId}:${variant}:order`) % (tokens.length - 1));
  return [...tokens.slice(shift), ...tokens.slice(0, shift)];
}

function exercise(row: PracticeRow, specification: GrammarPracticeSpec): GrammarPracticeExercise {
  if (row.step === 0) {
    const current = example(specification, row.variant, 0);
    return {
      kind: 'select',
      title: '1. Mos shaklni tanlang',
      instruction: 'Gap ma’nosiga mos koreyscha shaklni tanlang.',
      sentence: blank(current.sentence, current.target),
      translation: current.translation,
      options: selectOptions(specification, row.variant).options,
    };
  }
  if (row.step === 1) {
    const current = example(specification, row.variant, 1);
    return {
      kind: 'fill',
      title: '2. Bo‘sh joyni to‘ldiring',
      instruction: 'Kerakli shaklni koreyscha yozing.',
      sentence: blank(current.sentence, current.target),
      translation: current.translation,
      hint: `Tuzilishi: ${GRAMMARS.find((item) => item.id === row.grammar_id)?.syntax || ''}`,
    };
  }
  if (row.step === 2) {
    const current = example(specification, row.variant, 2);
    return {
      kind: 'order',
      title: '3. So‘zlardan gap tuzing',
      instruction: 'So‘zlarni to‘g‘ri tartibda bosing.',
      translation: current.translation,
      tokens: orderedTokens(current.sentence, row.grammar_id, row.variant),
    };
  }
  if (row.step === 3) {
    const current = example(specification, row.variant, 3);
    return {
      kind: 'correct',
      title: '4. Xatoni tuzating',
      instruction: 'Gapni to‘liq va to‘g‘ri shaklda qayta yozing.',
      sentence: current.wrong,
      translation: current.translation,
      hint: GRAMMARS.find((item) => item.id === row.grammar_id)?.note || '',
    };
  }
  const grammar = GRAMMARS.find((item) => item.id === row.grammar_id)!;
  return {
    kind: 'create',
    title: '5. O‘zingiz gap tuzing',
    instruction:
      'Har bir gapda bugungi grammatikani qo‘llang. Yozishingiz yoki mikrofon orqali aytishingiz mumkin.',
    prompt: `${grammar.form} shaklidan foydalanib 3 ta mustaqil koreyscha gap tuzing.`,
    requirement: `Har bir gapda “${grammar.form}” shaklini ishlating. Tizim shakl va uchala gapning har xilligini tekshiradi.`,
    sentenceCount: 3,
  };
}

function view(row: PracticeRow): GrammarPracticeView {
  const { grammar, practice } = {
    grammar: GRAMMARS.find((item) => item.id === row.grammar_id)!,
    practice: SEOULTE_1A_PRACTICE[row.grammar_id],
  };
  const totalAnswers = (JSON.parse(row.answers) as SavedAnswer[]).length;
  return {
    id: row.id,
    grammarId: row.grammar_id,
    grammarForm: grammar.form,
    variant: row.variant + 1,
    step: row.step,
    total: 5,
    mistakes: row.mistakes,
    status: row.status,
    exercise: row.status === 'active' ? exercise(row, practice) : null,
    ...(row.status === 'completed'
      ? {
          accuracy: Math.round((5 / Math.max(5, totalAnswers)) * 100),
          modelSentences: practice.examples.map((item) => item.sentence).slice(0, 3),
          completedAt: row.completed_at,
        }
      : {}),
  };
}

function ownSession(user: User, sessionId: string) {
  const row = one<PracticeRow>(
    'SELECT * FROM grammar_practice_sessions WHERE id=? AND user_id=?',
    sessionId,
    user.id,
  );
  if (!row) throw new AppError(404, 'Amaliy mashq topilmadi.');
  allowedGrammar(user, row.grammar_id);
  return row;
}

export function startGrammarPractice(user: User, grammarId: string) {
  allowedGrammar(user, grammarId);
  const active = one<PracticeRow>(
    "SELECT * FROM grammar_practice_sessions WHERE user_id=? AND grammar_id=? AND status='active' ORDER BY started_at DESC LIMIT 1",
    user.id,
    grammarId,
  );
  if (active) return view(active);
  const completed =
    one<{ total: number }>(
      "SELECT COUNT(*) total FROM grammar_practice_sessions WHERE user_id=? AND grammar_id=? AND status='completed'",
      user.id,
      grammarId,
    )?.total || 0;
  const row: PracticeRow = {
    id: id(),
    user_id: user.id,
    grammar_id: grammarId,
    variant: completed % 2,
    step: 0,
    mistakes: 0,
    answers: '[]',
    status: 'active',
    started_at: now(),
    completed_at: null,
  };
  run(
    'INSERT INTO grammar_practice_sessions(id,user_id,grammar_id,variant,step,mistakes,answers,status,started_at) VALUES(?,?,?,?,?,?,?,?,?)',
    row.id,
    row.user_id,
    row.grammar_id,
    row.variant,
    row.step,
    row.mistakes,
    row.answers,
    row.status,
    row.started_at,
  );
  return view(row);
}

function normalized(value: string) {
  return value
    .normalize('NFC')
    .toLowerCase()
    .replace(/[\s.,!?！？。'“”‘’]/g, '');
}

function productionChecks(specification: GrammarPracticeSpec, answers: string[]) {
  const seen = new Set<string>();
  return answers.map((answer) => {
    const compact = normalized(answer);
    if ((answer.match(/[가-힣]/g) || []).length < 4)
      return { correct: false, feedback: 'Kamida bitta to‘liq koreyscha gap yozing.' };
    if (seen.has(compact))
      return { correct: false, feedback: 'Uchala gap har xil bo‘lishi kerak.' };
    seen.add(compact);
    const missing = specification.markerGroups.find(
      (group) => !group.some((marker) => answer.normalize('NFC').includes(marker)),
    );
    if (missing)
      return {
        correct: false,
        feedback: `Bu gapda kerakli shakl ko‘rinmadi. Maslahat: ${missing.join(' / ')}`,
      };
    return { correct: true, feedback: 'Grammatik shakl gapda ishlatilgan.' };
  });
}

export function answerGrammarPractice(user: User, input: unknown): GrammarPracticeReply {
  const parsed = z.object({ sessionId: z.uuid(), answer: answerSchema }).parse(input);
  return transaction(() => {
    const row = ownSession(user, parsed.sessionId);
    if (row.status !== 'active') throw new AppError(409, 'Bu amaliy mashq yakunlangan.');
    const specification = SEOULTE_1A_PRACTICE[row.grammar_id];
    const current = row.step < 4 ? example(specification, row.variant, row.step) : null;
    const options = row.step === 0 ? selectOptions(specification, row.variant) : null;
    let correct = false;
    let expected: string | undefined;
    let sentenceChecks: { correct: boolean; feedback: string }[] | undefined;
    if (row.step === 0) {
      if (typeof parsed.answer !== 'number') throw new AppError(400, 'Variantni tanlang.');
      correct = parsed.answer === options!.answer;
      expected = options!.options[options!.answer];
    } else if (row.step === 1) {
      if (typeof parsed.answer !== 'string') throw new AppError(400, 'Javobni yozing.');
      correct = normalized(parsed.answer) === normalized(current!.target);
      expected = current!.target;
    } else if (row.step === 2) {
      if (typeof parsed.answer !== 'string') throw new AppError(400, 'Gapni tuzing.');
      correct = normalized(parsed.answer) === normalized(current!.sentence);
      expected = current!.sentence;
    } else if (row.step === 3) {
      if (typeof parsed.answer !== 'string') throw new AppError(400, 'Tuzatilgan gapni yozing.');
      correct = normalized(parsed.answer) === normalized(current!.sentence);
      expected = current!.sentence;
    } else {
      if (!Array.isArray(parsed.answer)) throw new AppError(400, 'Uchta gap yozing.');
      sentenceChecks = productionChecks(specification, parsed.answer);
      correct = sentenceChecks.every((item) => item.correct);
    }
    const saved = JSON.parse(row.answers) as SavedAnswer[];
    saved.push({ step: row.step, answer: parsed.answer, correct, at: now() });
    const attempts = saved.filter((item) => item.step === row.step).length;
    const advanced = correct || (row.step < 4 && attempts >= 2);
    const nextStep = advanced ? row.step + 1 : row.step;
    const completed = nextStep >= 5;
    const completedAt = completed ? now() : null;
    run(
      'UPDATE grammar_practice_sessions SET step=?,mistakes=?,answers=?,status=?,completed_at=? WHERE id=?',
      completed ? 5 : nextStep,
      row.mistakes + (correct ? 0 : 1),
      JSON.stringify(saved),
      completed ? 'completed' : 'active',
      completedAt,
      row.id,
    );
    const updated = ownSession(user, row.id);
    const feedback = correct
      ? completed
        ? 'Ajoyib! Besh bosqichni yakunladingiz.'
        : 'To‘g‘ri. Keyingi bosqichga o‘ting.'
      : advanced
        ? 'To‘g‘ri shaklni ko‘rib chiqing va keyingi bosqichda qo‘llang.'
        : row.step === 4
          ? 'Belgilanggan gaplarni tuzatib, yana tekshiring.'
          : 'Hali mos kelmadi. Maslahatni ko‘rib, yana bir marta urinib ko‘ring.';
    return {
      correct,
      advanced,
      feedback,
      ...(!correct && advanced && expected ? { expected } : {}),
      ...(sentenceChecks ? { sentenceChecks } : {}),
      session: view(updated),
    };
  });
}

export function grammarPracticeSession(user: User, sessionId: string) {
  return view(ownSession(user, sessionId));
}
