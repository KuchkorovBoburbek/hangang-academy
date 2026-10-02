'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BookOpen,
  PenLine,
  Headphones,
  Sparkles,
  Plus,
  Upload,
  X,
  Check,
  Send,
  LoaderCircle,
  ArrowRight,
  RotateCcw,
  Languages,
} from 'lucide-react';
import type { User, Group } from '@/lib/types';
import {
  VOCABULARY_SECTIONS,
  bandLabel,
  type VocabularyEntry,
  type VocabularySection,
  type VocabularyJobView,
} from '@/lib/vocabulary-types';
import VocabularyDeck from './vocabulary-deck';
import { api, Modal, SubmitButton, errorText } from './ui';
import '@/app/vocabulary.css';
import { ScopePicker, VocabularyAccess } from './vocabulary-scope';
import Quiz, { type SessionView } from './quiz';
import {
  VOCABULARY_LEVELS,
  SEOULTE_BOOKS,
  vocabularyTopics,
  vocabularyLevel,
  scopeLabel,
  sameScope,
  type VocabularyScope,
  type VocabularyCatalog,
} from '@/lib/vocabulary-types';
const icons = [BookOpen, PenLine, Headphones];
const jobLabel = {
  queued: 'Navbatda',
  running: 'Tarjima va misollar tayyorlanmoqda',
  completed: 'Tayyor',
  failed: 'Qayta urinish kerak',
};

export default function VocabularyHub({
  user,
  groups,
  initialSection,
  initialKind,
  go,
  notify,
  refresh,
  aiEnabled,
}: {
  user: User;
  groups: Group[];
  initialSection?: string;
  initialKind?: string;
  go: (path: string) => void;
  notify: (message: string) => void;
  refresh: () => void;
  aiEnabled: boolean;
}) {
  const [section, setSection] = useState<VocabularySection>(
    VOCABULARY_SECTIONS.some((s) => s.id === initialSection)
      ? (initialSection as VocabularySection)
      : 'reading',
  );
  const [kind, setKind] = useState<'word' | 'idiom'>(initialKind === 'idioms' ? 'idiom' : 'word');
  const [level, setLevel] = useState<VocabularyScope['level']>('topik34');
  const [book, setBook] = useState<VocabularyScope['book']>('1A');
  const [catalog, setCatalog] = useState<VocabularyCatalog | null>(null);
  const [catalogError, setCatalogError] = useState('');
  const [accessOpen, setAccessOpen] = useState(false);
  const [quiz, setQuiz] = useState<SessionView | null>(null);
  const [quizBusy, setQuizBusy] = useState(false);
  const scope: VocabularyScope = {
    level,
    book: level === 'hangul' ? book : null,
    section: level === 'hangul' ? 'reading' : section,
  };
  const teacher = user.role === 'teacher';
  const [editor, setEditor] = useState<VocabularyEntry | 'new' | null>(null);
  const [assistant, setAssistant] = useState(false);
  const [noteWord, setNoteWord] = useState<VocabularyEntry | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [jobs, setJobs] = useState<VocabularyJobView[]>([]);
  const [jobsError, setJobsError] = useState('');
  const [retrying, setRetrying] = useState('');
  const previousJobs = useRef<string | null>(null);
  useEffect(() => {
    let active = true;
    api<VocabularyCatalog>('vocabulary/catalog')
      .then((data) => {
        if (!active) return;
        setCatalog(data);
        setCatalogError('');
        if (!teacher) setLevel(data.level);
      })
      .catch((e) => {
        if (active) setCatalogError(errorText(e));
      });
    return () => {
      active = false;
    };
  }, [teacher, refreshKey]);
  async function beginQuiz(categories: string[], count: number) {
    if (quizBusy) return;
    setQuizBusy(true);
    try {
      setQuiz(
        await api<SessionView>('vocabulary/quiz', {
          method: 'POST',
          body: JSON.stringify({ scope, categories, kind, count }),
        }),
      );
    } catch (e) {
      notify(errorText(e));
    } finally {
      setQuizBusy(false);
    }
  }
  const loadJobs = useCallback(async () => {
    if (!teacher) return;
    try {
      const data = await api<{ items: VocabularyJobView[] }>('teacher/vocabulary/jobs');
      const completed = data.items
        .filter((j) => j.status === 'completed')
        .map((j) => j.id)
        .join(',');
      if (previousJobs.current !== null && previousJobs.current !== completed)
        setRefreshKey((v) => v + 1);
      previousJobs.current = completed;
      setJobs(data.items);
      setJobsError('');
    } catch (e) {
      setJobsError(errorText(e));
    }
  }, [teacher]);
  useEffect(() => {
    void loadJobs();
    if (!teacher) return;
    const timer = setInterval(loadJobs, 6000);
    return () => clearInterval(timer);
  }, [teacher, loadJobs]);
  async function retry(job: VocabularyJobView) {
    setRetrying(job.id);
    try {
      await api(`teacher/vocabulary/jobs/${job.id}/retry`, { method: 'POST', body: '{}' });
      await loadJobs();
    } catch (e) {
      notify(errorText(e));
    } finally {
      setRetrying('');
    }
  }
  function saved() {
    setEditor(null);
    setRefreshKey((v) => v + 1);
    refresh();
    notify('Lug‘at saqlandi.');
  }
  return (
    <div className="vocabulary-hub">
      <header className="vocab-hero">
        <div>
          <span className="vocab-eyebrow">HANGANG · WORD STUDIO</span>
          <h1>
            So‘zdan boshlanadi<span lang="ko">나의 단어장</span>
          </h1>
          <p>Ma’nosini biling. Gapda qo‘llang. Esda saqlang.</p>
        </div>
        <div className="vocab-hero-mark" aria-hidden="true">
          <Languages size={37} />
          <span>한 걸음 더</span>
        </div>
      </header>
      {catalogError && <p className="alert error">{catalogError}</p>}
      <div className="vocab-level-tabs" role="group" aria-label="Lug‘at darajasi">
        {VOCABULARY_LEVELS.filter((l) => teacher || l.id === catalog?.level).map((l) => (
          <button
            key={l.id}
            aria-pressed={level === l.id}
            className={level === l.id ? 'active' : ''}
            onClick={() => setLevel(l.id)}
          >
            {l.label}
          </button>
        ))}
      </div>
      {level === 'hangul' ? (
        <div className="vocab-book-grid" role="group" aria-label="Seoulte kitoblari">
          {SEOULTE_BOOKS.map((b) => (
            <button
              key={b}
              aria-pressed={book === b}
              className={book === b ? 'active' : ''}
              onClick={() => setBook(b)}
            >
              <BookOpen size={24} />
              <strong>Seoulte {b}</strong>
              <small>8 ta mavzu</small>
            </button>
          ))}
        </div>
      ) : (
        <div className="vocab-section-tabs" role="tablist" aria-label="TOPIK lug‘at bo‘limi">
          {VOCABULARY_SECTIONS.map((s, i) => {
            const Icon = icons[i];
            return (
              <button
                role="tab"
                aria-selected={section === s.id}
                aria-controls="vocabulary-content"
                id={`vocab-tab-${s.id}`}
                key={s.id}
                onClick={() => setSection(s.id)}
                className={section === s.id ? 'active' : ''}
              >
                <Icon size={21} />
                <span>
                  <strong lang="ko">TOPIK {s.ko}</strong>
                  <small>{s.label} lug‘ati</small>
                </span>
                <ArrowRight size={18} />
              </button>
            );
          })}
        </div>
      )}
      {teacher && (
        <button
          className="button secondary vocab-access-button"
          onClick={() => setAccessOpen(true)}
        >
          Guruhga lug‘at ochish
        </button>
      )}
      {teacher && (
        <section className="vocab-assistant-banner">
          <div className="vocab-assistant-icon">
            <Sparkles size={25} />
          </div>
          <div>
            <h2>Lug‘at yordamchingiz</h2>
            <p>
              Koreyscha so‘z yoki rasm yuboring. Tarjima, misol va tartiblashni yordamchi bajaradi.
            </p>
          </div>
          <div className="vocab-assistant-actions">
            <button className="button secondary" onClick={() => setEditor('new')}>
              <Plus size={17} /> Qo‘lda qo‘shish
            </button>
            <button className="button primary" onClick={() => setAssistant(true)}>
              <Sparkles size={17} /> AI bilan qo‘shish
            </button>
          </div>
        </section>
      )}
      {teacher && (
        <div className="vocab-telegram-hint">
          <Send size={15} />
          <span>
            {user.telegram_id
              ? 'Telegram botga /lugat yuborib ham so‘z yoki rasm qo‘shishingiz mumkin.'
              : 'Natija Telegram’ga kelishi uchun ustoz hisobingizni Sozlamalarda bog‘lang.'}
          </span>
          <button onClick={() => go('/settings')}>
            Sozlamalar <ArrowRight size={14} />
          </button>
        </div>
      )}
      {teacher && (jobs.length > 0 || jobsError) && (
        <details
          className="vocab-jobs panel"
          open={jobs.some((j) => j.status === 'queued' || j.status === 'running') || undefined}
        >
          <summary>
            <span>
              <Sparkles size={17} /> AI so‘rovlarim
            </span>
            <small>
              {jobs.filter((j) => j.status === 'queued' || j.status === 'running').length
                ? 'Tayyorlanmoqda…'
                : 'Natijalar va saqlangan so‘zlar'}
            </small>
          </summary>
          {jobsError && <p className="alert error">{jobsError}</p>}
          {jobs.slice(0, 8).map((job) => (
            <article className="vocab-job" key={job.id}>
              <div className="vocab-job-heading">
                <span className={`vocab-job-status ${job.status}`}>
                  {job.status === 'queued' || job.status === 'running' ? (
                    <LoaderCircle className="spin" size={15} />
                  ) : job.status === 'completed' ? (
                    <Check size={15} />
                  ) : (
                    <RotateCcw size={15} />
                  )}
                  {jobLabel[job.status]}
                </span>
                <small>
                  {scopeLabel(job)} · {bandLabel(job.category)} ·{' '}
                  {job.source === 'telegram' ? 'Telegram' : 'Sayt'}
                </small>
              </div>
              {job.result && (
                <>
                  <p>
                    <b>{job.result.added}</b> ta yangi so‘z saqlandi · {job.result.duplicates} ta
                    mavjud so‘z o‘zgartirilmadi
                  </p>
                  {!!job.result.words.length && (
                    <div className="vocab-result-words">
                      {job.result.words.map((w) => (
                        <span key={w.id}>
                          <b lang="ko">{w.ko}</b> {w.uz}
                        </span>
                      ))}
                    </div>
                  )}
                  {!!job.result.skipped.length && (
                    <p className="vocab-job-warning">
                      Aniqlashtirish kerak: {job.result.skipped.join('; ')}
                    </p>
                  )}
                </>
              )}
              {job.error && <p className="alert error">{job.error}</p>}
              {job.status === 'failed' && (
                <button className="text-button" disabled={!!retrying} onClick={() => retry(job)}>
                  {retrying === job.id ? (
                    <LoaderCircle size={15} className="spin" />
                  ) : (
                    <RotateCcw size={15} />
                  )}{' '}
                  Qayta yuborish
                </button>
              )}
            </article>
          ))}
        </details>
      )}
      <section
        id="vocabulary-content"
        role={level === 'hangul' ? 'region' : 'tabpanel'}
        aria-label={level === 'hangul' ? 'Kitob lug‘ati' : undefined}
        aria-labelledby={level === 'hangul' ? undefined : `vocab-tab-${section}`}
      >
        <div className="vocab-kind-row">
          <div className="vocab-kind-tabs" role="group" aria-label="So‘zlar va iboralar">
            <button
              aria-pressed={kind === 'word'}
              className={kind === 'word' ? 'active' : ''}
              onClick={() => setKind('word')}
            >
              So‘zlar
            </button>
            <button
              aria-pressed={kind === 'idiom'}
              className={kind === 'idiom' ? 'active' : ''}
              onClick={() => setKind('idiom')}
            >
              관용표현 · Iboralar
            </button>
          </div>
        </div>
        {catalog && (
          <VocabularyDeck
            key={`${level}:${book}:${section}:${kind}`}
            section={scope.section}
            scope={scope}
            topics={catalog.scopes.find((s) => sameScope(s, scope))?.topics || []}
            onQuiz={beginQuiz}
            quizBusy={quizBusy}
            kind={kind}
            teacher={teacher}
            onEdit={setEditor}
            onNote={setNoteWord}
            refreshKey={refreshKey}
          />
        )}
      </section>
      {noteWord && (
        <VocabularyNote
          word={noteWord}
          onClose={() => setNoteWord(null)}
          onSaved={() => {
            setNoteWord(null);
            refresh();
            notify('So‘z va shaxsiy izohingiz daftaringizga saqlandi.');
          }}
        />
      )}
      {editor && (
        <WordEditor
          word={editor === 'new' ? null : editor}
          scope={scope}
          groups={groups}
          onClose={() => setEditor(null)}
          onSaved={saved}
        />
      )}
      {assistant && (
        <AssistantForm
          scope={scope}
          groups={groups}
          enabled={aiEnabled}
          onClose={() => setAssistant(false)}
          onQueued={() => {
            setAssistant(false);
            void loadJobs();
            notify(
              'So‘rov qabul qilindi. Natija shu sahifada va ulangan Telegram hisobingizda chiqadi.',
            );
          }}
        />
      )}
      {accessOpen && (
        <VocabularyAccess
          groups={groups}
          initialScope={scope}
          onClose={() => setAccessOpen(false)}
          onSaved={() => {
            setAccessOpen(false);
            setRefreshKey((v) => v + 1);
            notify('Guruh ruxsatlari saqlandi.');
          }}
        />
      )}
      {quiz && (
        <Quiz
          key={quiz.id}
          initial={quiz}
          onClose={() => setQuiz(null)}
          onComplete={() => {
            refresh();
            setRefreshKey((v) => v + 1);
          }}
        />
      )}
    </div>
  );
}
function GroupPicker({
  groups,
  selected,
  onChange,
}: {
  groups: Group[];
  selected: string[];
  onChange: (groups: string[]) => void;
}) {
  return (
    <fieldset className="vocab-groups">
      <legend>So‘zlar va bildirishnoma qaysi guruhlarga?</legend>
      {!groups.length ? (
        <p>Avval «Guruhlar va vazifalar» bo‘limida guruh yarating.</p>
      ) : (
        groups.map((g) => (
          <label key={g.id}>
            <input
              type="checkbox"
              checked={selected.includes(g.id)}
              onChange={(e) =>
                onChange(
                  e.target.checked ? [...selected, g.id] : selected.filter((id) => id !== g.id),
                )
              }
            />
            <span>{g.name}</span>
          </label>
        ))
      )}
    </fieldset>
  );
}
function WordEditor({
  word,
  scope: initialScope,
  groups,
  onClose,
  onSaved,
}: {
  word: VocabularyEntry | null;
  scope: VocabularyScope;
  groups: Group[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [scope, setScope] = useState<VocabularyScope>(
    word ? { level: word.level, book: word.book, section: word.section } : initialScope,
  );
  const [categories, setCategories] = useState(
    word?.categories
      .map((c) => (['1-2', '3-4'].includes(c) ? '1-4' : c))
      .filter((c, i, a) => a.indexOf(c) === i) || [vocabularyTopics(scope)[0].id],
  );
  const eligibleGroups = groups.filter((g) => vocabularyLevel(g.level) === scope.level);
  const [groupIds, setGroupIds] = useState(
    eligibleGroups.length === 1 ? [eligibleGroups[0].id] : [],
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const requestKey = useRef(crypto.randomUUID());
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    const form = new FormData(event.currentTarget);
    try {
      await api('teacher/vocabulary/word', {
        method: 'POST',
        body: JSON.stringify({
          id: word?.id,
          revision: word?.revision || 0,
          groupIds,
          requestKey: requestKey.current,
          input: { ...Object.fromEntries(form), ...scope, categories },
        }),
      });
      onSaved();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title={word ? 'So‘zni tahrirlash' : 'Yangi so‘z'} onClose={onClose}>
      <form className="form-stack vocab-form" onSubmit={submit}>
        {word && (
          <p className="vocab-form-note">
            Tahrir lug‘atda ko‘rinadi. O‘quvchilarning oldingi mashq natijalari saqlanadi.
          </p>
        )}
        <div className="vocab-form-columns">
          <label>
            Koreyscha so‘z
            <input
              name="ko"
              defaultValue={word?.ko}
              lang="ko"
              required
              maxLength={100}
              placeholder="성장하다"
            />
          </label>
          <label>
            O‘zbekcha ma’nosi
            <input
              name="uz"
              defaultValue={word?.uz}
              required
              maxLength={250}
              placeholder="o‘smoq, rivojlanmoq"
            />
          </label>
        </div>
        <div className="vocab-form-columns">
          <label>
            So‘z turkumi
            <input
              name="pos"
              defaultValue={word?.pos || 'Fe’l'}
              required
              maxLength={60}
              placeholder="Ot, fe’l, sifat…"
            />
          </label>
          <label>
            Turi
            <select name="kind" defaultValue={word?.kind || 'word'}>
              <option value="word">So‘z</option>
              <option value="idiom">Ibora</option>
            </select>
          </label>
        </div>
        <label>
          Koreyscha misol
          <textarea
            name="example"
            lang="ko"
            defaultValue={word?.example}
            required
            maxLength={1000}
            rows={2}
          />
        </label>
        <label>
          Misol tarjimasi
          <textarea
            name="translation"
            defaultValue={word?.translation}
            required
            maxLength={1000}
            rows={2}
          />
        </label>
        <ScopePicker
          value={scope}
          onChange={(s) => {
            setScope(s);
            setCategories([vocabularyTopics(s)[0].id]);
            setGroupIds([]);
          }}
        />
        <fieldset className="vocab-bands-field">
          <legend>{scope.level === 'hangul' ? 'Kitob mavzulari' : 'Savollar diapazoni'}</legend>
          {vocabularyTopics(scope).map((topic) => (
            <label key={topic.id}>
              <input
                type="checkbox"
                checked={categories.includes(topic.id)}
                onChange={(e) =>
                  setCategories(
                    e.target.checked
                      ? [...categories, topic.id]
                      : categories.filter((x) => x !== topic.id),
                  )
                }
              />
              <span>{topic.label}</span>
            </label>
          ))}
        </fieldset>
        {!word && (
          <GroupPicker
            groups={groups.filter((g) => vocabularyLevel(g.level) === scope.level)}
            selected={groupIds}
            onChange={setGroupIds}
          />
        )}
        {!word && (
          <p className="vocab-form-note">
            Tanlangan mavzular shu guruhlarga avtomatik ochiladi. So‘zlar soni kitobning to‘liq
            lug‘ati ekanini bildirmaydi.
          </p>
        )}
        {error && (
          <p className="alert error" role="alert">
            {error}
          </p>
        )}
        <SubmitButton busy={busy}>
          <Check size={18} /> Saqlash
        </SubmitButton>
      </form>
    </Modal>
  );
}
function AssistantForm({
  scope: initialScope,
  groups,
  enabled,
  onClose,
  onQueued,
}: {
  scope: VocabularyScope;
  groups: Group[];
  enabled: boolean;
  onClose: () => void;
  onQueued: () => void;
}) {
  const [scope, setScope] = useState(initialScope),
    [category, setCategory] = useState(vocabularyTopics(initialScope)[0].id);
  const eligibleGroups = groups.filter((g) => vocabularyLevel(g.level) === scope.level);
  const [groupIds, setGroupIds] = useState(
    eligibleGroups.length === 1 ? [eligibleGroups[0].id] : [],
  );
  const [image, setImage] = useState<File | null>(null),
    [preview, setPreview] = useState('');
  const [text, setText] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const requestKey = useRef(crypto.randomUUID());
  useEffect(() => {
    if (!image) {
      setPreview('');
      return;
    }
    const url = URL.createObjectURL(image);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [image]);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const form = new FormData();
      form.set('section', scope.section);
      form.set('level', scope.level);
      if (scope.book) form.set('book', scope.book);
      form.set('category', category);
      form.set('text', text);
      form.set('requestKey', requestKey.current);
      groupIds.forEach((g) => form.append('groupIds', g));
      if (image) form.set('image', image);
      await api('teacher/vocabulary/import', { method: 'POST', body: form });
      onQueued();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="AI lug‘at yordamchisi" onClose={onClose}>
      <form className="form-stack vocab-form" onSubmit={submit}>
        <p className="vocab-form-note">
          Faqat koreyscha so‘zlarni kiriting. Yordamchi o‘zbekcha ma’no, so‘z turkumi, koreyscha
          misol va tarjimasini tayyorlab, avtomatik saqlaydi.
        </p>
        <ScopePicker
          value={scope}
          onChange={(s) => {
            setScope(s);
            setCategory(vocabularyTopics(s)[0].id);
            setGroupIds([]);
          }}
        />
        <div className="vocab-form-columns">
          <label>
            {scope.level === 'hangul' ? 'Kitob mavzusi' : 'Savollar diapazoni'}
            <select
              aria-label="Savollar diapazoni"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {vocabularyTopics(scope).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label>
          Koreyscha so‘zlar
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={10000}
            rows={5}
            lang="ko"
            placeholder={'성장하다\n도전\n꾸준히'}
          />
        </label>
        <label className="vocab-upload">
          <Upload size={23} />
          <span>
            <strong>Yoki so‘zlar yozilgan rasmni tanlang</strong>
            <small>JPG, PNG, WebP · 5 MB gacha · bir rasm</small>
          </span>
          <input
            aria-label="So‘zlar rasmi"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file && file.size > 5 * 1024 * 1024) {
                setError('Rasm 5 MB dan kichik bo‘lsin.');
                e.target.value = '';
                return;
              }
              setImage(file || null);
              setError('');
            }}
          />
        </label>
        {preview && (
          <div className="vocab-image-preview">
            <img src={preview} alt="Yordamchiga yuboriladigan so‘zlar rasmi" />
            <button
              type="button"
              className="icon-button"
              aria-label="Rasmni olib tashlash"
              onClick={() => setImage(null)}
            >
              <X size={18} />
            </button>
          </div>
        )}
        <GroupPicker
          groups={groups.filter((g) => vocabularyLevel(g.level) === scope.level)}
          selected={groupIds}
          onChange={setGroupIds}
        />
        <p className="vocab-form-note">
          Bir so‘rovda 40 tagacha so‘z. Takrorlar o‘zgartirilmaydi; aniq o‘qilmagan so‘zlar natijada
          alohida ko‘rsatiladi. Saqlangach, tanlangan guruhlarning Telegram’i ulangan o‘quvchilariga
          xabar boradi.
        </p>
        {!enabled && (
          <p className="alert error">
            AI yordamchi hali ulanmagan. Hozircha so‘zlarni qo‘lda qo‘shishingiz mumkin.
          </p>
        )}
        {error && (
          <p className="alert error" role="alert">
            {error}
          </p>
        )}
        <button
          className="button primary"
          type="submit"
          disabled={busy || !enabled || !groupIds.length || (!text.trim() && !image)}
        >
          {busy ? <LoaderCircle className="spin" size={18} /> : <Sparkles size={18} />} Tarjima
          qilib saqlash
        </button>
      </form>
    </Modal>
  );
}

function VocabularyNote({
  word,
  onClose,
  onSaved,
}: {
  word: VocabularyEntry;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      await api('notes', {
        method: 'POST',
        body: JSON.stringify({
          title: word.ko,
          topicId: word.id,
          kind: 'word',
          body: `${word.ko} — ${word.uz}\n${word.example}\n${word.translation}\n\n${String(form.get('note') || '')}`.trim(),
        }),
      });
      onSaved();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Daftarimga qayd" onClose={onClose}>
      <form className="form-stack" onSubmit={submit}>
        <div className="vocab-form-note">
          <h3 lang="ko">{word.ko}</h3>
          <p>{word.uz}</p>
          <p lang="ko">{word.example}</p>
          <p>{word.translation}</p>
        </div>
        <label>
          Shaxsiy izohim
          <textarea
            name="note"
            maxLength={4000}
            rows={4}
            placeholder="Bu so‘zni qanday eslab qolaman?"
          />
        </label>
        {error && <p className="alert error">{error}</p>}
        <SubmitButton busy={busy}>Daftarimga saqlash</SubmitButton>
      </form>
    </Modal>
  );
}
