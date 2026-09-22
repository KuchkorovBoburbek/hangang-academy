'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileText,
  Flag,
  GraduationCap,
  Layers3,
  LayoutGrid,
  List,
  LoaderCircle,
  RotateCcw,
  Search,
  Shuffle,
  Sparkles,
  X,
} from 'lucide-react';
import type {
  TopikBookmark,
  TopikCatalog,
  TopikHistoryItem,
  TopikSession,
  TopikVocabulary,
} from '@/lib/topik-types';
import { TOPIK_CATEGORIES } from '@/lib/topik-types';
import { api, Badge, Empty, Modal, errorText, dateLabel } from './ui';
import { useReadingTime } from './use-reading-time';
import { WordContext, ContextWordModal } from './context-words';
import TopikPaper, { plainPaperText } from './topik-paper';
import '@/app/topik.css';

type Tab = 'practice' | 'mock' | 'saved';
type StartOptions = {
  mode: 'practice' | 'mock' | 'review';
  category?: string;
  count?: number;
  formId?: string;
  questionIds?: string[];
  dueOnly?: boolean;
};
const TABS = [
  { id: 'practice', title: 'Mashq', icon: BookOpen },
  { id: 'mock', title: 'Mock imtihon', icon: FileText },
  { id: 'saved', title: 'Saqlangan xatolar', icon: Bookmark },
] as const;

function modeTitle(item: Pick<TopikHistoryItem, 'mode' | 'category' | 'formId'>) {
  if (item.mode === 'mock')
    return `한강 TOPIK · ${item.formId?.match(/\d+/g)?.at(-1) || ''}-imtihon`;
  if (item.mode === 'review') return 'Saqlangan savollarni takrorlash';
  return item.category === 'all' ? '읽기 · Aralash mashq' : `읽기 ${item.category} · Mashq`;
}
function LoadingSection() {
  return (
    <div className="topik-loading" role="status">
      <LoaderCircle className="spin" size={25} />
      <span>Ma’lumotlar yuklanmoqda…</span>
    </div>
  );
}
function InlineError({ message, retry }: { message: string; retry?: () => void }) {
  return (
    <div className="alert error topik-error" role="alert">
      <span>{message}</span>
      {retry && (
        <button type="button" onClick={retry}>
          Qayta urinish
        </button>
      )}
    </div>
  );
}

export default function Topik({
  initialTab,
  notify,
}: {
  initialTab?: string;
  notify: (message: string) => void;
}) {
  const [tab, setTab] = useState<Tab>(
    TABS.some((t) => t.id === initialTab) ? (initialTab as Tab) : 'practice',
  );
  const [catalog, setCatalog] = useState<TopikCatalog | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [session, setSession] = useState<TopikSession | null>(null);
  const [category, setCategory] = useState('1-2');
  useEffect(() => {
    const selected = new URLSearchParams(window.location.search).get('category');
    if (selected && TOPIK_CATEGORIES.some((c) => c.id === selected)) setCategory(selected);
  }, []);
  const [count, setCount] = useState(10);
  const load = useCallback(async () => {
    try {
      const next = await api<TopikCatalog>('topik/catalog');
      setCatalog(next);
      setError('');
    } catch (e) {
      setError(errorText(e));
    }
  }, []);
  useEffect(() => {
    void load();
    const parts = window.location.pathname.split('/');
    if (parts[2] === 'session' && parts[3]) void resume(decodeURIComponent(parts[3]));
  }, [load]);
  useEffect(() => {
    setTab(TABS.some((t) => t.id === initialTab) ? (initialTab as Tab) : 'practice');
  }, [initialTab]);
  async function start(options: StartOptions) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      setSession(
        await api<TopikSession>('topik/start', { method: 'POST', body: JSON.stringify(options) }),
      );
      window.scrollTo({ top: 0, behavior: 'instant' });
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function resume(id: string) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      setSession(await api<TopikSession>(`topik/sessions/${encodeURIComponent(id)}`));
      window.scrollTo({ top: 0, behavior: 'instant' });
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  function leave() {
    setSession(null);
    void load();
  }
  if (session)
    return <ReadingSession key={session.id} initial={session} onExit={leave} notify={notify} />;
  const selected = catalog?.categories.find((c) => c.id === category);
  const available = category === 'all' ? catalog?.total || 0 : selected?.available || 0;
  return (
    <div className="topik-hub">
      <div className="page-heading">
        <div>
          <span className="eyebrow">한강 TOPIK · O‘QISH MAHORATI</span>
          <h1>
            TOPIK II <span lang="ko">읽기</span>
          </h1>
          <p>Kerakli savolni mashq qiling. O‘z sur’atingizni toping.</p>
        </div>
        <span className="topik-heading-badge">
          <GraduationCap size={20} /> O‘qish bo‘limi
        </span>
      </div>
      <div className="topik-tabs" role="tablist" aria-label="TOPIK bo‘limlari">
        {TABS.map((item) => (
          <button
            type="button"
            role="tab"
            id={`topik-tab-${item.id}`}
            aria-selected={tab === item.id}
            aria-controls={`topik-panel-${item.id}`}
            tabIndex={tab === item.id ? 0 : -1}
            className={tab === item.id ? 'active' : ''}
            key={item.id}
            onClick={() => setTab(item.id)}
            onKeyDown={(event) => {
              if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
              event.preventDefault();
              const i = TABS.findIndex((t) => t.id === item.id);
              const next =
                event.key === 'Home'
                  ? 0
                  : event.key === 'End'
                    ? TABS.length - 1
                    : (i + (event.key === 'ArrowRight' ? 1 : -1) + TABS.length) % TABS.length;
              setTab(TABS[next].id);
              document.getElementById(`topik-tab-${TABS[next].id}`)?.focus();
            }}
          >
            <item.icon size={18} />
            <span>{item.title}</span>
            {item.id === 'saved' && !!catalog?.savedCount && <b>{catalog.savedCount}</b>}
          </button>
        ))}
      </div>
      {error && <InlineError message={error} retry={load} />}
      {!catalog ? (
        !error && <LoadingSection />
      ) : (
        <div role="tabpanel" id={`topik-panel-${tab}`} aria-labelledby={`topik-tab-${tab}`}>
          {tab === 'practice' && (
            <>
              <section className="panel study-review-banner">
                <div>
                  <h2>Bugungi takrorlash</h2>
                  <p>
                    {catalog.dueQuestions} ta savol · {catalog.dueWords} ta so‘z va ibora. Xato va
                    ikkilangan javoblar avtomatik rejalashtiriladi.
                  </p>
                </div>
                <button
                  className="button primary"
                  disabled={busy || !catalog.dueQuestions}
                  onClick={() => start({ mode: 'review', dueOnly: true, count: 10 })}
                >
                  Savollarni takrorlash
                </button>
                <a className="button secondary" href="/vocabulary/reading">
                  Lug‘atni takrorlash
                </a>
              </section>
              <section className="topik-intro">
                <div>
                  <span className="topik-mini-label">BITTA TUR. ANIQ MAQSAD.</span>
                  <h2>
                    Bugun nimani
                    <br />
                    mustahkamlaymiz?
                  </h2>
                  <p>
                    Haqiqiy TOPIK savollari va qo‘shimcha grammatika mashqlaridan tasodifiy to‘plam.
                    Javobni tekshiring, keyin xohlasangiz qisqa yechimni oching.
                  </p>
                </div>
                <div className="topik-intro-stats">
                  <div>
                    <strong>{catalog.total}</strong>
                    <span>mashq uchun savol</span>
                  </div>
                  <div>
                    <strong>{catalog.categories.filter((c) => c.available > 0).length}</strong>
                    <span>savol turi</span>
                  </div>
                  <BookOpen
                    className="topik-intro-art"
                    size={90}
                    strokeWidth={1}
                    aria-hidden="true"
                  />
                </div>
              </section>
              {!!catalog.activeSessions.length && (
                <section className="topik-resume-list" aria-label="Davom ettiriladigan mashqlar">
                  {catalog.activeSessions.map((item) => (
                    <button
                      className="topik-resume"
                      key={item.id}
                      disabled={busy}
                      onClick={() => resume(item.id)}
                    >
                      <span className="square-icon pale-blue">
                        <RotateCcw size={21} />
                      </span>
                      <span>
                        <strong>{modeTitle(item)}</strong>
                        <small>
                          {item.actualCount} ta savol · {dateLabel(item.startedAt)}
                          {item.deadline ? ' · Imtihon vaqti davom etmoqda' : ' · Boshlangan mashq'}
                        </small>
                      </span>
                      <span className="topik-resume-action">
                        Davom etish <ArrowRight size={17} />
                      </span>
                    </button>
                  ))}
                </section>
              )}
              <div className="topik-practice-layout">
                <section className="panel topik-categories-panel">
                  <div className="topik-section-heading">
                    <div>
                      <h2>1. Savol turini tanlang</h2>
                      <p>Raqamlar TOPIK qog‘ozidagi savol tartibiga mos.</p>
                    </div>
                    <span className="topik-step">01</span>
                  </div>
                  <div className="topik-categories" role="group" aria-label="Savol turlari">
                    <button
                      className={`topik-category all ${category === 'all' ? 'selected' : ''}`}
                      aria-pressed={category === 'all'}
                      onClick={() => setCategory('all')}
                    >
                      <Shuffle size={19} />
                      <span>
                        <strong>Barchasi</strong>
                        <small>Aralash savollar</small>
                      </span>
                      <b>{catalog.total}</b>
                    </button>
                    {catalog.categories.map((item) => (
                      <button
                        className={`topik-category ${category === item.id ? 'selected' : ''}`}
                        aria-pressed={category === item.id}
                        key={item.id}
                        onClick={() => setCategory(item.id)}
                      >
                        <span className="topik-category-range">{item.id.replace('-', '–')}</span>
                        <span>
                          <strong lang="ko">{item.label}</strong>
                          <small>
                            {item.available
                              ? `${item.available} ta savol`
                              : 'Savollar hozircha yo‘q'}
                          </small>
                        </span>
                        {category === item.id && <CheckCircle2 size={18} />}
                      </button>
                    ))}
                  </div>
                </section>
                <aside className="panel topik-start-panel">
                  <div className="topik-section-heading">
                    <div>
                      <h2>2. Mashq hajmi</h2>
                      <p>Bugungi vaqtingizga moslang.</p>
                    </div>
                    <span className="topik-step">02</span>
                  </div>
                  <div className="topik-count-picker" role="group" aria-label="Savollar soni">
                    {[10, 15].map((n) => (
                      <button
                        key={n}
                        className={count === n ? 'selected' : ''}
                        onClick={() => setCount(n)}
                        aria-pressed={count === n}
                      >
                        <strong>{n}</strong>
                        <span>ta savol</span>
                      </button>
                    ))}
                  </div>
                  <div className="topik-start-summary">
                    <span>Tanlangan tur</span>
                    <strong>
                      {category === 'all'
                        ? 'Barcha savollar'
                        : `읽기 ${category.replace('-', '–')}`}
                    </strong>
                    <span>Bazada mavjud</span>
                    <strong>{available} ta savol</strong>
                  </div>
                  <p className="topik-helper">
                    Bitta matnga bog‘langan savollar birga keladi. Aniq savollar soni mashq
                    boshlanganda ko‘rsatiladi.
                  </p>
                  <button
                    className="button primary"
                    disabled={busy || !available}
                    onClick={() => start({ mode: 'practice', category, count })}
                  >
                    {busy ? <LoaderCircle className="spin" size={18} /> : <Shuffle size={18} />}
                    Mashqni boshlash
                    <ArrowRight size={18} />
                  </button>
                  <div className="topik-start-foot">
                    <Check size={14} />
                    Javoblaringiz avtomatik saqlanadi
                  </div>
                </aside>
              </div>
              {!!catalog.history.length && (
                <History items={catalog.history} busy={busy} onOpen={resume} />
              )}
            </>
          )}
          {tab === 'mock' && (
            <MockCatalog catalog={catalog} busy={busy} start={start} resume={resume} />
          )}
          {tab === 'saved' && (
            <SavedQuestions start={start} busy={busy} onChanged={load} notify={notify} />
          )}
        </div>
      )}
    </div>
  );
}

function MockCatalog({
  catalog,
  busy,
  start,
  resume,
}: {
  catalog: TopikCatalog;
  busy: boolean;
  start: (options: StartOptions) => void;
  resume: (id: string) => void;
}) {
  const active = catalog.activeSessions.filter((s) => s.mode === 'mock');
  return (
    <>
      <section className="topik-mock-intro">
        <div>
          <span className="topik-mini-label">한강 모의고사</span>
          <h2>Imtihon ritmini his qiling.</h2>
          <p>
            Haqiqiy TOPIK imtihonlaridan aralashtirilgan savollar. Matnlar o‘z savollari bilan birga
            qoladi. Ayrim savollar turli mocklarda takrorlanishi mumkin.
          </p>
          <div className="topik-mock-facts">
            <span>
              <FileText size={17} />
              {catalog.mock.questionCount} ta savol
            </span>
            <span>
              <Clock3 size={17} />
              {catalog.mock.minutes} daqiqa
            </span>
            <span>
              <CheckCircle2 size={17} />
              {catalog.mock.questionCount * 2} ball
            </span>
          </div>
        </div>
        <span className="topik-mock-symbol" aria-hidden="true">
          읽기<small>한강 TOPIK II</small>
        </span>
      </section>
      {catalog.mock.skippedNumbers?.length > 0 && (
        <div className="topik-session-notice">
          {catalog.mock.skippedNumbers.join('–')}-savollarning matni manba PDFda berilmagan. Bu
          savollarni tashlab o‘ting. Ular baholanmaydi; qolgan savollar asl 1–50 raqamlari bilan
          beriladi.
        </div>
      )}
      {active.map((item) => (
        <button
          className="topik-resume"
          key={item.id}
          disabled={busy}
          onClick={() => resume(item.id)}
        >
          <Clock3 size={24} />
          <span>
            <strong>{modeTitle(item)}</strong>
            <small>Boshlangan imtihon · Vaqt davom etmoqda</small>
          </span>
          <span className="topik-resume-action">
            Davom etish <ArrowRight size={17} />
          </span>
        </button>
      ))}
      <div className="topik-section-heading topik-space">
        <div>
          <h2>Mock imtihonlar</h2>
          <p>
            {catalog.mock.readyForms} / {catalog.mock.requestedForms} ta imtihon topshirishga
            tayyor.
          </p>
        </div>
        <Badge tone="neutral">읽기</Badge>
      </div>
      {!catalog.mock.readyForms && (
        <div className="topik-info-box">
          <BookOpen size={21} />
          <div>
            <strong>To‘liq imtihon uchun savollar yig‘ilmoqda.</strong>
            <p>
              Kerakli savol turlari mavjud bo‘lgach, imtihon ochiladi. Hozir “Mashq” bo‘limidagi
              mavjud savollarni yechishingiz mumkin.
            </p>
          </div>
        </div>
      )}
      <div className="topik-mock-grid">
        {catalog.mock.forms.map((form) => {
          const current = active.find((s) => s.formId === form.id);
          const past = catalog.history.filter((s) => s.formId === form.id);
          return (
            <article className={`topik-mock-card ${form.ready ? '' : 'unavailable'}`} key={form.id}>
              <div className="topik-mock-card-top">
                <span className="topik-form-number">{String(form.number).padStart(2, '0')}</span>
                <Badge tone={form.ready ? 'green' : 'neutral'}>
                  {form.ready ? 'Tayyor' : 'Tayyorlanmoqda'}
                </Badge>
              </div>
              <span lang="ko" className="topik-mock-card-korean">
                한강 TOPIK
              </span>
              <h3>제 {form.number}회</h3>
              <p>
                {form.ready
                  ? `${form.questionCount} ta savol · ${catalog.mock.minutes} daqiqa`
                  : 'Savollar to‘plami kutilmoqda'}
              </p>
              {past.length > 0 && (
                <small className="topik-past-result">
                  Oxirgi natija: {past[0].score} / {past[0].actualCount}
                </small>
              )}
              <button
                className={`button ${form.ready ? 'secondary' : 'topik-muted-button'}`}
                disabled={busy || !form.ready}
                onClick={() =>
                  current ? resume(current.id) : start({ mode: 'mock', formId: form.id })
                }
              >
                {current
                  ? 'Davom etish'
                  : past.length
                    ? 'Qayta topshirish'
                    : form.ready
                      ? 'Imtihonni boshlash'
                      : 'Hozircha mavjud emas'}
                {form.ready && <ArrowRight size={17} />}
              </button>
            </article>
          );
        })}
      </div>
      {catalog.mock.shortages.length > 0 && (
        <details className="topik-availability">
          <summary>Imtihonlar tayyorligi haqida</summary>
          <p>Imtihonni tuzish uchun quyidagi turlarda qo‘shimcha haqiqiy savollar kerak:</p>
          <div>
            {catalog.mock.shortages.map((s) => (
              <span key={s.category}>
                읽기 {s.category}: yana {s.missing} ta
              </span>
            ))}
          </div>
        </details>
      )}
    </>
  );
}

function History({
  items,
  busy,
  onOpen,
}: {
  items: TopikHistoryItem[];
  busy: boolean;
  onOpen: (id: string) => void;
}) {
  return (
    <section className="topik-history">
      <div className="topik-section-heading">
        <div>
          <h2>Oxirgi natijalar</h2>
          <p>Mashqni ochib, javoblaringizni qayta ko‘ring.</p>
        </div>
      </div>
      <div className="panel">
        {items.slice(0, 8).map((item) => (
          <button
            key={item.id}
            onClick={() => onOpen(item.id)}
            disabled={busy}
            className="topik-history-row"
          >
            <span className="square-icon pale-blue">
              {item.mode === 'mock' ? <FileText size={21} /> : <BookOpen size={21} />}
            </span>
            <span>
              <strong>{modeTitle(item)}</strong>
              <small>{dateLabel(item.completedAt || item.startedAt)}</small>
            </span>
            <Badge tone={(item.percent || 0) >= 80 ? 'green' : 'orange'}>
              {item.score} / {item.actualCount}
            </Badge>
            <ChevronRight size={18} />
          </button>
        ))}
      </div>
    </section>
  );
}

function SavedQuestions({
  start,
  busy,
  onChanged,
  notify,
}: {
  start: (options: StartOptions) => void;
  busy: boolean;
  onChanged: () => void;
  notify: (text: string) => void;
}) {
  const [items, setItems] = useState<TopikBookmark[] | null>(null);
  const [error, setError] = useState('');
  const [removing, setRemoving] = useState<string | null>(null);
  const [filter, setFilter] = useState('all');
  const load = useCallback(async () => {
    try {
      const data = await api<{ items: TopikBookmark[] }>('topik/bookmarks');
      setItems(data.items);
      setError('');
    } catch (e) {
      setError(errorText(e));
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  async function remove(questionId: string) {
    setRemoving(questionId);
    try {
      await api('topik/bookmarks', {
        method: 'POST',
        body: JSON.stringify({ questionId, saved: false }),
      });
      setItems((prev) => prev?.filter((item) => item.questionId !== questionId) || []);
      onChanged();
      notify('Savol saqlanganlar ro‘yxatidan olindi.');
    } catch (e) {
      setError(errorText(e));
    } finally {
      setRemoving(null);
    }
  }
  const visible = items?.filter((item) => filter === 'all' || item.group.category === filter) || [];
  return (
    <>
      <div className="topik-section-heading">
        <div>
          <h2>Xatodan keyingi qadam</h2>
          <p>Saqlagan savollaringizga qayting va yana bir bor urinib ko‘ring.</p>
        </div>
        {!!visible.length && (
          <button
            className="button primary"
            disabled={busy}
            onClick={() => start({ mode: 'review', category: filter, count: 15 })}
          >
            <RotateCcw size={18} />
            Aralashtirib takrorlash
          </button>
        )}
      </div>
      {error && <InlineError message={error} retry={load} />}
      {items === null ? (
        !error && <LoadingSection />
      ) : !items.length ? (
        <Empty title="Saqlangan savollar hali yo‘q">
          Mashq natijasida xato qilgan savolingiz yonidagi “Xatoni saqlash” tugmasini bosing. Keyin
          shu yerda qayta yechishingiz mumkin.
        </Empty>
      ) : (
        <>
          <label className="topik-filter-label">
            Savol turi
            <select value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="all">Barcha turlar ({items.length})</option>
              {TOPIK_CATEGORIES.filter((c) => items.some((i) => i.group.category === c.id)).map(
                (c) => (
                  <option key={c.id} value={c.id}>
                    읽기 {c.id}
                  </option>
                ),
              )}
            </select>
          </label>
          <div className="topik-saved-grid">
            {visible.map((item) => {
              const question = item.group.questions.find((q) => q.id === item.questionId);
              return (
                <article className="panel topik-saved-card" key={item.questionId}>
                  <div className="topik-saved-meta">
                    <Badge>읽기 {item.group.category}</Badge>
                    <button
                      className="icon-button"
                      aria-label="Saqlanganlardan olib tashlash"
                      disabled={removing === item.questionId}
                      onClick={() => remove(item.questionId)}
                    >
                      {removing === item.questionId ? (
                        <LoaderCircle size={17} className="spin" />
                      ) : (
                        <Bookmark size={18} fill="currentColor" />
                      )}
                    </button>
                  </div>
                  <h3 lang="ko">{plainPaperText(question?.prompt || item.group.instruction)}</h3>
                  <p lang="ko" className="topik-saved-excerpt">
                    {plainPaperText(
                      item.group.passage ||
                        item.group.blocks.find((b) => b.text)?.text ||
                        question?.options.join(' · ') ||
                        '',
                    )}
                  </p>
                  <div className="topik-saved-footer">
                    <small>{dateLabel(item.savedAt)} saqlangan</small>
                    <button
                      className="text-button"
                      disabled={busy}
                      onClick={() => start({ mode: 'review', questionIds: [item.questionId] })}
                    >
                      Qayta yechish
                      <ArrowRight size={16} />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}

export function ReadingSession({
  initial,
  onExit,
  notify,
}: {
  initial: TopikSession;
  onExit: () => void;
  notify: (text: string) => void;
}) {
  const [session, setSession] = useState(initial);
  const [fontSize, setFontSize] = useState(18);
  const [focus, setFocus] = useState(false);
  useEffect(() => {
    try {
      const size = Number(localStorage.getItem('topik-font-size'));
      if ([18, 21, 24].includes(size)) setFontSize(size);
    } catch {}
  }, []);
  useEffect(() => {
    document.body.classList.toggle('reading-focus', focus);
    return () => document.body.classList.remove('reading-focus');
  }, [focus]);
  const [contextWords, setContextWords] = useState<TopikVocabulary[]>([]);
  const [contextWord, setContextWord] = useState<{
    word: TopikVocabulary;
    surface: string;
    text: string;
  } | null>(null);
  useEffect(() => {
    if (session.status !== 'completed') return;
    Promise.all([
      api<{ items: TopikVocabulary[] }>('topik/vocabulary'),
      api<{ items: TopikVocabulary[] }>('topik/vocabulary?kind=idiom'),
    ])
      .then((r) => setContextWords(r.flatMap((d) => d.items)))
      .catch(() => {});
  }, [session.status]);
  const [activeId, setActiveId] = useState(
    () =>
      initial.groups.flatMap((g) => g.questions).find((q) => initial.choices[q.id] === undefined)
        ?.id ||
      initial.groups[0]?.questions[0]?.id ||
      '',
  );
  const [marked, setMarked] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(sessionStorage.getItem(`topik-marked-${initial.id}`) || '[]'));
    } catch {
      return new Set();
    }
  });
  useEffect(() => {
    const target = decodeURIComponent(window.location.hash).replace(/^#topik-q-/, '');
    if (!initial.groups.some((g) => g.questions.some((q) => q.id === target))) return;
    setActiveId(target);
    const timer = setTimeout(
      () => document.getElementById(`topik-q-${target}`)?.scrollIntoView({ block: 'center' }),
      100,
    );
    return () => clearTimeout(timer);
  }, [initial.id]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [bookmarkBusy, setBookmarkBusy] = useState<string | null>(null);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [resultFilter, setResultFilter] = useState<'all' | 'wrong'>('all');
  const [skippedActive, setSkippedActive] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [clockOffset, setClockOffset] = useState(
    () => new Date(initial.serverNow).getTime() - Date.now(),
  );
  const lastAutoAttempt = useRef(0);
  const questions = useMemo(() => session.groups.flatMap((g) => g.questions), [session.groups]);
  const currentIndex = Math.max(
    0,
    questions.findIndex((q) => q.id === activeId),
  );
  const currentGroup =
    session.groups.find((g) => g.questions.some((q) => q.id === activeId)) || session.groups[0];
  const skippedNumbers = session.skippedNumbers || [];
  const navigationNumbers = [...questions.map((q) => q.displayNumber), ...skippedNumbers].sort(
    (a, b) => a - b,
  );
  const activeNumber = skippedActive ?? questions[currentIndex]?.displayNumber;
  const navigationIndex = navigationNumbers.indexOf(activeNumber);
  const complete = session.status === 'completed';
  const flushTime = useReadingTime(
    session.id,
    activeId,
    !complete && skippedActive === null && !confirmFinish,
  );
  const remaining = session.deadline
    ? Math.max(0, Math.ceil((new Date(session.deadline).getTime() - now - clockOffset) / 1000))
    : null;
  const unanswered = session.actualCount - session.answeredCount;
  useEffect(() => {
    if (complete) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [complete]);
  function accept(next: TopikSession) {
    setClockOffset(new Date(next.serverNow).getTime() - Date.now());
    setNow(Date.now());
    setSession(next);
  }
  async function checkQuestion(questionId: string) {
    if (busy || complete) return;
    setBusy(true);
    setError('');
    try {
      accept(
        await api<TopikSession>('topik/check', {
          method: 'POST',
          body: JSON.stringify({ sessionId: session.id, questionId }),
        }),
      );
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function answer(questionId: string, choice: number) {
    if (busy || complete || remaining === 0 || session.checked[questionId]) return;
    const previous = session;
    setSession({
      ...session,
      choices: { ...session.choices, [questionId]: choice },
      answeredCount: session.answeredCount + (session.choices[questionId] === undefined ? 1 : 0),
    });
    setBusy(true);
    setError('');
    try {
      accept(
        await api<TopikSession>('topik/answer', {
          method: 'POST',
          body: JSON.stringify({ sessionId: session.id, questionId, choice }),
        }),
      );
    } catch (e) {
      setSession(previous);
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  const finish = useCallback(async () => {
    if (busy || complete) return;
    setConfirmFinish(false);
    setBusy(true);
    setError('');
    try {
      await flushTime();
      const next = await api<TopikSession>('topik/finish', {
        method: 'POST',
        body: JSON.stringify({ sessionId: session.id }),
      });
      setSession(next);
      window.scrollTo({ top: 0, behavior: 'instant' });
      try {
        sessionStorage.removeItem(`topik-marked-${session.id}`);
      } catch {
        /* Browser storage is optional. */
      }
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }, [busy, complete, session.id, flushTime]);
  useEffect(() => {
    if (!complete && remaining === 0 && !busy && Date.now() - lastAutoAttempt.current > 5000) {
      lastAutoAttempt.current = Date.now();
      void finish();
    }
  }, [remaining, complete, busy, finish, now]);
  function requestFinish() {
    if (unanswered > 0) setConfirmFinish(true);
    else void finish();
  }
  async function save(questionId: string, saved: boolean) {
    if (bookmarkBusy) return;
    setBookmarkBusy(questionId);
    try {
      await api('topik/bookmarks', { method: 'POST', body: JSON.stringify({ questionId, saved }) });
      setSession((prev) => ({
        ...prev,
        results: prev.results?.map((r) => (r.questionId === questionId ? { ...r, saved } : r)),
      }));
      notify(
        saved
          ? 'Savol saqlandi. Keyin qayta yechishingiz mumkin.'
          : 'Savol saqlanganlardan olindi.',
      );
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBookmarkBusy(null);
    }
  }
  function select(questionId: string) {
    setSkippedActive(null);
    const nextGroup = session.groups.find((group) =>
      group.questions.some((q) => q.id === questionId),
    );
    const showPassage = nextGroup?.id !== currentGroup?.id || nextGroup?.questions.length === 1;
    setActiveId(questionId);
    requestAnimationFrame(() =>
      document
        .getElementById(showPassage ? `topik-group-${nextGroup?.id}` : `topik-q-${questionId}`)
        ?.scrollIntoView({ behavior: 'smooth', block: showPassage ? 'start' : 'center' }),
    );
  }
  function selectNumber(number: number) {
    const question = questions.find((q) => q.displayNumber === number);
    if (question) select(question.id);
    else if (skippedNumbers.includes(number)) setSkippedActive(number);
  }
  async function toggleUncertain() {
    if (busy || complete) return;
    setBusy(true);
    try {
      accept(
        await api<TopikSession>('topik/uncertain', {
          method: 'POST',
          body: JSON.stringify({
            sessionId: session.id,
            questionId: activeId,
            value: !session.uncertain[activeId],
          }),
        }),
      );
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  function toggleMarked() {
    const next = new Set(marked);
    if (next.has(activeId)) next.delete(activeId);
    else next.add(activeId);
    setMarked(next);
    try {
      sessionStorage.setItem(`topik-marked-${session.id}`, JSON.stringify([...next]));
    } catch {
      /* The marker still works for this visit. */
    }
  }
  const resultGroups = session.groups.filter(
    (g) =>
      resultFilter === 'all' ||
      g.questions.some((q) => session.results?.some((r) => r.questionId === q.id && !r.correct)),
  );
  return (
    <div
      className={`topik-session ${focus ? 'focus-mode' : ''}`}
      style={{ '--reading-font-size': `${fontSize}px` } as React.CSSProperties}
    >
      <div className="topik-session-top">
        <button
          className="text-button"
          onClick={async () => {
            await flushTime();
            onExit();
          }}
          disabled={busy}
        >
          <ArrowLeft size={18} />
          {complete ? 'TOPIK bo‘limiga' : 'Saqlab chiqish'}
        </button>
        <span>{modeTitle(session)}</span>
      </div>
      <div className="reading-controls" aria-label="O‘qish sozlamalari">
        <label>
          Matn o‘lchami
          <select
            value={fontSize}
            onChange={(e) => {
              const size = Number(e.target.value);
              setFontSize(size);
              try {
                localStorage.setItem('topik-font-size', String(size));
              } catch {}
            }}
          >
            <option value={18}>Oddiy</option>
            <option value={21}>Katta</option>
            <option value={24}>Juda katta</option>
          </select>
        </label>
        <button className="button secondary" aria-pressed={focus} onClick={() => setFocus(!focus)}>
          {focus ? 'Oddiy ko‘rinish' : 'Diqqat rejimi'}
        </button>
        {!complete && (
          <button
            className="button secondary"
            onClick={() =>
              document
                .getElementById(`topik-group-${currentGroup?.id}`)
                ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }
          >
            Matnga qaytish ↑
          </button>
        )}
        {focus && !complete && (
          <button className="button primary" disabled={busy} onClick={requestFinish}>
            Mashqni yakunlash
          </button>
        )}
      </div>
      {error && <InlineError message={error} />}
      {complete ? (
        <>
          <section className="topik-result-hero">
            <div className="topik-result-emblem">
              <CheckCircle2 size={38} />
            </div>
            <div>
              <span className="topik-mini-label">MASHQ YAKUNLANDI</span>
              <h1>
                {session.score}
                <span> / {session.actualCount}</span>
              </h1>
              <p>
                {session.timedOut
                  ? 'Imtihon vaqti tugadi. Belgilangan javoblaringiz tekshirildi.'
                  : 'Natija saqlandi. Endi javoblaringizni birga ko‘rib chiqamiz.'}
              </p>
            </div>
            <div className="topik-result-breakdown">
              <div>
                <span>To‘g‘ri</span>
                <strong className="green">{session.score}</strong>
              </div>
              <div>
                <span>Xato / javobsiz</span>
                <strong className="orange">{session.actualCount - (session.score || 0)}</strong>
              </div>
              <div>
                <span>{session.mode === 'mock' ? 'O‘qish bali' : 'Aniqlik'}</span>
                <strong>
                  {session.mode === 'mock'
                    ? `${(session.score || 0) * 2} / ${session.actualCount * 2}`
                    : `${session.percent || 0}%`}
                </strong>
              </div>
            </div>
          </section>
          {skippedNumbers.length > 0 && (
            <div className="topik-session-notice">{session.notice}</div>
          )}
          {session.analytics && (
            <section className="panel mock-analytics">
              <h2>Keyingi mashq uchun yo‘l-yo‘riq</h2>
              <p>
                Faol o‘qish vaqti: {Math.floor(session.analytics.seconds / 60)} daqiqa{' '}
                {session.analytics.seconds % 60} soniya. Yashirilgan oynadagi vaqt hisoblanmaydi.
              </p>
              <div className="study-review-banner">
                {(
                  [
                    ['Birinchi marta berilgan', session.analytics.first],
                    ['Oldin berilgan', session.analytics.seen],
                  ] as const
                ).map(([label, value]) => (
                  <div key={label}>
                    <strong>{label}</strong>
                    <p>
                      {value.total
                        ? `${value.correct} / ${value.total} · ${Math.round((value.correct / value.total) * 100)}%`
                        : 'Hozircha savol yo‘q'}
                    </p>
                  </div>
                ))}
                {!!session.analytics.unknown && (
                  <p>
                    {session.analytics.unknown} savol uchun eski urinishda ko‘rilganlik ma’lumoti
                    yozilmagan.
                  </p>
                )}
              </div>
              <div className="topik-table-scroll">
                <table className="topik-word-table">
                  <thead>
                    <tr>
                      <th>Tur</th>
                      <th>To‘g‘ri</th>
                      <th>Faol vaqt</th>
                      <th>Keyingi qadam</th>
                    </tr>
                  </thead>
                  <tbody>
                    {session.analytics.categories.map((c) => (
                      <tr key={c.category}>
                        <th>읽기 {c.category}</th>
                        <td>
                          {c.correct}/{c.total}
                        </td>
                        <td>
                          {c.seconds
                            ? `${Math.floor(c.seconds / 60)}:${String(c.seconds % 60).padStart(2, '0')}`
                            : 'Yozilmagan'}
                        </td>
                        <td>
                          <p>
                            {!c.enough
                              ? 'Xulosa uchun savol kam'
                              : c.correct / c.total < 0.7
                                ? 'Mustahkamlash tavsiya etiladi'
                                : 'Yaxshi natija'}
                          </p>
                          <button
                            className="text-button"
                            disabled={busy}
                            onClick={async () => {
                              setBusy(true);
                              try {
                                const next = await api<TopikSession>('topik/start', {
                                  method: 'POST',
                                  body: JSON.stringify({
                                    mode: 'practice',
                                    category: c.category,
                                    count: 10,
                                  }),
                                });
                                window.location.assign(`/topik/session/${next.id}`);
                              } catch (e) {
                                setError(errorText(e));
                                setBusy(false);
                              }
                            }}
                          >
                            Shu turni mashq qilish
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
          <div className="topik-results-toolbar">
            <div>
              <h2>Javoblar tahlili</h2>
              <p>
                Xato va ikkilangan javoblar takrorlash jadvaliga qo‘shildi. Xohlasangiz, alohida ham
                saqlang.
              </p>
            </div>
            <div className="segmented">
              <button
                className={resultFilter === 'all' ? 'active' : ''}
                onClick={() => setResultFilter('all')}
              >
                Barchasi
              </button>
              <button
                className={resultFilter === 'wrong' ? 'active' : ''}
                onClick={() => setResultFilter('wrong')}
              >
                Xatolar ({session.actualCount - (session.score || 0)})
              </button>
            </div>
          </div>
          <p className="muted">
            Ma’nosini ko‘rish uchun matndagi nuqtali chiziq bilan belgilangan so‘zni bosing.
          </p>
          <WordContext.Provider
            value={{
              words: contextWords,
              open: (word, surface, text) => setContextWord({ word, surface, text }),
            }}
          >
            {resultGroups.map((group) => (
              <TopikPaper
                key={group.id}
                group={group}
                choices={session.choices}
                sessionId={session.id}
                results={session.results}
                onBookmark={save}
                bookmarkBusy={bookmarkBusy}
              />
            ))}
          </WordContext.Provider>
          {contextWord && (
            <ContextWordModal
              key={contextWord.word.id}
              item={contextWord}
              onClose={() => setContextWord(null)}
            />
          )}
          {!resultGroups.length && (
            <Empty title="Barcha javoblar to‘g‘ri!">Bu mashqda xato savol yo‘q.</Empty>
          )}
          <div className="topik-result-bottom">
            <button className="button primary" onClick={onExit}>
              Mashqlarga qaytish
              <ArrowRight size={18} />
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="topik-session-heading">
            <div>
              <span className="eyebrow">
                읽기 · {session.mode === 'mock' ? 'MOCK IMTIHON' : 'MASHQ'}
              </span>
              <h1>{session.actualCount} ta savol. Bir qadam oldinga.</h1>
            </div>
            {remaining !== null ? (
              <div
                className={`topik-timer ${remaining < 300 ? 'urgent' : ''}`}
                role="timer"
                aria-label="Qolgan vaqt"
              >
                <Clock3 size={22} />
                <strong>
                  {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}
                </strong>
                <small>qoldi</small>
              </div>
            ) : (
              <Badge tone="neutral">Vaqt chegaralanmagan</Badge>
            )}
          </div>
          {session.notice && <div className="topik-session-notice">{session.notice}</div>}
          <div className="topik-exam-layout">
            <div className="topik-exam-main">
              <div className="topik-progress-meta">
                <span>
                  <b>{session.answeredCount}</b> / {session.actualCount} javob belgilandi
                </span>
                <span role="status">
                  {busy ? (
                    <>
                      <LoaderCircle className="spin" size={14} />
                      Saqlanmoqda…
                    </>
                  ) : (
                    <>
                      <Check size={14} />
                      Saqlangan
                    </>
                  )}
                </span>
              </div>
              <div className="topik-progress-track">
                <span
                  style={{
                    width: `${(session.answeredCount / Math.max(session.actualCount, 1)) * 100}%`,
                  }}
                />
              </div>
              {skippedActive !== null ? (
                <article
                  className="topik-paper topik-skipped-paper"
                  aria-label="42–43-savollar tashlab o‘tiladi"
                >
                  <div className="topik-paper-masthead">
                    <span>한강 TOPIK II</span>
                    <span>읽기</span>
                  </div>
                  <h2>{skippedNumbers.join('–')}. Bu savollarni tashlab o‘ting.</h2>
                  <p>
                    Manba PDFda bu savollarning matni berilmagan. Ular natijaga ta’sir qilmaydi va
                    javobsiz hisoblanmaydi.
                  </p>
                  <button className="button secondary" onClick={() => selectNumber(44)}>
                    44-savolga o‘tish <ArrowRight size={17} />
                  </button>
                </article>
              ) : (
                currentGroup && (
                  <TopikPaper
                    group={currentGroup}
                    choices={session.choices}
                    selectedId={activeId}
                    disabled={busy || remaining === 0}
                    onAnswer={answer}
                    sessionId={session.id}
                    results={session.checkedResults?.length ? session.checkedResults : undefined}
                    onCheck={session.mode !== 'mock' ? checkQuestion : undefined}
                  />
                )
              )}
              <div className="topik-question-actions">
                <button
                  className="button secondary"
                  disabled={navigationIndex === 0}
                  onClick={() => selectNumber(navigationNumbers[navigationIndex - 1])}
                >
                  <ChevronLeft size={18} />
                  Oldingi
                </button>
                <button
                  className={`topik-mark-button ${marked.has(activeId) ? 'marked' : ''}`}
                  onClick={toggleMarked}
                  disabled={skippedActive !== null}
                  aria-pressed={marked.has(activeId)}
                >
                  <Flag size={17} fill={marked.has(activeId) ? 'currentColor' : 'none'} />
                  <span>{marked.has(activeId) ? 'Belgilangan' : 'Keyin ko‘rish'}</span>
                </button>
                <button
                  className="button secondary"
                  disabled={busy || skippedActive !== null || !!session.checked[activeId]}
                  aria-pressed={!!session.uncertain[activeId]}
                  onClick={toggleUncertain}
                >
                  {session.uncertain[activeId] ? '✓ Ikkilandim' : 'Ikkilandim'}
                </button>
                {navigationIndex < navigationNumbers.length - 1 ? (
                  <button
                    className="button primary"
                    onClick={() => selectNumber(navigationNumbers[navigationIndex + 1])}
                  >
                    Keyingi
                    <ChevronRight size={18} />
                  </button>
                ) : (
                  <button className="button primary" disabled={busy} onClick={requestFinish}>
                    Yakunlash
                    <Check size={18} />
                  </button>
                )}
              </div>
            </div>
            <aside className="panel topik-navigator">
              <div className="topik-navigator-heading">
                <h2>Savollar</h2>
                <span>
                  {activeNumber} / {navigationNumbers.length}
                </span>
              </div>
              <div className="topik-question-grid" aria-label="Savolga o‘tish">
                {navigationNumbers.map((number) => {
                  const q = questions.find((q) => q.displayNumber === number);
                  if (!q)
                    return (
                      <button
                        key={`skip-${number}`}
                        className={`skipped ${skippedActive === number ? 'current' : ''}`}
                        aria-label={`${number}-savol, tashlab o‘ting, baholanmaydi`}
                        aria-current={skippedActive === number ? 'step' : undefined}
                        onClick={() => selectNumber(number)}
                      >
                        {number}
                      </button>
                    );
                  return (
                    <button
                      key={q.id}
                      className={`${session.choices[q.id] !== undefined ? 'answered' : ''} ${skippedActive === null && activeId === q.id ? 'current' : ''} ${marked.has(q.id) ? 'marked' : ''}`}
                      onClick={() => select(q.id)}
                      aria-label={`${q.displayNumber}-savol${session.choices[q.id] !== undefined ? ', javob belgilangan' : ', javobsiz'}${marked.has(q.id) ? ', keyin ko‘rish uchun belgilangan' : ''}`}
                      aria-current={
                        skippedActive === null && activeId === q.id ? 'step' : undefined
                      }
                    >
                      {q.displayNumber}
                      {marked.has(q.id) && <Flag size={9} fill="currentColor" />}
                    </button>
                  );
                })}
              </div>
              {skippedNumbers.length > 0 && (
                <p className="topik-helper">
                  {skippedNumbers.join('–')}: tashlab o‘ting · baholanmaydi
                </p>
              )}
              <div className="topik-map-legend">
                <span>
                  <i className="answered" />
                  Javob berilgan
                </span>
                <span>
                  <i />
                  Javobsiz
                </span>
                <span>
                  <Flag size={12} />
                  Keyin ko‘rish
                </span>
              </div>
              <p className="topik-helper">
                {session.mode === 'mock'
                  ? 'Javobingizni yakunlashgacha o‘zgartirishingiz mumkin. Natijalar va yechimlar imtihon yakunida ochiladi.'
                  : 'Javobni tekshirgach, uni o‘zgartirib bo‘lmaydi. Xohlasangiz, yechimni ochib daftaringizga saqlang.'}
              </p>
              <button className="button primary" disabled={busy} onClick={requestFinish}>
                {busy ? <LoaderCircle className="spin" size={17} /> : <Check size={17} />}Mashqni
                yakunlash
              </button>
              {unanswered > 0 && (
                <small className="topik-unanswered">{unanswered} ta savol javobsiz</small>
              )}
            </aside>
          </div>
        </>
      )}
      {confirmFinish && !complete && (
        <Modal title="Mashqni yakunlaysizmi?" onClose={() => setConfirmFinish(false)}>
          <p>
            <strong>{unanswered} ta savol javobsiz qoldi.</strong> Javobsiz savollar xato
            hisoblanadi. Savollarga qaytishingiz yoki belgilangan javoblarni tekshirishingiz mumkin.
          </p>
          <div className="modal-actions">
            <button className="button secondary" onClick={() => setConfirmFinish(false)}>
              Savollarga qaytish
            </button>
            <button className="button primary" disabled={busy} onClick={() => finish()}>
              Yakunlash va tekshirish
              <Check size={17} />
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
