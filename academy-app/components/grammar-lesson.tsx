'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, CheckCircle2, Mic, RotateCcw } from 'lucide-react';
import type { Grammar } from '@/lib/types';
import type { GrammarPracticeReply, GrammarPracticeView } from '@/lib/grammar-practice-types';
import { isSeoulte1AGrammar } from '@/lib/seoulte-1a';
import { api, errorText } from './ui';
const PAIRS: Record<string, string> = {
  A01: 'A02',
  A02: 'A10',
  A04: 'C17',
  A05: 'A18',
  A06: 'A24',
  A07: 'A18',
  A08: 'B18',
  A09: 'A19',
  A10: 'A02',
  A12: 'A17',
  A16: 'A25',
  A17: 'A12',
  A18: 'A05',
  A19: 'A09',
  A21: 'C26',
  A22: 'C28',
  A23: 'C12',
  A24: 'A26',
  A25: 'A16',
  A26: 'A24',
  A29: 'A22',
  A30: 'C24',
  B01: 'B19',
  B04: 'B05',
  B05: 'B04',
  B07: 'D11',
  B08: 'B10',
  B10: 'B08',
  B12: 'B14',
  B14: 'C01',
  B16: 'C01',
  B18: 'B20',
  B19: 'B01',
  B20: 'B18',
  C03: 'D13',
  C04: 'C14',
  C05: 'A20',
  C08: 'C18',
  C12: 'A23',
  C17: 'A04',
  C18: 'A10',
  C24: 'A30',
  C26: 'A21',
  C28: 'A22',
  C33: 'A18',
  C34: 'C01',
  C35: 'B18',
  C37: 'A16',
  D01: 'A15',
  D02: 'A02',
  D03: 'D05',
  D05: 'D03',
  D08: 'D17',
  D10: 'A18',
  D11: 'B07',
  D12: 'D14',
  D13: 'D16',
  D14: 'D11',
  D16: 'D13',
  D17: 'D08',
  D19: 'C26',
  D20: 'B09',
};
export default function GrammarLesson({
  grammar,
  grammars,
  correctDays,
  showMastery = true,
  practiceEnabled = false,
}: {
  grammar: Grammar;
  grammars: Grammar[];
  correctDays: number;
  showMastery?: boolean;
  practiceEnabled?: boolean;
}) {
  const [view, setView] = useState<'learn' | 'recall' | 'compare' | 'practice'>('learn');
  const [pairChoice, setPairChoice] = useState<string | null>(null);
  const [comparison, setComparison] = useState(PAIRS[grammar.id] || '');
  const [choice, setChoice] = useState<string | null>(null);
  const [showMeaning, setShowMeaning] = useState(false);
  const [practice, setPractice] = useState<GrammarPracticeView | null>(null);
  const [practiceChoice, setPracticeChoice] = useState<number | null>(null);
  const [writtenAnswer, setWrittenAnswer] = useState('');
  const [ordered, setOrdered] = useState<number[]>([]);
  const [sentences, setSentences] = useState(['', '', '']);
  const [practiceReply, setPracticeReply] = useState<GrammarPracticeReply | null>(null);
  const [practiceError, setPracticeError] = useState('');
  const [practiceBusy, setPracticeBusy] = useState(false);
  const [listening, setListening] = useState<number | null>(null);
  const recognition = useRef<{ stop: () => void } | null>(null);
  const other = grammars.find((g) => g.id === comparison);
  const hasPractice = practiceEnabled && isSeoulte1AGrammar(grammar.id);
  const options = useMemo(() => {
    const candidates = [
      grammar,
      ...grammars.filter((g) => g.id !== grammar.id && g.meaning !== grammar.meaning).slice(0, 3),
    ];
    // Fixed rotation avoids treating the first option as the answer for every lesson.
    const shift = Number(grammar.id.slice(1)) % candidates.length;
    return [...candidates.slice(shift), ...candidates.slice(0, shift)];
  }, [grammar, grammars]);
  useEffect(() => {
    setPracticeChoice(null);
    setWrittenAnswer('');
    setOrdered([]);
  }, [practice?.step, practice?.id]);
  useEffect(
    () => () => {
      recognition.current?.stop();
    },
    [],
  );

  async function startPractice() {
    if (practiceBusy) return;
    setPracticeBusy(true);
    setPracticeError('');
    setPracticeReply(null);
    try {
      setPractice(
        await api<GrammarPracticeView>('grammar/practice/start', {
          method: 'POST',
          body: JSON.stringify({ grammarId: grammar.id }),
        }),
      );
      setSentences(['', '', '']);
    } catch (error) {
      setPracticeError(errorText(error));
    } finally {
      setPracticeBusy(false);
    }
  }

  async function checkPractice() {
    const exercise = practice?.exercise;
    if (!practice || !exercise || practiceBusy) return;
    let answer: number | string | string[];
    if (exercise.kind === 'select') {
      if (practiceChoice === null) return;
      answer = practiceChoice;
    } else if (exercise.kind === 'order') {
      if (ordered.length !== exercise.tokens.length) return;
      answer = ordered.map((index) => exercise.tokens[index]).join(' ');
    } else if (exercise.kind === 'create') answer = sentences;
    else {
      if (!writtenAnswer.trim()) return;
      answer = writtenAnswer;
    }
    setPracticeBusy(true);
    setPracticeError('');
    try {
      const result = await api<GrammarPracticeReply>('grammar/practice/answer', {
        method: 'POST',
        body: JSON.stringify({ sessionId: practice.id, answer }),
      });
      setPracticeReply(result);
      setPractice(result.session);
    } catch (error) {
      setPracticeError(errorText(error));
    } finally {
      setPracticeBusy(false);
    }
  }

  function dictate(index: number) {
    type SpeechResult = { results: ArrayLike<{ 0: { transcript: string } }> };
    type SpeechRecognition = {
      lang: string;
      interimResults: boolean;
      onresult: ((event: SpeechResult) => void) | null;
      onerror: (() => void) | null;
      onend: (() => void) | null;
      start: () => void;
      stop: () => void;
    };
    type SpeechConstructor = new () => SpeechRecognition;
    const browser = window as typeof window & {
      SpeechRecognition?: SpeechConstructor;
      webkitSpeechRecognition?: SpeechConstructor;
    };
    const Constructor = browser.SpeechRecognition || browser.webkitSpeechRecognition;
    if (!Constructor) {
      setPracticeError(
        'Bu brauzer koreyscha ovozni matnga aylantirishni qo‘llamaydi. Gapni yozing.',
      );
      return;
    }
    recognition.current?.stop();
    const service = new Constructor();
    recognition.current = service;
    service.lang = 'ko-KR';
    service.interimResults = false;
    service.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript || '';
      setSentences((current) =>
        current.map((sentence, i) => (i === index ? transcript : sentence)),
      );
    };
    service.onerror = () => setPracticeError('Ovoz aniqlanmadi. Qayta ayting yoki gapni yozing.');
    service.onend = () => {
      setListening(null);
      recognition.current = null;
    };
    setPracticeError('');
    setListening(index);
    service.start();
  }

  return (
    <div className="grammar-mini">
      <div className="segmented" aria-label="Mini-dars bosqichlari">
        {(
          [
            ['learn', 'Tushunish'],
            ['recall', 'Eslab ko‘rish'],
            ['compare', 'Taqqoslash'],
            ...(hasPractice ? ([['practice', '5 bosqichli amaliyot']] as const) : []),
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            className={view === id ? 'active' : ''}
            aria-pressed={view === id}
            onClick={() => setView(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {view === 'learn' && (
        <>
          <section>
            <h3>1. Qaysi vaziyatda ishlatiladi?</h3>
            <p>{grammar.meaning}</p>
          </section>
          <section>
            <h3>2. Xatodan saqlanish</h3>
            <p>{grammar.note}</p>
            <p className="muted">
              Gapga qo‘shishdan oldin so‘z turini va <span lang="ko">{grammar.syntax}</span>{' '}
              tuzilishini tekshiring.
            </p>
          </section>
          <section>
            <h3>3. Misolni o‘zingiz tushuntiring</h3>
            <p lang="ko">{grammar.ko}</p>
            <button className="text-button" onClick={() => setShowMeaning(!showMeaning)}>
              {showMeaning ? 'Tarjimani yopish' : 'O‘ylab bo‘lgach, tarjimani ochish'}
            </button>
            {showMeaning && <p>{grammar.uz}</p>}
          </section>
        </>
      )}
      {view === 'recall' && (
        <section>
          <h3>Ma’noni eslab ko‘ring</h3>
          <p>
            <span lang="ko">{grammar.form}</span> nimani bildiradi?
          </p>
          <div className="grammar-recall">
            {options.map((g) => (
              <button
                className="button secondary"
                key={g.id}
                disabled={choice !== null}
                onClick={() => setChoice(g.id)}
                aria-pressed={choice === g.id}
              >
                {g.meaning}
              </button>
            ))}
          </div>
          {choice && (
            <p role="status">
              {choice === grammar.id ? 'To‘g‘ri.' : 'Yana eslang:'} {grammar.meaning}
            </p>
          )}
        </section>
      )}
      {view === 'compare' && (
        <section>
          <h3>Ikki shaklni taqqoslang</h3>
          <label>
            Taqqoslash uchun grammatika
            <select
              value={comparison}
              onChange={(e) => {
                setComparison(e.target.value);
                setPairChoice(null);
              }}
            >
              <option value="">Shaklni tanlang</option>
              {grammars
                .filter((g) => g.id !== grammar.id && g.form !== grammar.form)
                .map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.form}
                  </option>
                ))}
            </select>
          </label>
          {other && (
            <div className="grammar-compare">
              {[grammar, other].map((g) => (
                <article key={g.id}>
                  <h4 lang="ko">{g.form}</h4>
                  <p>{g.meaning}</p>
                  <p lang="ko">{g.ko}</p>
                  <p>{g.uz}</p>
                  <small>{g.note}</small>
                </article>
              ))}
            </div>
          )}
          {other && other.meaning !== grammar.meaning && (
            <section>
              <h3>Farqini sinab ko‘ring</h3>
              <p lang="ko">{other.ko}</p>
              <p>Bu gapda qaysi ma’no ifodalangan?</p>
              <div className="grammar-recall">
                {[grammar, other].map((g) => (
                  <button
                    className="button secondary"
                    key={g.id}
                    disabled={pairChoice !== null}
                    onClick={() => setPairChoice(g.id)}
                  >
                    {g.meaning}
                  </button>
                ))}
              </div>
              {pairChoice && (
                <p role="status">
                  {pairChoice === other.id ? 'To‘g‘ri.' : 'Bu gapdagi ma’no:'} {other.meaning}
                </p>
              )}
            </section>
          )}
        </section>
      )}
      {view === 'practice' && hasPractice && (
        <section className="grammar-practice">
          {!practice ? (
            <div className="grammar-practice-intro">
              <span className="grammar-practice-kicker">AMALIY GRAMMATIKA</span>
              <h3>Qoidani gapda qo‘llab ko‘ring</h3>
              <p>
                Besh bosqichda shaklni tanlaysiz, yozasiz, gap tuzasiz, xatoni tuzatasiz va uchta
                mustaqil gap yaratasiz.
              </p>
              <button
                type="button"
                className="button primary"
                disabled={practiceBusy}
                onClick={startPractice}
              >
                Mashqni boshlash <ArrowRight size={17} />
              </button>
            </div>
          ) : practice.status === 'completed' ? (
            <div className="grammar-practice-finish">
              <CheckCircle2 size={38} />
              <span className="grammar-practice-kicker">AMALIYOT YAKUNLANDI</span>
              <h3>{practice.accuracy}% aniqlik</h3>
              <p>
                Siz barcha besh bosqichni tugatdingiz. Keyingi urinishda boshqa misollar chiqadi.
              </p>
              {!!practice.modelSentences?.length && (
                <div className="grammar-model-sentences">
                  <strong>Namunalar</strong>
                  {practice.modelSentences.map((sentence) => (
                    <span key={sentence} lang="ko">
                      {sentence}
                    </span>
                  ))}
                </div>
              )}
              <button
                type="button"
                className="button primary"
                disabled={practiceBusy}
                onClick={() => {
                  setPractice(null);
                  void startPractice();
                }}
              >
                <RotateCcw size={17} /> Boshqa misollar bilan mashq
              </button>
            </div>
          ) : (
            <>
              <div className="grammar-practice-head">
                <div>
                  <span className="grammar-practice-kicker">{practice.variant}-VARIANT</span>
                  <strong>{practice.exercise?.title}</strong>
                </div>
                <span>
                  {practice.step + 1} / {practice.total}
                </span>
              </div>
              <div
                className="grammar-practice-progress"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={practice.total}
                aria-valuenow={practice.step}
              >
                <span style={{ width: `${(practice.step / practice.total) * 100}%` }} />
              </div>
              {practice.exercise && (
                <div className="grammar-practice-card">
                  <p className="muted">{practice.exercise.instruction}</p>
                  {practice.exercise.kind === 'select' && (
                    <>
                      <p className="grammar-practice-sentence" lang="ko">
                        {practice.exercise.sentence}
                      </p>
                      <p>{practice.exercise.translation}</p>
                      <div className="grammar-practice-options">
                        {practice.exercise.options.map((option, index) => (
                          <button
                            type="button"
                            key={`${option}-${index}`}
                            className={practiceChoice === index ? 'selected' : ''}
                            onClick={() => setPracticeChoice(index)}
                            disabled={practiceBusy}
                            lang="ko"
                          >
                            {option}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                  {practice.exercise.kind === 'fill' && (
                    <>
                      <p className="grammar-practice-sentence" lang="ko">
                        {practice.exercise.sentence}
                      </p>
                      <p>{practice.exercise.translation}</p>
                      <input
                        lang="ko"
                        value={writtenAnswer}
                        onChange={(event) => setWrittenAnswer(event.target.value)}
                        placeholder="Bo‘sh joyga mos shaklni yozing"
                        maxLength={100}
                      />
                      <small>{practice.exercise.hint}</small>
                    </>
                  )}
                  {practice.exercise.kind === 'order' && (
                    <>
                      <p>{practice.exercise.translation}</p>
                      <div className="grammar-built-sentence" lang="ko">
                        {ordered.length ? (
                          ordered.map((tokenIndex, index) => (
                            <button
                              type="button"
                              key={`${tokenIndex}-${index}`}
                              onClick={() => setOrdered(ordered.filter((_, i) => i !== index))}
                            >
                              {practice.exercise?.kind === 'order'
                                ? practice.exercise.tokens[tokenIndex]
                                : ''}
                            </button>
                          ))
                        ) : (
                          <span>So‘zlarni quyidan tanlang</span>
                        )}
                      </div>
                      <div className="grammar-token-bank">
                        {practice.exercise.tokens.map((token, index) => (
                          <button
                            type="button"
                            key={`${token}-${index}`}
                            disabled={ordered.includes(index)}
                            onClick={() => setOrdered([...ordered, index])}
                            lang="ko"
                          >
                            {token}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                  {practice.exercise.kind === 'correct' && (
                    <>
                      <div className="grammar-wrong-sentence" lang="ko">
                        {practice.exercise.sentence}
                      </div>
                      <p>To‘g‘ri ma’no: {practice.exercise.translation}</p>
                      <textarea
                        lang="ko"
                        rows={2}
                        value={writtenAnswer}
                        onChange={(event) => setWrittenAnswer(event.target.value)}
                        placeholder="Gapning to‘g‘ri ko‘rinishini yozing"
                        maxLength={300}
                      />
                      <small>{practice.exercise.hint}</small>
                    </>
                  )}
                  {practice.exercise.kind === 'create' && (
                    <>
                      <h3>{practice.exercise.prompt}</h3>
                      <p>{practice.exercise.requirement}</p>
                      <div className="grammar-own-sentences">
                        {sentences.map((sentence, index) => (
                          <div className="grammar-own-sentence" key={index}>
                            <label htmlFor={`grammar-sentence-${practice.id}-${index}`}>
                              {index + 1}-gap
                            </label>
                            <div>
                              <textarea
                                id={`grammar-sentence-${practice.id}-${index}`}
                                lang="ko"
                                rows={2}
                                value={sentence}
                                onChange={(event) =>
                                  setSentences(
                                    sentences.map((item, i) =>
                                      i === index ? event.target.value : item,
                                    ),
                                  )
                                }
                                placeholder="Koreyscha gap yozing yoki ayting"
                                maxLength={300}
                              />
                              <button
                                type="button"
                                className={listening === index ? 'listening' : ''}
                                onClick={() => dictate(index)}
                                disabled={practiceBusy || listening !== null}
                                aria-label={`${index + 1}-gapni koreyscha aytish`}
                              >
                                <Mic size={18} />
                              </button>
                            </div>
                            {practiceReply?.sentenceChecks?.[index] && (
                              <small
                                className={
                                  practiceReply.sentenceChecks[index].correct ? 'correct' : 'wrong'
                                }
                              >
                                {practiceReply.sentenceChecks[index].feedback}
                              </small>
                            )}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                  {practiceReply && (
                    <div
                      className={`grammar-practice-feedback ${practiceReply.correct ? 'correct' : 'wrong'}`}
                      role="status"
                    >
                      <strong>{practiceReply.feedback}</strong>
                      {practiceReply.expected && (
                        <span lang="ko">To‘g‘ri javob: {practiceReply.expected}</span>
                      )}
                    </div>
                  )}
                  {practiceError && <p className="alert error">{practiceError}</p>}
                  <button
                    type="button"
                    className="button primary grammar-practice-submit"
                    disabled={
                      practiceBusy ||
                      (practice.exercise.kind === 'select' && practiceChoice === null) ||
                      (practice.exercise.kind === 'order' &&
                        ordered.length !== practice.exercise.tokens.length) ||
                      (practice.exercise.kind !== 'select' &&
                        practice.exercise.kind !== 'order' &&
                        practice.exercise.kind !== 'create' &&
                        !writtenAnswer.trim()) ||
                      (practice.exercise.kind === 'create' &&
                        sentences.some((sentence) => !sentence.trim()))
                    }
                    onClick={checkPractice}
                  >
                    Tekshirish <ArrowRight size={17} />
                  </button>
                </div>
              )}
            </>
          )}
          {practiceError && !practice?.exercise && <p className="alert error">{practiceError}</p>}
        </section>
      )}
      {showMastery && (
        <section>
          <h3>O‘zlashtirish</h3>
          <p>
            {correctDays >= 3
              ? 'Mustahkamlanmoqda'
              : correctDays
                ? 'Mashq boshlandi'
                : 'Hali tekshirilmagan'}{' '}
            · {correctDays} alohida kunda to‘g‘ri javob.
          </p>
          <p className="muted">
            Sahifani ochish hisoblanmaydi. Quyidagi TOPIK mashqini turli kunlarda bajaring; xato
            yoki ikkilanishdan keyin hisob yangidan boshlanadi.
          </p>
        </section>
      )}
    </div>
  );
}
