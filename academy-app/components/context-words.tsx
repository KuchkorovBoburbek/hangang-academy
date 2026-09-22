'use client';
import { createContext, Fragment, useContext, useState } from 'react';
import type { TopikVocabulary } from '@/lib/topik-types';
import { matchWords, wordCloze } from '@/lib/word-context';
import { api, Modal, errorText } from './ui';
export const WordContext = createContext<{
  words: TopikVocabulary[];
  open: (word: TopikVocabulary, surface: string, text: string) => void;
} | null>(null);
export function WordText({ text }: { text: string }) {
  const context = useContext(WordContext);
  if (!context) return <>{text}</>;
  const matches = matchWords(text, context.words);
  let position = 0;
  return (
    <>
      {matches.map((m, i) => {
        const before = text.slice(position, m.start);
        position = m.end;
        return (
          <Fragment key={i}>
            {before}
            <button
              type="button"
              className="context-word"
              onClick={(e) => {
                e.preventDefault();
                const before = text.slice(0, m.start),
                  after = text.slice(m.end);
                const left =
                  Math.max(
                    before.lastIndexOf('.'),
                    before.lastIndexOf('?'),
                    before.lastIndexOf('!'),
                    before.lastIndexOf('\n'),
                  ) + 1;
                const right = after.search(/[.!?\n]/);
                context.open(
                  m.word,
                  m.surface,
                  text
                    .slice(
                      Math.max(left, m.start - 180),
                      right < 0 ? Math.min(text.length, m.end + 180) : m.end + right + 1,
                    )
                    .trim(),
                );
              }}
            >
              {m.surface}
            </button>
          </Fragment>
        );
      })}
      {text.slice(position)}
    </>
  );
}
export function ContextWordModal({
  item,
  onClose,
}: {
  item: { word: TopikVocabulary; surface: string; text: string };
  onClose: () => void;
}) {
  const [saved, setSaved] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const [answer, setAnswer] = useState(''),
    [reply, setReply] = useState<{ correct: boolean; answer: string } | null>(null);
  const [eventKey] = useState(() => crypto.randomUUID());
  const cloze = wordCloze(item.word);
  async function save() {
    setBusy(true);
    try {
      await api('study/word/save', {
        method: 'POST',
        body: JSON.stringify({ wordId: item.word.id }),
      });
      setSaved(true);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function check() {
    setBusy(true);
    try {
      setReply(
        await api('study/cloze', {
          method: 'POST',
          body: JSON.stringify({ wordId: item.word.id, answer, eventKey }),
        }),
      );
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="So‘zni matnda o‘rganish" onClose={onClose}>
      <div className="context-detail">
        <span className="eyebrow">MATNDAGI SHAKL</span>
        <h2 lang="ko">{item.surface}</h2>
        <p>
          Asl shakli: <strong lang="ko">{item.word.ko}</strong> · {item.word.pos}
        </p>
        <p>
          <strong>{item.word.uz}</strong>
        </p>
        <blockquote lang="ko">{item.text}</blockquote>
        <button className="button primary" disabled={busy || saved} onClick={save}>
          {saved ? 'Takrorlashga saqlandi ✓' : 'Takrorlashga qo‘shish'}
        </button>
        {error && <p role="alert">{error}</p>}
        {cloze && (
          <section>
            <h3>Gapni to‘ldiring</h3>
            <p className="muted">Quyidagi o‘quv misolida so‘zning mos shaklini yozing.</p>
            <p lang="ko">{cloze.prompt}</p>
            <p>{item.word.translation}</p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void check();
              }}
            >
              <input
                aria-label="Tushirib qoldirilgan so‘z"
                lang="ko"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                disabled={!!reply || busy}
                autoComplete="off"
              />
              <button className="button secondary" disabled={!answer.trim() || busy || !!reply}>
                Tekshirish
              </button>
            </form>
            {reply && (
              <p role="status">
                {reply.correct ? 'To‘g‘ri ✓' : `Mos shakl: ${reply.answer}`} · Natija saqlandi.
              </p>
            )}
          </section>
        )}
      </div>
    </Modal>
  );
}
