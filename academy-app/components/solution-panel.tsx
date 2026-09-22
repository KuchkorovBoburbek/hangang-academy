'use client';
import '@/app/notebook.css';
import { useState } from 'react';
import { Bookmark, ChevronDown, ChevronUp, LoaderCircle } from 'lucide-react';
import type { SolutionContent, SolutionView } from '@/lib/solution-types';
import { api, errorText } from './ui';
export function SolutionText({ content }: { content: SolutionContent }) {
  return (
    <div className="solution-content">
      <p>
        <strong>Nega to‘g‘ri?</strong> {content.reason}
      </p>
      {content.evidence && <blockquote lang="ko">{content.evidence}</blockquote>}
      <p>
        <strong>Qolgan variantlar:</strong> {content.elimination}
      </p>
      <p className="solution-tip">
        <strong>Eslab qoling:</strong> {content.tip}
      </p>
    </div>
  );
}
export default function SolutionPanel({
  sessionId,
  questionId,
}: {
  sessionId: string;
  questionId: string;
}) {
  const [open, setOpen] = useState(false),
    [solution, setSolution] = useState<SolutionView | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [saving, setSaving] = useState(false);
  async function toggle() {
    if (busy) return;
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    setBusy(true);
    setError('');
    setSolution(null);
    try {
      setSolution(
        await api<SolutionView>(
          `topik/solution?sessionId=${encodeURIComponent(sessionId)}&questionId=${encodeURIComponent(questionId)}`,
        ),
      );
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    if (saving) return;
    setSaving(true);
    try {
      const note = await api<{ id: string }>('topik/solution/save', {
        method: 'POST',
        body: JSON.stringify({ sessionId, questionId }),
      });
      setSolution((s) => (s ? { ...s, savedNoteId: note.id } : s));
    } catch (e) {
      setError(errorText(e));
    } finally {
      setSaving(false);
    }
  }
  return (
    <section className="solution-panel">
      <button className="text-button" aria-expanded={open} onClick={toggle}>
        {open ? <ChevronUp size={17} /> : <ChevronDown size={17} />}{' '}
        {open ? 'Yechimni yopish' : 'Yechimni ko‘rish'}
      </button>
      {open && (
        <div className="solution-body">
          {busy ? (
            <p role="status">
              <LoaderCircle size={17} className="spin" /> Yechim ochilmoqda…
            </p>
          ) : (
            solution && (
              <>
                <SolutionText content={solution.content} />
                <div className="solution-footer">
                  {solution.savedNoteId ? (
                    <a className="button secondary" href={`/notebook?note=${solution.savedNoteId}`}>
                      Daftarda ochish <Bookmark size={16} />
                    </a>
                  ) : (
                    <button className="button secondary" disabled={saving} onClick={save}>
                      <Bookmark size={16} />{' '}
                      {saving ? 'Saqlanmoqda…' : 'Yechimni daftarimga saqlash'}
                    </button>
                  )}
                  <small>{solution.revision}-tahrir</small>
                </div>
              </>
            )
          )}
          {error && (
            <p className="alert error" role="alert">
              {error}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
