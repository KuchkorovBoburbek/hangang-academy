'use client';
import '@/app/notebook.css';
import { useEffect, useState } from 'react';
import type { listSolutionEditor, solutionEditorDetail } from '@/lib/topik-solutions';
import type { SolutionContent } from '@/lib/solution-types';
import { TOPIK_CATEGORIES } from '@/lib/topik-types';
import { api, errorText, Modal, dateLabel } from './ui';
import TopikPaper from './topik-paper';
import { SolutionText } from './solution-panel';
const EMPTY: SolutionContent = { reason: '', evidence: '', elimination: '', tip: '' };
export default function SolutionEditor() {
  const [list, setList] = useState<ReturnType<typeof listSolutionEditor> | null>(null),
    [detail, setDetail] = useState<ReturnType<typeof solutionEditorDetail> | null>(null),
    [content, setContent] = useState(EMPTY),
    [category, setCategory] = useState('all'),
    [search, setSearch] = useState(''),
    [page, setPage] = useState(1),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [reload, setReload] = useState(0);
  useEffect(() => {
    let current = true;
    const timer = setTimeout(() => {
      api<ReturnType<typeof listSolutionEditor>>(
        `teacher/solutions?category=${category}&search=${encodeURIComponent(search)}&page=${page}`,
      )
        .then((v) => {
          if (current) setList(v);
        })
        .catch((e) => {
          if (current) setError(errorText(e));
        });
    }, 180);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [category, search, page, reload]);
  async function open(id: string) {
    setBusy(true);
    setError('');
    try {
      const d = await api<ReturnType<typeof solutionEditorDetail>>(
        `teacher/solutions/${encodeURIComponent(id)}`,
      );
      setDetail(d);
      setContent(d.content || EMPTY);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!detail || busy) return;
    setBusy(true);
    try {
      await api(`teacher/solutions/${detail.question.id}`, {
        method: 'POST',
        body: JSON.stringify({ content, revision: detail.revision, sourceHash: detail.sourceHash }),
      });
      setDetail(null);
      setReload((v) => v + 1);
      setMessage('Yechim yangilandi. O‘quvchilar ochganda yangi tahrir ko‘rinadi.');
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="solution-editor">
      <div className="page-heading">
        <div>
          <span className="eyebrow">BOSH USTOZ · YECHIMLAR</span>
          <h1>TOPIK yechimlari</h1>
          <p>Qisqa sabab, matndagi dalil va variantlar farqi. Har tahrir tarixda saqlanadi.</p>
        </div>
      </div>
      {!detail && error && (
        <p role="alert" className="alert error">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      <div className="notebook-toolbar">
        <label>
          Qidirish
          <input
            value={search}
            placeholder="Savol, imtihon yoki kalit so‘z…"
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </label>
        <label>
          Savol turi
          <select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">Barcha turlar</option>
            {TOPIK_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                읽기 {c.id}
              </option>
            ))}
          </select>
        </label>
        <span>
          {list?.ready || 0} / {list?.total || 0} yechim tayyor
        </span>
      </div>
      <div className="panel">
        {list?.items.map((q) => (
          <button
            className="solution-editor-row"
            key={q.id}
            disabled={busy}
            onClick={() => open(q.id)}
          >
            <span>
              <strong>
                {q.exam ? `${q.exam}회` : 'Grammatika'} · {q.number}-savol
              </strong>
              <small>
                읽기 {q.category} · {q.prompt.replace(/<\/?u>/g, '')}
              </small>
            </span>
            <span>{q.hasSolution ? `${q.revision}-tahrir` : 'Yechim yozish'} →</span>
          </button>
        ))}
      </div>
      <div className="notebook-pagination">
        <button
          className="button secondary"
          disabled={page === 1}
          onClick={() => setPage(page - 1)}
        >
          Oldingi
        </button>
        <span>
          {page} / {list?.pages || 1}
        </span>
        <button
          className="button secondary"
          disabled={page >= (list?.pages || 1)}
          onClick={() => setPage(page + 1)}
        >
          Keyingi
        </button>
      </div>
      {detail && (
        <Modal
          title={`${detail.group.source.exam || 'Grammatika'} · ${detail.question.number}-savol yechimi`}
          wide
          onClose={() => {
            if (!busy) setDetail(null);
          }}
        >
          <div className="solution-editor-grid">
            <div>
              <TopikPaper
                group={{
                  ...detail.group,
                  questions: detail.group.questions.map((q) => ({ ...q, displayNumber: q.number })),
                }}
                choices={{ [detail.question.id]: detail.question.answer! }}
                disabled
              />
              <p>
                <strong>Javob kaliti: {['①', '②', '③', '④'][detail.question.answer!]}</strong>
              </p>
            </div>
            <form className="form-stack" onSubmit={save}>
              {(
                [
                  ['reason', 'Nega to‘g‘ri?', 500],
                  ['evidence', 'Matndan qisqa dalil (koreyscha)', 200],
                  ['elimination', 'Qolgan uch variantdagi xato', 500],
                  ['tip', 'Bitta amaliy eslatma', 200],
                ] as const
              ).map(([key, label, max]) => (
                <label key={key}>
                  {label}
                  <textarea
                    required={key !== 'evidence'}
                    maxLength={max}
                    minLength={key === 'evidence' ? 0 : key === 'tip' ? 10 : 20}
                    rows={key === 'elimination' ? 4 : 3}
                    value={content[key]}
                    onChange={(e) => setContent({ ...content, [key]: e.target.value })}
                  />
                  <small>
                    {content[key].length}/{max}
                  </small>
                </label>
              ))}
              {error && (
                <p role="alert" className="alert error">
                  {error}
                </p>
              )}
              <button className="button primary" disabled={busy}>
                Yechimni saqlash
              </button>
              <details>
                <summary>O‘quvchi ko‘rinishi</summary>
                <SolutionText content={content} />
              </details>
              <details>
                <summary>Tahrirlar tarixi</summary>
                {detail.history.map((h) => (
                  <p key={h.revision}>
                    {h.revision}-tahrir · {dateLabel(h.updated_at)}
                  </p>
                ))}
              </details>
            </form>
          </div>
        </Modal>
      )}
    </div>
  );
}
