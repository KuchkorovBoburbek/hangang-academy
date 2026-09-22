'use client';
import { useEffect, useState } from 'react';
import type { TopikTeachingReport } from '@/lib/topik-teaching';
import { api, errorText, Modal } from './ui';
export default function TopikTeaching() {
  const [report, setReport] = useState<TopikTeachingReport>([]),
    [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<{
    groupId: string;
    name: string;
    category?: string;
    wordIds?: string[];
  } | null>(null);
  const [days, setDays] = useState(7);
  async function load() {
    try {
      setReport(await api<TopikTeachingReport>('teacher/topik-report'));
      setError('');
    } catch (e) {
      setError(errorText(e));
    }
  }
  useEffect(() => {
    void load();
  }, []);
  async function assign() {
    if (!draft || busy) return;
    setBusy(true);
    try {
      await api('teacher/topik-assignment', {
        method: 'POST',
        body: JSON.stringify({
          ...draft,
          dueAt: new Date(Date.now() + days * 86400000).toISOString(),
        }),
      });
      setDraft(null);
      setMessage('Maqsadli mashq guruhga berildi.');
      await load();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="topik-teaching">
      <h2>TOPIK bo‘yicha keyingi dars</h2>
      <p>Oxirgi 30 kun. O‘quvchi TOPIK mashqlari va lug‘atdagi javoblari asosida.</p>
      {error && (
        <p className="alert error" role="alert">
          {error}
          <button onClick={load}>Qayta urinish</button>
        </p>
      )}
      {message && <p role="status">{message}</p>}
      {report.map((group) => (
        <article className="panel" key={group.groupId}>
          <h3>{group.name}</h3>
          <p>{group.students} o‘quvchi</p>
          {!group.categories.length && !group.words.length && (
            <p>TOPIK mashqlari bajarilgach, tavsiyalar shu yerda ko‘rinadi.</p>
          )}
          {group.categories.map((c) => (
            <div className="teaching-row" key={c.category}>
              <div>
                <strong>읽기 {c.category}</strong>
                <p>
                  {c.wrong}/{c.total} xato ·{' '}
                  {c.enough ? 'Mustahkamlash uchun' : 'Hali ma’lumot kam'}
                </p>
                <small>{c.learners.join(', ')}</small>
              </div>
              <button
                className="button secondary"
                onClick={() =>
                  setDraft({ groupId: group.groupId, name: group.name, category: c.category })
                }
              >
                Shu turdan vazifa
              </button>
            </div>
          ))}
          {!!group.words.length && (
            <div className="teaching-words">
              <h4>Takrorlash kerak bo‘lgan so‘zlar</h4>
              <p>{group.words.map((w) => `${w.ko} (${w.wrong}/${w.total})`).join(' · ')}</p>
              <button
                className="button secondary"
                onClick={() =>
                  setDraft({
                    groupId: group.groupId,
                    name: group.name,
                    wordIds: group.words.map((w) => w.id),
                  })
                }
              >
                {group.words.length} so‘zdan vazifa
              </button>
            </div>
          )}
          {group.assignments.map((a) => (
            <div className="teaching-row" key={a.id}>
              <strong>{a.title}</strong>
              <span>
                {a.completed}/{group.students} bajardi
              </span>
            </div>
          ))}
        </article>
      ))}
      {draft && (
        <Modal title="Maqsadli mashq" onClose={() => setDraft(null)}>
          <p>
            <strong>{draft.name}</strong> guruhiga{' '}
            {draft.category
              ? `읽기 ${draft.category} turidan 10 ta savol`
              : `${draft.wordIds?.length} ta so‘z`}{' '}
            beriladi.
          </p>
          <label>
            Muddat
            <select value={days} onChange={(e) => setDays(Number(e.target.value))}>
              <option value={1}>1 kun</option>
              <option value={3}>3 kun</option>
              <option value={7}>7 kun</option>
            </select>
          </label>
          <button className="button primary" disabled={busy} onClick={assign}>
            Guruhga vazifa berish
          </button>
        </Modal>
      )}
    </section>
  );
}
