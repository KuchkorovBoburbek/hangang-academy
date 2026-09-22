'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Layers3,
  LayoutGrid,
  List,
  Search,
  Shuffle,
  X,
  RotateCcw,
  Check,
  CheckCircle2,
  LoaderCircle,
  Pencil,
  NotebookPen,
} from 'lucide-react';
import { api, Badge, Empty, errorText } from './ui';
import {
  VOCABULARY_BANDS,
  bandLabel,
  sectionLabel,
  type VocabularySection,
  type VocabularyEntry,
} from '@/lib/vocabulary-types';
import '@/app/topik.css';
const LoadingSection = () => (
  <div className="topik-loading" role="status">
    <LoaderCircle className="spin" /> Lug‘at yuklanmoqda…
  </div>
);
const InlineError = ({ message, retry }: { message: string; retry: () => void }) => (
  <div className="alert error" role="alert">
    {message} <button onClick={retry}>Qayta urinish</button>
  </div>
);
export default function VocabularyDeck({
  kind,
  section,
  teacher,
  onEdit,
  onNote,
  refreshKey,
}: {
  kind: 'word' | 'idiom';
  section: VocabularySection;
  teacher: boolean;
  onEdit: (word: VocabularyEntry) => void;
  onNote: (word: VocabularyEntry) => void;
  refreshKey: number;
}) {
  const [category, setCategory] = useState('all');
  const [items, setItems] = useState<VocabularyEntry[] | null>(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'cards' | 'table'>('cards');
  const [practice, setPractice] = useState(false);
  const [shuffled, setShuffled] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [remembered, setRemembered] = useState(0);
  const [attempted, setAttempted] = useState(0);
  const [retryVersion, setRetryVersion] = useState(0);
  const [reviews, setReviews] = useState<{ item_id: string; kind: string; due_at: string }[]>([]);
  const [dueOnly, setDueOnly] = useState(false);
  const [ratingBusy, setRatingBusy] = useState(false);
  const eventKey = useRef('');
  useEffect(() => {
    if (teacher) return;
    api<{ items: typeof reviews }>('study/reviews')
      .then((d) => setReviews(d.items))
      .catch((e) => setError(errorText(e)));
  }, [teacher]);
  async function rate(remembered: boolean) {
    if (!current || ratingBusy) return;
    setRatingBusy(true);
    eventKey.current ||= crypto.randomUUID();
    try {
      const next = await api<{ items: typeof reviews }>('study/word', {
        method: 'POST',
        body: JSON.stringify({ wordId: current.id, remembered, eventKey: eventKey.current }),
      });
      // Keep this session's deck stable even though a card is no longer due.
      if (!dueOnly) setReviews(next.items);
      if (remembered) setRemembered((v) => v + 1);
      setAttempted((v) => v + 1);
      setIndex((v) => v + 1);
      setRevealed(false);
      eventKey.current = '';
      setError('');
    } catch (e) {
      setError(errorText(e));
    } finally {
      setRatingBusy(false);
    }
  }
  useEffect(() => {
    let active = true;
    setItems(null);
    setError('');
    setPractice(false);
    setShuffled([]);
    api<{ items: VocabularyEntry[] }>(
      `vocabulary?section=${section}&category=${encodeURIComponent(category)}&kind=${kind}`,
    )
      .then((data) => {
        if (active) setItems(data.items);
      })
      .catch((e) => {
        if (active) setError(errorText(e));
      });
    return () => {
      active = false;
    };
  }, [category, kind, section, retryVersion, refreshKey]);
  const filtered = useMemo(
    () =>
      (items || [])
        .filter(
          (item) =>
            !dueOnly ||
            reviews.some(
              (r) =>
                r.item_id === item.id && r.kind === 'word' && r.due_at <= new Date().toISOString(),
            ),
        )
        .filter((item) =>
          `${item.ko} ${item.uz} ${item.example}`.toLowerCase().includes(search.toLowerCase()),
        )
        .sort((a, b) => b.frequency - a.frequency || a.ko.localeCompare(b.ko, 'ko')),
    [items, search, dueOnly, reviews],
  );
  const words = useMemo(
    () =>
      shuffled.length
        ? [...filtered].sort((a, b) => shuffled.indexOf(a.id) - shuffled.indexOf(b.id))
        : filtered,
    [filtered, shuffled],
  );
  function shuffle() {
    const ids = filtered.map((item) => item.id);
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    setShuffled(ids);
    setIndex(0);
    setRevealed(false);
    setRemembered(0);
    setAttempted(0);
  }
  function begin() {
    shuffle();
    setPractice(true);
  }
  const current = words[index];
  const vocabCategories = ['all', ...VOCABULARY_BANDS[section]];
  return (
    <>
      <div className="topik-section-heading">
        <div>
          <h2>{kind === 'idiom' ? 'Ibora ortidagi ma’no' : 'TOPIK uchun faol lug‘at'}</h2>
          <p>
            {kind === 'idiom'
              ? '관용표현 · Iboralarni ma’nosi va qo‘llanishi bilan o‘rganing.'
              : 'Savollarda takrorlangan muhim so‘zlar. Ma’no va qo‘llanish birga.'}
          </p>
        </div>
        {!!words.length && !teacher && (
          <button className="button primary" onClick={begin}>
            <Layers3 size={18} />
            Kartalar bilan mashq
          </button>
        )}
      </div>
      {!teacher && (
        <label className="study-due-filter">
          <input
            type="checkbox"
            checked={dueOnly}
            onChange={(e) => {
              setDueOnly(e.target.checked);
              setPractice(false);
              setIndex(0);
            }}
          />{' '}
          Faqat bugun takrorlanadiganlar
        </label>
      )}
      <div className="topik-word-bands" role="group" aria-label="Lug‘at savol turlari">
        {vocabCategories.map((id) => (
          <button
            key={id}
            aria-pressed={category === id}
            className={category === id ? 'active' : ''}
            onClick={() => setCategory(id)}
          >
            {bandLabel(id)}
          </button>
        ))}
      </div>
      {error && <InlineError message={error} retry={() => setRetryVersion((v) => v + 1)} />}
      {items === null ? (
        !error && <LoadingSection />
      ) : !items.length ? (
        <Empty
          title={
            kind === 'idiom'
              ? 'Bu turda iboralar hali yo‘q'
              : 'Bu tur uchun lug‘at hali tayyor emas'
          }
        >
          Ustoz bu bo‘limga so‘z qo‘shgach, lug‘at shu yerda paydo bo‘ladi. Boshqa diapazonni ham
          tanlab ko‘ring.
        </Empty>
      ) : (
        <>
          <div className="topik-word-toolbar">
            <label className="topik-search">
              <Search size={18} />
              <input
                type="search"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPractice(false);
                }}
                placeholder="So‘z yoki ma’noni qidirish…"
                aria-label="Lug‘atdan qidirish"
              />
            </label>
            <span className="topik-word-count">
              {filtered.length} ta {kind === 'idiom' ? 'ibora' : 'so‘z'}
            </span>
            <div className="topik-view-switch" role="group" aria-label="Ko‘rinish">
              <button
                className={view === 'cards' ? 'active' : ''}
                aria-label="Kartalar"
                aria-pressed={view === 'cards'}
                onClick={() => {
                  setView('cards');
                  setPractice(false);
                }}
              >
                <LayoutGrid size={18} />
              </button>
              <button
                className={view === 'table' ? 'active' : ''}
                aria-label="Jadval"
                aria-pressed={view === 'table'}
                onClick={() => {
                  setView('table');
                  setPractice(false);
                }}
              >
                <List size={19} />
              </button>
            </div>
            <button
              className="button secondary topik-shuffle-button"
              onClick={shuffle}
              disabled={!filtered.length}
            >
              <Shuffle size={17} />
              Aralashtirish
            </button>
          </div>
          {!words.length ? (
            <Empty title="Mos so‘z topilmadi">Boshqa so‘z bilan qidirib ko‘ring.</Empty>
          ) : practice ? (
            <section className="topik-flashcard-wrap">
              <div className="topik-flashcard-meta">
                <span>
                  {Math.min(index + 1, words.length)} / {words.length} karta
                </span>
                <button className="text-button" onClick={() => setPractice(false)}>
                  <X size={16} />
                  Mashqdan chiqish
                </button>
              </div>
              {current ? (
                <>
                  <article className={`topik-flashcard ${revealed ? 'revealed' : ''}`}>
                    <div className="topik-flashcard-top">
                      <Badge tone="neutral">{current.pos}</Badge>
                      <span>
                        {current.frequency
                          ? `Manbada: ${current.frequency} marta`
                          : current.origin === 'teacher'
                            ? 'Ustoz qo‘shgan so‘z'
                            : 'Asosiy lug‘at'}
                      </span>
                    </div>
                    <h3 lang="ko">{current.ko}</h3>
                    <p lang="ko" className="topik-flashcard-example">
                      {current.example}
                    </p>
                    {revealed ? (
                      <div className="topik-flashcard-answer" aria-live="polite">
                        <strong>{current.uz}</strong>
                        <p>{current.translation}</p>
                      </div>
                    ) : (
                      <button className="button secondary" onClick={() => setRevealed(true)}>
                        Ma’nosini ochish
                        <ArrowRight size={17} />
                      </button>
                    )}
                  </article>
                  {revealed && (
                    <div className="topik-flashcard-actions">
                      <button
                        className="button secondary"
                        disabled={ratingBusy}
                        onClick={() => rate(false)}
                      >
                        <RotateCcw size={17} />
                        Yana o‘rganaman
                      </button>
                      <button
                        className="button primary"
                        disabled={ratingBusy}
                        onClick={() => rate(true)}
                      >
                        <Check size={17} />
                        Esladim
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="topik-flashcard-finish">
                  <CheckCircle2 size={40} />
                  <h3>Kartalar yakunlandi</h3>
                  <p>
                    {remembered} / {attempted} ta {kind === 'idiom' ? 'ibora' : 'so‘z'}ni
                    esladingiz.
                  </p>
                  <button className="button primary" onClick={begin}>
                    <Shuffle size={17} />
                    Qayta aralashtirish
                  </button>
                </div>
              )}
            </section>
          ) : view === 'cards' ? (
            <div className="topik-word-grid">
              {words.map((word) => (
                <article className="panel topik-word-card" key={word.id}>
                  <div className="topik-word-card-meta">
                    <span>
                      #{filtered.findIndex((item) => item.id === word.id) + 1} · {word.pos}
                    </span>
                    <span title="Tanlangan turdagi TOPIK matnlarida qayd etilgan uchrashlar">
                      {word.frequency
                        ? `Manbada: ${word.frequency} marta`
                        : word.origin === 'teacher'
                          ? 'Ustoz qo‘shgan'
                          : 'Asosiy lug‘at'}
                    </span>
                  </div>
                  <h3 lang="ko">{word.ko}</h3>
                  <strong className="topik-word-meaning">{word.uz}</strong>
                  <div className="topik-word-example">
                    <p lang="ko">{word.example}</p>
                    <p>{word.translation}</p>
                  </div>
                  <div className="topik-word-tags">
                    {word.categories.map((c) => (
                      <span key={c}>
                        {sectionLabel(word.section)} · {bandLabel(c)}
                      </span>
                    ))}
                  </div>
                  {!teacher && (
                    <button
                      className="vocab-edit-button"
                      onClick={() => onNote(word)}
                      aria-label={`${word.ko} — daftarimga`}
                    >
                      <NotebookPen size={15} /> Daftarimga qayd
                    </button>
                  )}
                  {teacher && (
                    <button
                      className="vocab-edit-button"
                      onClick={() => onEdit(word)}
                      aria-label={`${word.ko} — tahrirlash`}
                    >
                      <Pencil size={15} /> Tahrirlash {word.edited && <span>· Yangilangan</span>}
                    </button>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <div className="panel topik-table-scroll">
              <table className="topik-word-table">
                <thead>
                  <tr>
                    <th scope="col">So‘z / ibora</th>
                    <th scope="col">Ma’nosi</th>
                    <th scope="col">Gapda qo‘llanishi</th>
                    <th scope="col">Uchrashi</th>
                  </tr>
                </thead>
                <tbody>
                  {words.map((word) => (
                    <tr key={word.id}>
                      <th scope="row">
                        <strong lang="ko">{word.ko}</strong>
                        <small>
                          #{filtered.findIndex((item) => item.id === word.id) + 1} · {word.pos}
                        </small>
                      </th>
                      <td>{word.uz}</td>
                      <td>
                        <p lang="ko">{word.example}</p>
                        <small>{word.translation}</small>
                      </td>
                      <td>
                        <b>{word.frequency}</b>
                        <small>{word.frequency ? 'marta' : 'Ustoz lug‘ati'}</small>
                        {teacher && (
                          <button
                            className="vocab-edit-button"
                            onClick={() => onEdit(word)}
                            aria-label={`${word.ko} — tahrirlash`}
                          >
                            <Pencil size={15} /> Tahrirlash
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </>
  );
}
