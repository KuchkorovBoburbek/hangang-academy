'use client';
import { useCallback, useEffect, useState } from 'react';
import type { StudyAssignment } from '@/lib/topik-teaching';
import { api, errorText, dateLabel } from './ui';
import { ReadingSession } from './topik';
export default function StudyAssignmentView({
  assignmentId,
  notify,
  refresh,
}: {
  assignmentId: string;
  notify: (s: string) => void;
  refresh: () => void;
}) {
  const [data, setData] = useState<StudyAssignment | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [reading, setReading] = useState(false),
    [reveal, setReveal] = useState(false);
  const load = useCallback(async () => {
    try {
      setData(await api<StudyAssignment>(`study/assignment/${assignmentId}`));
      setError('');
    } catch (e) {
      setError(errorText(e));
    }
  }, [assignmentId]);
  useEffect(() => {
    void load();
  }, [load]);
  async function start() {
    setBusy(true);
    try {
      setData(await api<StudyAssignment>(`study/assignment/${assignmentId}`, { method: 'POST' }));
      setReading(true);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  const word = data?.words.find((w) => !data.reviewed.includes(w.id));
  async function rate(remembered: boolean) {
    if (!word || busy) return;
    setBusy(true);
    try {
      await api('study/word', {
        method: 'POST',
        body: JSON.stringify({
          wordId: word.id,
          remembered,
          eventKey: `assignment:${assignmentId}:${word.id}`,
        }),
      });
      setReveal(false);
      await load();
      refresh();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  if (reading && data?.session)
    return (
      <ReadingSession
        key={data.session.id}
        initial={data.session}
        notify={notify}
        onExit={() => {
          setReading(false);
          void load();
          refresh();
        }}
      />
    );
  return (
    <div>
      <div className="page-heading">
        <div>
          <span className="eyebrow">USTOZINGIZDAN</span>
          <h1>{data?.assignment.title || 'Topshiriq'}</h1>
          <p>{data && `${dateLabel(data.assignment.due_at)} gacha · ${data.assignment.prompt}`}</p>
        </div>
      </div>
      {error && (
        <p role="alert" className="alert error">
          {error}
        </p>
      )}
      {data && (
        <section className="panel daily-word">
          {data.complete && <h2>Vazifa bajarildi ✓</h2>}
          {data.assignment.kind === 'topik' ? (
            <button className="button primary" disabled={busy} onClick={start}>
              {data.complete
                ? 'Natijani ochish'
                : data.session
                  ? 'Davom etish'
                  : 'Mashqni boshlash'}
            </button>
          ) : word ? (
            <>
              <p>
                {data.reviewed.length}/{data.words.length} karta
              </p>
              <h2 lang="ko">{word.ko}</h2>
              <p lang="ko">{word.example}</p>
              {reveal ? (
                <>
                  <strong>{word.uz}</strong>
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
            <p>So‘zlar takrorlash jadvaliga saqlandi.</p>
          )}
        </section>
      )}
    </div>
  );
}
