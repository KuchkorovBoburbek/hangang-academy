'use client';

import { Fragment } from 'react';
import SolutionPanel from './solution-panel';
import { WordText } from './context-words';
import { Bookmark, Check, X } from 'lucide-react';
import type { TopikPublicGroup, TopikResult } from '@/lib/topik-types';

export const CIRCLED = ['①', '②', '③', '④'];

/** The bank permits underline markup only; all other content remains escaped text. */
export function PaperText({ text }: { text: string }) {
  return text.split(/(<u>[\s\S]*?<\/u>)/g).map((part, i) =>
    part.startsWith('<u>') && part.endsWith('</u>') ? (
      <u key={i}>
        <WordText text={part.slice(3, -4)} />
      </u>
    ) : (
      <Fragment key={i}>
        <WordText text={part} />
      </Fragment>
    ),
  );
}

export function plainPaperText(text: string) {
  return text.replace(/<\/?u>/g, '');
}

export default function TopikPaper({
  group,
  choices,
  results,
  disabled = false,
  selectedId,
  onAnswer,
  onBookmark,
  bookmarkBusy,
  sessionId,
  onCheck,
}: {
  group: TopikPublicGroup;
  choices: Record<string, number>;
  results?: TopikResult[];
  disabled?: boolean;
  selectedId?: string;
  onAnswer?: (questionId: string, choice: number) => void;
  onBookmark?: (questionId: string, saved: boolean) => void;
  bookmarkBusy?: string | null;
  sessionId?: string;
  onCheck?: (questionId: string) => void;
}) {
  const first = group.questions[0]?.displayNumber;
  const last = group.questions.at(-1)?.displayNumber;
  const range = first === last ? `${first}` : `${first}～${last}`;
  const numberBeforePassage = group.questions.length === 1 && !group.questions[0].prompt.trim();
  const instruction = group.instruction.replace(/\[\s*\d+\s*[~～\-–]\s*\d+\s*\]/, `[${range}]`);
  return (
    <article className="topik-paper" id={`topik-group-${group.id}`} aria-label={`${range}번 문제`}>
      <div className="topik-paper-masthead" aria-hidden="true">
        <span>한강 TOPIK II</span>
        <span>읽기</span>
      </div>
      {instruction && (
        <p className="topik-paper-instruction" lang="ko">
          <PaperText text={instruction} />
        </p>
      )}
      {numberBeforePassage && (
        <div className="topik-paper-stem-number" lang="ko">
          {first}.
        </div>
      )}
      {group.blocks.length ? (
        <div className="topik-paper-blocks" lang="ko">
          {group.blocks.map((block, i) =>
            block.type === 'image' ? (
              <figure className="topik-paper-figure" key={i}>
                {block.src && (
                  <img src={block.src} alt={block.alt || block.text || '문제의 그림'} />
                )}
                {block.text && (
                  <figcaption>
                    <PaperText text={block.text} />
                  </figcaption>
                )}
              </figure>
            ) : block.type === 'heading' ? (
              <h3 className="topik-paper-heading" key={i}>
                <PaperText text={block.text || ''} />
              </h3>
            ) : (
              <div className={`topik-paper-passage ${block.type === 'box' ? 'boxed' : ''}`} key={i}>
                <PaperText text={block.text || ''} />
              </div>
            ),
          )}
        </div>
      ) : group.passage ? (
        <div className="topik-paper-passage boxed" lang="ko">
          <PaperText text={group.passage} />
        </div>
      ) : null}
      <div className="topik-paper-questions">
        {group.questions.map((question) => {
          const result = results?.find((r) => r.questionId === question.id);
          const selected = choices[question.id];
          return (
            <section
              className={`topik-paper-question ${selectedId === question.id ? 'current' : ''}`}
              id={`topik-q-${question.id}`}
              key={question.id}
            >
              <fieldset className="topik-paper-fieldset" disabled={disabled}>
                <legend
                  className={`topik-paper-prompt ${numberBeforePassage ? 'topik-sr-only' : ''}`}
                  lang="ko"
                >
                  <strong>{question.displayNumber}.</strong> <PaperText text={question.prompt} />
                </legend>
                <div
                  className={`topik-paper-options ${question.options.some((o) => o.length > 40) || question.optionImages?.some(Boolean) ? 'long' : ''}`}
                >
                  {question.options.map((option, i) => (
                    <label
                      className={`topik-paper-option ${selected === i ? 'selected' : ''} ${result?.answer === i ? 'correct' : ''} ${result && selected === i && !result.correct ? 'wrong' : ''}`}
                      key={i}
                    >
                      <input
                        type="radio"
                        disabled={disabled || !!result}
                        name={`topik-${question.id}`}
                        value={i}
                        checked={selected === i}
                        onChange={() => onAnswer?.(question.id, i)}
                        aria-label={`${question.displayNumber}-savol, ${i + 1}-javob: ${plainPaperText(option)}`}
                      />
                      <span className="topik-option-number" aria-hidden="true">
                        {CIRCLED[i]}
                      </span>
                      <span className="topik-option-content" lang="ko">
                        <PaperText text={option} />
                        {question.optionImages?.[i] && (
                          <img
                            src={question.optionImages[i]!}
                            alt={`${question.displayNumber}번 ${CIRCLED[i]} 보기 그림`}
                          />
                        )}
                      </span>
                      {result?.answer === i && (
                        <Check className="topik-answer-icon" size={17} aria-label="To‘g‘ri javob" />
                      )}
                      {result && selected === i && !result.correct && (
                        <X className="topik-answer-icon" size={17} aria-label="Xato javob" />
                      )}
                    </label>
                  ))}
                </div>
              </fieldset>
              {!result && onCheck && selected !== undefined && (
                <div className="question-check">
                  <button
                    className="button secondary"
                    disabled={disabled}
                    onClick={() => onCheck(question.id)}
                  >
                    Javobni tekshirish
                  </button>
                  <small>Tekshirilgach, javobni o‘zgartirib bo‘lmaydi.</small>
                </div>
              )}
              {result && (
                <div className={`topik-paper-feedback ${result.correct ? 'correct' : 'wrong'}`}>
                  <div className="topik-feedback-head">
                    <strong>
                      {result.correct ? <Check size={17} /> : <X size={17} />}
                      {result.correct
                        ? 'To‘g‘ri javob'
                        : result.choice === null
                          ? 'Javob belgilanmagan'
                          : 'Bu javob xato'}
                    </strong>
                    {(!result.correct || result.saved) && onBookmark && (
                      <button
                        type="button"
                        className={`topik-save-button ${result.saved ? 'saved' : ''}`}
                        disabled={bookmarkBusy === question.id}
                        onClick={() => onBookmark(question.id, !result.saved)}
                        aria-pressed={result.saved}
                      >
                        <Bookmark size={16} fill={result.saved ? 'currentColor' : 'none'} />
                        {bookmarkBusy === question.id
                          ? 'Saqlanmoqda…'
                          : result.saved
                            ? 'Saqlangan'
                            : 'Xatoni saqlash'}
                      </button>
                    )}
                  </div>
                  <p>
                    To‘g‘ri javob: <b>{CIRCLED[result.answer]}</b>
                    {result.choice !== null && !result.correct && (
                      <>
                        {' '}
                        · Sizning javobingiz: <b>{CIRCLED[result.choice]}</b>
                      </>
                    )}
                  </p>
                  {result.uncertain && <p>Ikkilangan javob · Takrorlash rejalashtirildi.</p>}
                  {sessionId && <SolutionPanel sessionId={sessionId} questionId={question.id} />}
                </div>
              )}
            </section>
          );
        })}
      </div>
      {results && (
        <details className="topik-source">
          <summary>Savol manbasi</summary>
          <p>
            {group.origin === 'official'
              ? `TOPIK II · 제${group.source.exam}회 · ${group.questions.map((q) => q.number).join(', ')}-savol`
              : 'Hangang Academy tomonidan tuzilgan mashq'}
          </p>
          {group.source.pages.length > 0 && (
            <p>
              {group.source.pages.join(', ')}-sahifa · {group.source.file.split('/').at(-1)}
            </p>
          )}
        </details>
      )}
    </article>
  );
}
