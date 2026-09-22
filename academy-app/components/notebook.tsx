'use client';
import { useEffect, useMemo, useState } from 'react';
import {
  Archive,
  BookOpen,
  FileText,
  Folder,
  History,
  Languages,
  Pencil,
  Pin,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import type { StudentData } from './student';
import type { Note } from '@/lib/types';
import type { SolutionContent } from '@/lib/solution-types';
import type { TopikSession } from '@/lib/topik-types';
import { SolutionText } from './solution-panel';
import { api, dateLabel, errorText, Modal, Empty } from './ui';
import '@/app/notebook.css';
type Tab = 'all' | 'solution' | 'grammar' | 'word' | 'note' | 'pinned' | 'archive' | 'history';
const LABELS: Record<string, string> = {
  note: 'Shaxsiy qayd',
  grammar: 'Grammatika',
  word: 'Lug‘at',
  solution: 'TOPIK yechimi',
};
const folderOf = (n: Note) => n.folder || LABELS[n.kind || 'note'];
function snapshot(n: Note) {
  try {
    return n.solution_snapshot
      ? (JSON.parse(n.solution_snapshot) as {
          content: SolutionContent;
          answer: number;
          options: string[];
          prompt: string;
          category: string;
          source: { exam: number | null };
        })
      : null;
  } catch {
    return null;
  }
}
export default function Notebook({
  data,
  refresh,
  notify,
}: {
  data: StudentData;
  refresh: () => void;
  notify: (text: string) => void;
}) {
  const notes = data.notes as unknown as Note[];
  const [tab, setTab] = useState<Tab>('all'),
    [search, setSearch] = useState(''),
    [folder, setFolder] = useState('all'),
    [sort, setSort] = useState('recent'),
    [limit, setLimit] = useState(12),
    [selected, setSelected] = useState<string | null>(null),
    [editing, setEditing] = useState<Partial<Note> | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [undo, setUndo] = useState<string | null>(null);
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('note');
    if (id) setSelected(id);
  }, []);
  useEffect(() => setLimit(12), [tab, folder, search]);
  const folders = [
    ...new Set(notes.filter((n) => (tab === 'archive' ? !!n.archived : !n.archived)).map(folderOf)),
  ].sort((a, b) => a.localeCompare(b));
  const filtered = useMemo(
    () =>
      notes
        .filter((n) => (tab === 'archive' ? !!n.archived : !n.archived))
        .filter((n) =>
          tab === 'all' || tab === 'archive' || tab === 'pinned'
            ? tab !== 'pinned' || !!n.pinned
            : n.kind === tab,
        )
        .filter((n) => folder === 'all' || folderOf(n) === folder)
        .filter((n) =>
          `${n.title} ${n.body} ${n.tags || ''} ${n.solution_snapshot || ''}`
            .toLowerCase()
            .includes(search.toLowerCase()),
        )
        .sort(
          (a, b) =>
            (b.pinned || 0) - (a.pinned || 0) ||
            (sort === 'title'
              ? a.title.localeCompare(b.title)
              : b.updated_at.localeCompare(a.updated_at)),
        ),
    [notes, tab, folder, search, sort],
  );
  const current = notes.find((n) => n.id === selected),
    source = current ? snapshot(current) : null;
  async function organize(
    n: Note,
    changes: { pinned?: boolean; archived?: boolean; folder?: string },
  ) {
    if (busy) return;
    setBusy(true);
    try {
      await api(`notes/${n.id}`, { method: 'PATCH', body: JSON.stringify(changes) });
      if (changes.archived === true) {
        setUndo(n.id);
        setSelected(null);
      }
      await refresh();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    setError('');
    try {
      const result = await api<{ id: string }>('notes', {
        method: 'POST',
        body: JSON.stringify({
          id: editing?.id,
          title: fd.get('title'),
          body: fd.get('body'),
          ...(editing?.kind !== 'solution' ? { kind: fd.get('kind') } : {}),
          folder: fd.get('folder'),
          tags: String(fd.get('tags') || '')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          pinned: fd.get('pinned') === 'on',
        }),
      });
      setEditing(null);
      setSelected(result.id);
      await refresh();
      notify('Qayd saqlandi.');
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function remove(n: Note) {
    if (!window.confirm('Arxivdagi bu qaydni butunlay o‘chirasizmi?')) return;
    setBusy(true);
    try {
      await api(`notes/${n.id}`, { method: 'DELETE' });
      setSelected(null);
      await refresh();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function retry(n: Note) {
    if (!n.question_id) return;
    setBusy(true);
    try {
      const session = await api<TopikSession>('topik/start', {
        method: 'POST',
        body: JSON.stringify({ mode: 'review', questionIds: [n.question_id] }),
      });
      window.location.assign(`/topik/session/${session.id}`);
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  }
  const tabs: { id: Tab; label: string; icon: typeof BookOpen }[] = [
    { id: 'all', label: 'Barchasi', icon: BookOpen },
    { id: 'solution', label: 'TOPIK yechimlari', icon: FileText },
    { id: 'grammar', label: 'Grammatika', icon: BookOpen },
    { id: 'word', label: 'Lug‘at', icon: Languages },
    { id: 'note', label: 'Qaydlarim', icon: Pencil },
    { id: 'pinned', label: 'Muhimlar', icon: Pin },
    { id: 'archive', label: 'Arxiv', icon: Archive },
    { id: 'history', label: 'Mashqlar tarixi', icon: History },
  ];
  return (
    <div className="notebook-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">나의 노트 · BILIMLAR DAFTARI</span>
          <h1>Mening daftarim</h1>
          <p>Kerakli bilimni toping, o‘z izohingizni yozing va yana mashq qiling.</p>
        </div>
        <button
          className="button primary"
          onClick={() => {
            setEditing({ kind: 'note', folder: folder === 'all' ? '' : folder });
            setError('');
          }}
        >
          <Plus size={18} />
          Yangi qayd
        </button>
      </div>
      <div className="notebook-tabs" aria-label="Daftar bo‘limlari">
        {tabs.map((t) => (
          <button
            key={t.id}
            className={tab === t.id ? 'active' : ''}
            aria-pressed={tab === t.id}
            onClick={() => {
              setTab(t.id);
              setFolder('all');
            }}
          >
            <t.icon size={17} />
            {t.label}
            {t.id !== 'history' && (
              <span>
                {
                  notes.filter((n) =>
                    t.id === 'archive'
                      ? !!n.archived
                      : !n.archived &&
                        (t.id === 'all' || (t.id === 'pinned' ? !!n.pinned : n.kind === t.id)),
                  ).length
                }
              </span>
            )}
          </button>
        ))}
      </div>
      {!editing && error && (
        <p role="alert" className="alert error">
          {error}
        </p>
      )}
      {undo && (
        <div className="notebook-undo" role="status">
          Qayd arxivlandi.
          <button
            className="text-button"
            disabled={busy}
            onClick={() => {
              const n = notes.find((n) => n.id === undo);
              if (n) void organize(n, { archived: false });
              setUndo(null);
            }}
          >
            Qaytarish
          </button>
        </div>
      )}
      {tab === 'history' ? (
        <section className="panel notebook-history">
          <h2>Mashqlar tarixi</h2>
          <p>Shaxsiy qaydlaringizdan alohida saqlanadi.</p>
          {[
            ...data.topikHistory.map((h) => ({
              id: h.id,
              title: `TOPIK · ${h.mode === 'mock' ? 'Mock' : 'Mashq'}`,
              date: h.at,
              score: h.score,
              total: h.total,
              url: `/topik/session/${h.id}`,
            })),
            ...data.history.map((h) => ({
              id: h.id,
              title:
                h.kind === 'grammar'
                  ? 'Grammatika'
                  : h.kind === 'vocabulary'
                    ? 'Lug‘at'
                    : 'Takrorlash',
              date: h.completed_at!,
              score: h.score,
              total: h.total,
              url: null,
            })),
          ]
            .sort((a, b) => b.date.localeCompare(a.date))
            .map((h) => (
              <div className="history-row" key={h.id}>
                <div>
                  <strong>{h.title}</strong>
                  <p>{dateLabel(h.date)}</p>
                </div>
                <span>
                  {h.score}/{h.total}
                </span>
                {h.url && (
                  <a className="text-button" href={h.url}>
                    Natijani ochish →
                  </a>
                )}
              </div>
            ))}
          {!data.history.length && !data.topikHistory.length && (
            <Empty title="Hali yakunlangan mashq yo‘q">
              Bajarilgan mashqlar shu yerda ko‘rinadi.
            </Empty>
          )}
        </section>
      ) : (
        <>
          <div className="notebook-toolbar">
            <label className="notebook-search">
              <Search size={18} />
              <input
                aria-label="Daftardan qidirish"
                value={search}
                placeholder="So‘z, mavzu yoki yechimdan qidiring…"
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            <label>
              Papka
              <select value={folder} onChange={(e) => setFolder(e.target.value)}>
                <option value="all">Barcha papkalar</option>
                {folders.map((f) => (
                  <option key={f}>{f}</option>
                ))}
              </select>
            </label>
            <label>
              Tartib
              <select value={sort} onChange={(e) => setSort(e.target.value)}>
                <option value="recent">Oxirgi yangilangan</option>
                <option value="title">Sarlavha bo‘yicha</option>
              </select>
            </label>
          </div>
          <div className="notebook-list-heading">
            <span>{filtered.length} ta qayd</span>
            {(search || folder !== 'all') && (
              <button
                className="text-button"
                onClick={() => {
                  setSearch('');
                  setFolder('all');
                }}
              >
                Filtrlarni tozalash
              </button>
            )}
          </div>
          <div className="notebook-grid">
            {filtered.slice(0, limit).map((n) => {
              const s = snapshot(n);
              return (
                <article className={`notebook-card ${n.pinned ? 'pinned' : ''}`} key={n.id}>
                  <div className="notebook-card-meta">
                    <span>{LABELS[n.kind || 'note']}</span>
                    <button
                      className="icon-button"
                      aria-label={n.pinned ? 'Muhimlardan olish' : 'Muhimlarga qo‘shish'}
                      aria-pressed={!!n.pinned}
                      disabled={busy}
                      onClick={() => organize(n, { pinned: !n.pinned })}
                    >
                      <Pin size={17} fill={n.pinned ? 'currentColor' : 'none'} />
                    </button>
                  </div>
                  <button className="notebook-card-open" onClick={() => setSelected(n.id)}>
                    <h2>{n.title}</h2>
                    <p>{s ? s.content.reason : n.body}</p>
                  </button>
                  <div className="notebook-tags">
                    {(JSON.parse(n.tags || '[]') as string[]).map((tag) => (
                      <button key={tag} onClick={() => setSearch(tag)}>
                        #{tag}
                      </button>
                    ))}
                  </div>
                  <footer>
                    <span>
                      <Folder size={13} />
                      {folderOf(n)}
                    </span>
                    <small>{dateLabel(n.updated_at)}</small>
                  </footer>
                </article>
              );
            })}
          </div>
          {!filtered.length && (
            <Empty
              title={
                search || folder !== 'all'
                  ? 'Mos qayd topilmadi'
                  : tab === 'solution'
                    ? 'Saqlangan yechimlar hali yo‘q'
                    : tab === 'archive'
                      ? 'Arxiv bo‘sh'
                      : 'Bu bo‘lim hali bo‘sh'
              }
            >
              {tab === 'solution'
                ? 'Savolni yechib, “Yechimni ko‘rish” → “Yechimni daftarimga saqlash” tugmasini bosing.'
                : search
                  ? 'Boshqa so‘z bilan qidiring yoki filtrlarni tozalang.'
                  : 'Yangi qayd yozing yoki o‘rgangan mavzuni daftaringizga saqlang.'}
            </Empty>
          )}
          {filtered.length > limit && (
            <button className="button secondary" onClick={() => setLimit(limit + 12)}>
              Yana 12 ta ko‘rsatish
            </button>
          )}
        </>
      )}
      {current && !editing && (
        <Modal title={current.title} wide onClose={() => setSelected(null)}>
          <div className="notebook-detail">
            {error && (
              <p role="alert" className="alert error">
                {error}
              </p>
            )}
            <div className="notebook-detail-meta">
              <span>
                {LABELS[current.kind || 'note']} · {folderOf(current)}
              </span>
              <span>{dateLabel(current.updated_at)}</span>
            </div>
            {source && (
              <>
                <div className="notebook-source">
                  <strong>
                    {source.source.exam ? `TOPIK ${source.source.exam}회` : 'Grammatika'} · 읽기{' '}
                    {source.category}
                  </strong>
                  {source.prompt && <p lang="ko">{source.prompt.replace(/<\/?u>/g, '')}</p>}
                  <p>
                    To‘g‘ri javob: {['①', '②', '③', '④'][source.answer]}{' '}
                    <span lang="ko">{source.options[source.answer]}</span>
                  </p>
                </div>
                <SolutionText content={source.content} />
                <small className="muted">
                  Saqlangan yechim · {current.solution_revision}-tahrir. Ustoz yangilagan yechimni
                  savol sahifasida ko‘rishingiz mumkin.
                </small>
                <h3>Mening izohim</h3>
              </>
            )}
            {current.body ? (
              <p className="notebook-body">{current.body}</p>
            ) : (
              <p className="muted">O‘zingizga foydali eslatma yoki misol yozing.</p>
            )}
            <div className="notebook-detail-actions">
              <button
                className="button secondary"
                onClick={() => {
                  setEditing(current);
                  setError('');
                }}
              >
                <Pencil size={16} />
                {source ? 'Shaxsiy izoh yozish' : 'Tahrirlash'}
              </button>
              {current.question_id && (
                <button className="button primary" disabled={busy} onClick={() => retry(current)}>
                  Qayta yechish
                </button>
              )}
              {current.source_session_id && (
                <a
                  className="text-button"
                  href={`/topik/session/${current.source_session_id}#topik-q-${current.question_id}`}
                >
                  Savol va yechimni ochish →
                </a>
              )}
              <button
                className="text-button"
                disabled={busy}
                onClick={() => organize(current, { archived: !current.archived })}
              >
                <Archive size={16} />
                {current.archived ? 'Arxivdan qaytarish' : 'Arxivlash'}
              </button>
              {!!current.archived && (
                <button
                  className="text-button danger"
                  disabled={busy}
                  onClick={() => remove(current)}
                >
                  <Trash2 size={16} />
                  Butunlay o‘chirish
                </button>
              )}
            </div>
          </div>
        </Modal>
      )}
      {editing && (
        <Modal
          title={editing.id ? 'Qaydni tartiblash' : 'Yangi qayd'}
          onClose={() => {
            if (!busy) setEditing(null);
          }}
        >
          <form className="form-stack" onSubmit={save}>
            <label>
              Sarlavha
              <input name="title" defaultValue={editing.title} required maxLength={150} />
            </label>
            {editing.kind !== 'solution' && (
              <label>
                Bo‘lim
                <select name="kind" defaultValue={editing.kind || 'note'}>
                  <option value="note">Shaxsiy qayd</option>
                  <option value="grammar">Grammatika</option>
                  <option value="word">Lug‘at</option>
                </select>
              </label>
            )}
            <label>
              {editing.kind === 'solution'
                ? 'Mening izohim (saqlangan yechim o‘zgarmaydi)'
                : 'Qayd va misollar'}
              <textarea
                name="body"
                rows={6}
                required={editing.kind !== 'solution'}
                maxLength={8000}
                defaultValue={editing.body}
              />
            </label>
            <label>
              Papka
              <input
                name="folder"
                list="notebook-folders"
                maxLength={50}
                defaultValue={editing.folder}
                placeholder="Masalan: Sabab grammatikalari"
              />
              <datalist id="notebook-folders">
                {folders.map((f) => (
                  <option key={f} value={f} />
                ))}
              </datalist>
            </label>
            <label>
              Teglar (vergul bilan, 8 tagacha)
              <input
                name="tags"
                defaultValue={(JSON.parse(editing.tags || '[]') as string[]).join(', ')}
                placeholder="sabab, 1-4, qayta ko‘rish"
              />
            </label>
            <label className="notebook-checkbox">
              <input type="checkbox" name="pinned" defaultChecked={!!editing.pinned} />
              Muhim qayd sifatida tepaga chiqarish
            </label>
            {error && (
              <p role="alert" className="alert error">
                {error}
              </p>
            )}
            <button className="button primary" disabled={busy}>
              {busy ? 'Saqlanmoqda…' : 'Saqlash'}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
