'use client';
import { useState, useEffect } from 'react';
import { ArrowRight, Check, Clock3, RotateCcw, PartyPopper, BookOpen, X } from 'lucide-react';
import type { viewSession } from '@/lib/learning';
import { api, Modal, Badge, errorText } from './ui';
export type SessionView = ReturnType<typeof viewSession>;
type Reply = {
  correct?: boolean;
  answer?: number;
  explanation?: string;
  translation?: string;
  session: SessionView;
};
export default function Quiz({
  initial,
  onClose,
  onComplete,
}: {
  initial: SessionView;
  onClose: () => void;
  onComplete: () => void;
}) {
  const [session, setSession] = useState(initial);
  const [choice, setChoice] = useState<number | null>(null);
  const [reply, setReply] = useState<Reply | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const tick = () =>
      setElapsed(Math.floor((Date.now() - new Date(session.started_at).getTime()) / 1000));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [session.started_at]);
  async function answer() {
    if (choice === null || !session.question || busy) return;
    setBusy(true);
    setError('');
    try {
      const result = await api<Reply>('quiz/answer', {
        method: 'POST',
        body: JSON.stringify({ sessionId: session.id, questionId: session.question.id, choice }),
      });
      if (session.mode === 'test') {
        setSession(result.session);
        setChoice(null);
        if (result.session.status === 'completed') onComplete();
      } else setReply(result);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  function next() {
    if (!reply) return;
    setSession(reply.session);
    if (reply.session.status === 'completed') onComplete();
    setReply(null);
    setChoice(null);
  }
  const done = session.status === 'completed';
  const label =
    session.kind === 'vocabulary'
      ? 'Lug‘at'
      : session.kind === 'review'
        ? 'Takrorlash'
        : 'Grammatika';
  return (
    <Modal
      title={
        done
          ? 'Mashq yakunlandi'
          : `${label} · ${session.mode === 'test' ? 'Kichik sinov' : 'Mashq'}`
      }
      onClose={onClose}
      wide
    >
      <div className="quiz-content">
        {done ? (
          <>
            <div className="quiz-finish">
              <div className="finish-icon">
                <PartyPopper size={35} />
              </div>
              <Badge tone="green">YANA BIR QADAM OLDINGA</Badge>
              <h2>
                {session.score} <span>/ {session.total}</span>
              </h2>
              <h3>
                {session.score / session.total >= 0.8
                  ? 'Juda yaxshi ishladingiz!'
                  : 'Yaxshi harakat. Takrorlashda davom etamiz.'}
              </h3>
              <p>Natijangiz va keyingi takrorlash muddatlari saqlandi.</p>
              <button className="button primary" onClick={onClose}>
                Natijalarimga qaytish
                <ArrowRight size={18} />
              </button>
            </div>
            <div className="result-list">
              {session.results?.map((r, i) => (
                <details key={r.question_id}>
                  <summary>
                    <span className={`result-dot ${r.correct ? 'correct' : 'wrong'}`}>
                      {r.correct ? <Check size={14} /> : <X size={14} />}
                    </span>
                    <span>
                      {i + 1}. {r.question.prompt}
                    </span>
                  </summary>
                  <div>
                    <p>
                      <strong>To‘g‘ri javob:</strong> {r.question.options[r.question.answer]}
                    </p>
                    <p>{r.question.explanation}</p>
                    <p className="muted">{r.question.translation}</p>
                  </div>
                </details>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="quiz-meta">
              <Badge>
                {session.index + 1} / {session.total} SAVOL
              </Badge>
              <span>
                <Clock3 size={16} />
                {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')}
              </span>
            </div>
            <div className="progress-track">
              <span style={{ width: `${(session.index / session.total) * 100}%` }} />
            </div>
            <p className="quiz-instruction">
              {session.kind === 'vocabulary'
                ? 'Mos tarjimani tanlang.'
                : 'Eng mos javobni tanlang.'}
            </p>
            <h2 className="quiz-prompt" lang="ko">
              {session.question?.prompt}
            </h2>
            <div className="quiz-options">
              {session.question?.options.map((option, i) => (
                <button
                  key={i}
                  disabled={!!reply || busy}
                  onClick={() => setChoice(i)}
                  className={`quiz-option ${choice === i ? 'selected' : ''} ${reply?.answer === i ? 'correct' : ''} ${reply && choice === i && !reply.correct ? 'wrong' : ''}`}
                >
                  <span>{['A', 'B', 'C', 'D'][i]}</span>
                  <strong>{option}</strong>
                  {reply?.answer === i ? (
                    <Check size={20} />
                  ) : choice === i ? (
                    <div className="selection-dot" />
                  ) : null}
                </button>
              ))}
            </div>
            {reply && (
              <div
                className={`quiz-explanation ${reply.correct ? 'correct' : 'wrong'}`}
                role="status"
              >
                <strong>
                  {reply.correct ? 'To‘g‘ri javob!' : 'Bu safar boshqa javob to‘g‘ri.'}
                </strong>
                <p>{reply.explanation}</p>
                <p className="translation">{reply.translation}</p>
              </div>
            )}
            {error && <p className="alert error">{error}</p>}
            <div className="quiz-footer">
              <span>
                <BookOpen size={17} />
                {session.mode === 'test'
                  ? 'Izohlar yakunda ko‘rsatiladi'
                  : 'Har bir javob — yangi bilim'}
              </span>
              {reply ? (
                <button className="button primary" onClick={next}>
                  {reply.session.status === 'completed' ? 'Natijani ko‘rish' : 'Keyingi savol'}
                  <ArrowRight size={18} />
                </button>
              ) : (
                <button
                  className="button primary"
                  disabled={choice === null || busy}
                  onClick={answer}
                >
                  {busy ? 'Tekshirilmoqda…' : 'Javobni tekshirish'}
                  <ArrowRight size={18} />
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
