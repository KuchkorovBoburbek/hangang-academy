'use client';
import { useState } from 'react';
import type { DailyPlan } from '@/lib/daily';
import type { TopikSession } from '@/lib/topik-types';
import { api, errorText } from './ui';
import { ReadingSession } from './topik';
export default function DailyPractice({
  notify,
  onRefresh,
}: {
  notify: (s: string) => void;
  onRefresh: () => void;
}) {
  const [minutes, setMinutes] = useState<10 | 20 | 30>(10);
  const [plan, setPlan] = useState<DailyPlan | null>(null);
  const [session, setSession] = useState<TopikSession | null>(null);
  const [wordsOpen, setWordsOpen] = useState(false);
  const [reveal, setReveal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function load() {
    setBusy(true);
    setError('');
    try {
      setPlan(
        await api<DailyPlan>('study/daily', { method: 'POST', body: JSON.stringify({ minutes }) }),
      );
      onRefresh();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function start(index: number) {
    if (!plan || busy) return;
    if (plan.steps[index].kind === 'words') {
      setWordsOpen(true);
      return;
    }
    setBusy(true);
    try {
      setSession(
        await api<TopikSession>('study/daily/step', {
          method: 'POST',
          body: JSON.stringify({ planId: plan.id, step: index }),
        }),
      );
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  const step = plan?.steps.find((s) => s.kind === 'words');
  const word = step?.words.find((w) => !step.reviewed.includes(w.id));
  async function rate(remembered: boolean) {
    if (!word || !plan || busy) return;
    setBusy(true);
    try {
      await api('study/word', {
        method: 'POST',
        body: JSON.stringify({
          wordId: word.id,
          remembered,
          eventKey: `daily:${plan.id}:${word.id}`,
        }),
      });
      setReveal(false);
      await load();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  if (session)
    return (
      <ReadingSession
        initial={session}
        key={session.id}
        notify={notify}
        onExit={() => {
          setSession(null);
          void load();
        }}
      />
    );
  return (
    <div className="daily-plan">
      <div className="page-heading">
        <div>
          <span className="eyebrow">SIZNING O‘RGANISH YO‘LINGIZ</span>
          <h1>Bugungi mashq</h1>
          <p>Vaqtingizni tanlang. Reja takrorlashlar va natijalaringizga moslanadi.</p>
        </div>
      </div>
      {error && (
        <div role="alert" className="alert error">
          {error}
        </div>
      )}
      <section className="panel study-review-banner">
        <div className="segmented">
          {([10, 20, 30] as const).map((m) => (
            <button
              key={m}
              disabled={busy}
              className={minutes === m ? 'active' : ''}
              onClick={() => {
                setMinutes(m);
                setPlan(null);
                setWordsOpen(false);
              }}
            >
              {m} daqiqa
            </button>
          ))}
        </div>
        <button className="button primary" disabled={busy} onClick={load}>
          Rejani ochish
        </button>
        <p>Vaqt taxminiy; o‘z sur’atingizda ishlashingiz mumkin.</p>
      </section>
      {plan && (
        <>
          <section className="panel study-review-banner">
            <h2>
              {plan.complete
                ? 'Bugungi reja bajarildi ✓'
                : `${plan.steps.filter((s) => s.complete).length} / ${plan.steps.length} bosqich bajarildi`}
            </h2>
          </section>
          <div className="study-plan-steps">
            {plan.steps.map((s, i) => (
              <section className="panel" key={s.kind}>
                <span className="eyebrow">{i + 1}-BOSQICH</span>
                <h2>{s.title}</h2>
                <p>
                  {s.kind === 'words'
                    ? `${s.reviewed.length} / ${s.words.length} karta`
                    : `${s.count} ta savol · Bir matndagi savollar birga beriladi`}
                </p>
                <button className="button primary" disabled={busy} onClick={() => start(i)}>
                  {s.complete ? 'Natijani ko‘rish' : s.sessionId ? 'Davom etish' : 'Boshlash'}
                </button>
              </section>
            ))}
          </div>
        </>
      )}
      {wordsOpen && (
        <section className="panel daily-word">
          {word ? (
            <>
              <span className="eyebrow">ESLAB KO‘RING</span>
              <h2 lang="ko">{word.ko}</h2>
              <p lang="ko">{word.example}</p>
              {reveal ? (
                <>
                  <p>
                    <strong>{word.uz}</strong>
                  </p>
                  <p>{word.translation}</p>
                  <div className="button-row">
                    <button
                      className="button secondary"
                      disabled={busy}
                      onClick={() => rate(false)}
                    >
                      Yana o‘rganaman
                    </button>
                    <button className="button primary" disabled={busy} onClick={() => rate(true)}>
                      Esladim
                    </button>
                  </div>
                </>
              ) : (
                <button className="button secondary" onClick={() => setReveal(true)}>
                  Ma’nosini ochish
                </button>
              )}
            </>
          ) : (
            <>
              <h2>Kartalar yakunlandi ✓</h2>
              <p>Natijalar va keyingi takrorlash muddati saqlandi.</p>
              <button className="button primary" onClick={() => setWordsOpen(false)}>
                Rejaga qaytish
              </button>
            </>
          )}
        </section>
      )}
    </div>
  );
}
