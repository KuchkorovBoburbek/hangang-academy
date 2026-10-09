'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CircleCheckBig,
  CircleX,
  Clock3,
  ChevronDown,
  ChevronUp,
  Eye,
  FileText,
  GraduationCap,
  Headphones,
  Layers3,
  LockKeyhole,
  Mic,
  Plus,
  Save,
  Sparkles,
  Trash2,
  Trophy,
  Upload,
  X,
  Video,
} from 'lucide-react';
import { api, Badge, dateLabel, Empty, errorText, Modal, SubmitButton } from './ui';
import {
  COURSE_LEVELS,
  MATERIAL_TYPES,
  type CourseSummary,
  type CourseLesson,
  type LessonMaterial,
  type LessonWord,
  type LessonQuestion,
  type CourseFile,
  type CourseStudentState,
  type TaskStatus,
  type LessonRelease,
} from '@/lib/course-types';
import type { Group, Grammar } from '@/lib/types';
import type { courseBoard, lessonView } from '@/lib/courses';
import type { VocabularyEntry } from '@/lib/vocabulary-types';
import { youtubeEmbedUrl, youtubeVideoId } from '@/lib/youtube';
import GrammarLesson from './grammar-lesson';
import {
  GRAMMAR_TOPICS,
  grammarTopicFor,
  groupGrammarsByTopic,
  type GrammarTopicId,
} from '@/lib/grammar-topics';
import {
  SEOULTE_1A_BOOK,
  SEOULTE_1A_UNITS,
  isSeoulte1AGrammar,
  seoulte1AUnit,
} from '@/lib/seoulte-1a';
import '@/app/courses.css';
type GrammarBookFilter = 'all' | 'seoulte-1a' | 'topik';
type Catalog = {
  courses: CourseSummary[];
  groups: Group[];
  releases: { id: string; group_id: string; lesson_id: string; lesson_date: string }[];
};
type Bank = {
  words: VocabularyEntry[];
  grammars: Grammar[];
  categories: string[];
  questions: {
    id: string;
    topic_id: string;
    prompt: string;
    options: string[];
    answer: number;
    explanation: string;
  }[];
};
const post = <T,>(path: string, data: unknown) =>
  api<T>(`courses/${path}`, { method: 'POST', body: JSON.stringify(data) });
const label = (kind: string) => MATERIAL_TYPES.find((t) => t.id === kind);
const blankWord = (): LessonWord => ({
  id: crypto.randomUUID(),
  ko: '',
  uz: '',
  example: '',
  translation: '',
});
const blankQuestion = (): LessonQuestion => ({
  id: crypto.randomUUID(),
  prompt: '',
  options: ['', '', '', ''],
  answer: 0,
  explanation: '',
});
const makeWordQuestions = (words: LessonWord[]) =>
  words.slice(0, 20).flatMap((w) => {
    const other = [...new Set(words.filter((x) => x.uz !== w.uz).map((x) => x.uz))]
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);
    if (!other.length) return [];
    const options = [w.uz, ...other].sort(() => Math.random() - 0.5);
    return [
      {
        id: crypto.randomUUID(),
        prompt: `“${w.ko}” tarjimasini tanlang.`,
        options,
        answer: options.indexOf(w.uz),
        explanation: w.example ? `${w.example}\n${w.translation}` : `${w.ko} — ${w.uz}`,
      },
    ];
  });
export function CourseStudio({
  notify,
  refresh,
}: {
  notify: (s: string) => void;
  refresh: () => void;
}) {
  const [catalog, setCatalog] = useState<Catalog | null>(null),
    [selected, setSelected] = useState('hangul'),
    [lessonId, setLessonId] = useState<string | null>(null),
    [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try {
      setCatalog(await api<Catalog>('courses/catalog'));
    } catch (e) {
      notify(errorText(e));
    }
  }, [notify]);
  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    const selectedLesson = new URLSearchParams(window.location.search).get('lesson');
    if (selectedLesson) setLessonId(selectedLesson);
  }, []);
  const course = catalog?.courses.find((c) => c.level === selected);
  async function create() {
    if (!course) return;
    setBusy(true);
    try {
      const l = await post<CourseLesson>('lessons', { courseId: course.id });
      setLessonId(l.id);
      await load();
    } catch (e) {
      notify(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  if (lessonId && catalog)
    return (
      <LessonEditor
        lessonId={lessonId}
        catalog={catalog}
        notify={notify}
        onBack={() => {
          setLessonId(null);
          load();
          refresh();
        }}
        onChange={load}
      />
    );
  return (
    <div className="course-space">
      <div className="page-heading">
        <div>
          <span className="eyebrow">수업 설계 · USTOZ IJODXONASI</span>
          <h1>Dars dasturlari</h1>
          <p>Bir marta tayyorlang. Har bir guruh bilan o‘z sur’atida o‘ting.</p>
        </div>
        <button className="button primary" disabled={!course || busy} onClick={create}>
          <Plus size={18} />
          Dars qo‘shish
        </button>
      </div>
      <div className="course-levels" role="tablist" aria-label="Dastur darajasi">
        {COURSE_LEVELS.map((level, i) => (
          <button
            key={level.id}
            role="tab"
            aria-selected={selected === level.id}
            onClick={() => setSelected(level.id)}
            className={selected === level.id ? 'selected' : ''}
          >
            <span className="course-level-number">0{i + 1}</span>
            <strong>{level.label}</strong>
            <small>{level.description}</small>
          </button>
        ))}
      </div>
      <div className="course-overview">
        <span className="course-emblem" lang="ko">
          배움
        </span>
        <div>
          <span className="eyebrow">{course?.title || 'Dastur'} · O‘QUV YO‘LI</span>
          <h2>Har bir dars — yangi qadam.</h2>
          <p>
            {course?.lessons.length || 0} dars ·{' '}
            {catalog?.groups.filter((g) => g.course_id === course?.id).length || 0} guruh.
            Qoralamani saqlash darsni o‘quvchilarga ochmaydi.
          </p>
        </div>
      </div>
      {!catalog ? (
        <p role="status">Dasturlar yuklanmoqda…</p>
      ) : !course?.lessons.length ? (
        <section className="panel">
          <Empty title="Birinchi darsdan boshlaymiz">
            Dars nomi, materiallar va vazifalarni o‘zingiz qo‘shasiz.
          </Empty>
          <div className="course-empty-action">
            <button className="button primary" onClick={create} disabled={busy}>
              <Plus size={18} />
              Birinchi darsni qo‘shish
            </button>
          </div>
        </section>
      ) : (
        <div className="course-lesson-list">
          {course.lessons.map((l) => (
            <button key={l.id} className="course-lesson-row" onClick={() => setLessonId(l.id)}>
              <span className="course-step">{String(l.position).padStart(2, '0')}</span>
              <div>
                <strong>{l.title}</strong>
                <p>{l.description || 'Dars tavsifini qo‘shing'}</p>
                <small>
                  {l.materials.length} material ·{' '}
                  {catalog.releases.filter((r) => r.lesson_id === l.id).length} guruhga ochilgan
                </small>
              </div>
              <Badge tone="neutral">Qoralamani tahrirlash</Badge>
              <ArrowRight size={19} />
            </button>
          ))}
        </div>
      )}
      <p className="course-footnote">
        <LockKeyhole size={15} /> Har bir guruh uchun darslar alohida ochiladi. Avvalgi darslar
        takrorlash uchun qoladi.
      </p>
    </div>
  );
}
function LessonEditor({
  lessonId,
  catalog,
  notify,
  onBack,
  onChange,
}: {
  lessonId: string;
  catalog: Catalog;
  notify: (s: string) => void;
  onBack: () => void;
  onChange: () => void;
}) {
  const [lesson, setLesson] = useState<CourseLesson | null>(null),
    [files, setFiles] = useState<CourseFile[]>([]),
    [bank, setBank] = useState<Bank | null>(null),
    [busy, setBusy] = useState(false),
    [dirty, setDirty] = useState(false),
    [preview, setPreview] = useState(false),
    [opening, setOpening] = useState(false),
    [publishMaterials, setPublishMaterials] = useState<string[]>([]),
    [publishVideo, setPublishVideo] = useState(false),
    [picker, setPicker] = useState<{ id: string; kind: 'word' | 'grammar' } | null>(null),
    [query, setQuery] = useState(''),
    [grammarTopic, setGrammarTopic] = useState<'all' | GrammarTopicId>('all'),
    [grammarBook, setGrammarBook] = useState<GrammarBookFilter>('all'),
    [grammarUnit, setGrammarUnit] = useState('all'),
    [ai, setAi] = useState<string | null>(null),
    [aiBusy, setAiBusy] = useState(false),
    [aiWords, setAiWords] = useState<LessonWord[]>([]),
    [aiSkipped, setAiSkipped] = useState<string[]>([]),
    [confirmBack, setConfirmBack] = useState(false);
  const [wordJobs, setWordJobs] = useState<
    {
      id: string;
      status: string;
      result: { words: LessonWord[]; skipped: string[] } | null;
      error: string | null;
    }[]
  >([]);
  const loadJobs = useCallback(async () => {
    try {
      const r = await api<{ jobs: typeof wordJobs }>(`courses/lessons/${lessonId}/word-jobs`);
      setWordJobs(r.jobs);
    } catch {}
  }, [lessonId]);
  useEffect(() => {
    loadJobs();
    const timer = setInterval(loadJobs, 10000);
    return () => clearInterval(timer);
  }, [loadJobs]);
  useEffect(() => {
    let active = true;
    Promise.all([
      api<CourseLesson & { files: CourseFile[] }>(`courses/lessons/${lessonId}`),
      api<Bank>('courses/bank'),
    ])
      .then(([l, b]) => {
        if (active) {
          setLesson(l);
          setFiles(l.files);
          setBank(b);
        }
      })
      .catch((e) => notify(errorText(e)));
    return () => {
      active = false;
    };
  }, [lessonId, notify]);
  useEffect(() => {
    const guard = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, [dirty]);
  function update(patch: Partial<CourseLesson>) {
    setLesson((l) => (l ? { ...l, ...patch } : l));
    setDirty(true);
  }
  function materialUpdate(mid: string, patch: Partial<LessonMaterial>) {
    setLesson((l) =>
      l ? { ...l, materials: l.materials.map((m) => (m.id === mid ? { ...m, ...patch } : m)) } : l,
    );
    setDirty(true);
  }
  function changeCurriculumUnit(unitId: string) {
    if (!lesson) return;
    const unit = seoulte1AUnit(unitId);
    const allowed = new Set(unit?.grammarIds || []);
    const removed = lesson.materials
      .filter((material) => material.kind === 'grammar')
      .flatMap((material) => material.grammarIds)
      .filter((grammarId) => unit && !allowed.has(grammarId)).length;
    update({
      curriculumUnit: unitId,
      materials: lesson.materials.map((material) =>
        material.kind === 'grammar'
          ? {
              ...material,
              curriculumUnit: unitId,
              grammarIds: unit
                ? material.grammarIds.filter((grammarId) => allowed.has(grammarId))
                : material.grammarIds,
            }
          : material,
      ),
    });
    if (removed) notify(`${removed} ta boshqa mavzuga tegishli grammatika tanlovdan chiqarildi.`);
  }
  async function save() {
    if (!lesson) return;
    setBusy(true);
    try {
      const l = await post<CourseLesson>(`lessons/${lessonId}`, lesson);
      setLesson(l);
      setDirty(false);
      notify('Dars qoralamasi saqlandi.');
      onChange();
      return l;
    } catch (e) {
      notify(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function upload(mid: string, file: File) {
    setBusy(true);
    try {
      const form = new FormData();
      form.set('file', file);
      const f = await api<CourseFile>(`courses/lessons/${lessonId}/files`, {
        method: 'POST',
        body: form,
      });
      setFiles((v) => [...v, f]);
      setLesson((l) =>
        l
          ? {
              ...l,
              materials: l.materials.map((m) =>
                m.id === mid ? { ...m, fileIds: [...m.fileIds, f.id] } : m,
              ),
            }
          : l,
      );
      setDirty(true);
    } catch (e) {
      notify(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function extract(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setAiBusy(true);
    try {
      const result = await api<{ words: LessonWord[]; skipped: string[] }>(
        `courses/lessons/${lessonId}/ai-words`,
        { method: 'POST', body: new FormData(e.currentTarget) },
      );
      setAiWords(result.words.map((w) => ({ ...w, id: crypto.randomUUID() })));
      setAiSkipped(result.skipped);
    } catch (e) {
      notify(errorText(e));
    } finally {
      setAiBusy(false);
    }
  }
  if (!lesson) return <p role="status">Dars tayyorlanmoqda…</p>;
  const course = catalog.courses.find((c) => c.id === lesson.course_id)!;
  const groups = catalog.groups.filter((g) => g.course_id === course.id);
  const add = (kind: LessonMaterial['kind']) =>
    update({
      materials: [
        ...lesson.materials,
        {
          id: crypto.randomUUID(),
          curriculumUnit: kind === 'grammar' ? lesson.curriculumUnit || '' : '',
          kind,
          title: label(kind)!.label,
          body: '',
          url: '',
          fileIds: [],
          words: [],
          grammarIds: [],
          topikCategory: '',
          task: 'none',
          required: true,
          questions: [],
        },
      ],
    });
  return (
    <div className="course-space">
      <button className="text-button" onClick={() => (dirty ? setConfirmBack(true) : onBack())}>
        <ArrowLeft size={17} />
        Dasturga qaytish
      </button>
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            {course.title} · {lesson.position}-DARS
          </span>
          <h1>Dars tayyorlash</h1>
          <p>
            {dirty ? 'Saqlanmagan o‘zgarishlar bor.' : 'Qoralama saqlangan.'} Guruhga ochish alohida
            amal.
          </p>
        </div>
        <div className="button-row">
          <button className="button secondary" onClick={() => setPreview(true)}>
            <Eye size={17} />
            O‘quvchi ko‘rinishi
          </button>
          <button className="button primary" disabled={busy} onClick={save}>
            <Save size={17} />
            Saqlash
          </button>
        </div>
      </div>
      <section className="panel course-editor-meta">
        {course.level === 'hangul' && (
          <div className="course-curriculum-select">
            <div className="course-curriculum-heading">
              <span className="square-icon pale-blue">
                <BookOpen size={20} />
              </span>
              <div>
                <strong>Darsning kitob va mavzusi</strong>
                <small>
                  Tanlov grammatika bazasini avtomatik filtrlab, faqat shu mavzudagi qoidalarni
                  ko‘rsatadi.
                </small>
              </div>
            </div>
            <div className="form-two">
              <label>
                Kitob
                <select
                  aria-label="Grammatika kitobi"
                  value={lesson.curriculumUnit ? SEOULTE_1A_BOOK.id : ''}
                  onChange={(event) =>
                    changeCurriculumUnit(
                      event.target.value === SEOULTE_1A_BOOK.id ? SEOULTE_1A_UNITS[0].id : '',
                    )
                  }
                >
                  <option value="">Erkin dars</option>
                  <option value={SEOULTE_1A_BOOK.id}>{SEOULTE_1A_BOOK.label}</option>
                </select>
              </label>
              <label>
                Mavzu
                <select
                  aria-label="Seoulte 1A mavzusi"
                  value={lesson.curriculumUnit || ''}
                  disabled={!lesson.curriculumUnit}
                  onChange={(event) => changeCurriculumUnit(event.target.value)}
                >
                  <option value="">Avval kitobni tanlang</option>
                  {SEOULTE_1A_UNITS.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.position}-mavzu · {unit.koTitle} · {unit.title}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {seoulte1AUnit(lesson.curriculumUnit) && (
              <p className="course-curriculum-note">
                {seoulte1AUnit(lesson.curriculumUnit)!.description} ·{' '}
                {seoulte1AUnit(lesson.curriculumUnit)!.grammarIds.length} ta grammatika
              </p>
            )}
          </div>
        )}
        <div className="form-two">
          <label>
            Dars nomi
            <input
              aria-label="Dars nomi"
              value={lesson.title}
              maxLength={160}
              onChange={(e) => update({ title: e.target.value })}
            />
          </label>
          <label>
            Dars tartibi
            <input
              type="number"
              min={1}
              max={1000}
              value={lesson.position}
              onChange={(e) => update({ position: Number(e.target.value) })}
            />
          </label>
        </div>
        <label>
          Qisqa izoh
          <textarea
            rows={2}
            maxLength={2000}
            value={lesson.description}
            onChange={(e) => update({ description: e.target.value })}
            placeholder="Bu darsda nimani o‘rganamiz?"
          />
        </label>
        <label>
          YouTube video
          <span className="course-field-note">
            <Video size={16} /> O‘quvchi videoni dars sahifasining o‘zida ko‘radi.
          </span>
          <input
            type="url"
            aria-label="YouTube video havolasi"
            value={lesson.youtubeUrl}
            maxLength={2000}
            onChange={(e) => update({ youtubeUrl: e.target.value })}
            placeholder="https://www.youtube.com/watch?v=…"
          />
          {lesson.youtubeUrl && youtubeVideoId(lesson.youtubeUrl) === null && (
            <small className="course-field-error">Haqiqiy YouTube video havolasini kiriting.</small>
          )}
        </label>
        {youtubeEmbedUrl(lesson.youtubeUrl) && (
          <YouTubePlayer url={lesson.youtubeUrl} title={`${lesson.title} videosi`} compact />
        )}
      </section>
      {wordJobs.some((j) => j.status !== 'applied') && (
        <section className="panel course-editor-meta">
          <div className="section-title">
            <h2>Telegramdan kelgan lug‘at</h2>
            <button className="text-button" onClick={loadJobs}>
              Yangilash
            </button>
          </div>
          {wordJobs
            .filter((j) => j.status !== 'applied')
            .map((j) => (
              <div className="section-title" key={j.id}>
                <span>
                  {j.status === 'completed'
                    ? `${j.result?.words.length || 0} so‘z tayyor`
                    : j.status === 'failed'
                      ? j.error
                      : 'AI tayyorlamoqda…'}
                </span>
                {j.status === 'completed' && (
                  <button
                    className="button secondary"
                    disabled={dirty}
                    onClick={() => {
                      setAi(`tg:${j.id}`);
                      setAiWords(
                        (j.result?.words || []).map((w) => ({ ...w, id: crypto.randomUUID() })),
                      );
                      setAiSkipped(j.result?.skipped || []);
                    }}
                  >
                    Ko‘rish va darsga qo‘shish
                  </button>
                )}
              </div>
            ))}
          {dirty && <small>Telegram natijasini qo‘shishdan oldin qoralamani saqlang.</small>}
        </section>
      )}
      <div className="section-title">
        <h2>Dars materiallari</h2>
        <span className="muted">{lesson.materials.length} ta karta</span>
      </div>
      <div className="course-material-picker">
        {MATERIAL_TYPES.map((t) => (
          <button className="button secondary" key={t.id} onClick={() => add(t.id)}>
            <span lang="ko">{t.ko}</span>
            {t.label}
            <Plus size={15} />
          </button>
        ))}
      </div>
      {!lesson.materials.length && (
        <Empty title="Darsga birinchi materialni qo‘shing">
          Yuqoridan kerakli turini tanlang. Hamma bo‘limni to‘ldirish shart emas.
        </Empty>
      )}
      {lesson.materials.map((m, index) => (
        <section className="panel course-material-editor" key={m.id}>
          <div className="section-title">
            <div className="button-row">
              <Badge tone="green">{label(m.kind)?.ko}</Badge>
              <strong>
                {index + 1}. {label(m.kind)?.label}
              </strong>
            </div>
            <div className="button-row">
              <button
                className="icon-button"
                aria-label="Materialni yuqoriga"
                disabled={!index}
                onClick={() => {
                  const a = [...lesson.materials];
                  [a[index - 1], a[index]] = [a[index], a[index - 1]];
                  update({ materials: a });
                }}
              >
                <ChevronUp size={17} />
              </button>
              <button
                className="icon-button"
                aria-label="Materialni pastga"
                disabled={index === lesson.materials.length - 1}
                onClick={() => {
                  const a = [...lesson.materials];
                  [a[index], a[index + 1]] = [a[index + 1], a[index]];
                  update({ materials: a });
                }}
              >
                <ChevronDown size={17} />
              </button>
              <button
                className="icon-button"
                aria-label="Materialni olib tashlash"
                onClick={() => update({ materials: lesson.materials.filter((x) => x.id !== m.id) })}
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
          <label>
            Material nomi
            <input
              value={m.title}
              maxLength={160}
              onChange={(e) => materialUpdate(m.id, { title: e.target.value })}
            />
          </label>
          <label>
            {m.kind === 'grammar' ? 'Qoida va misollar' : 'Matn yoki topshiriq sharti'}
            <textarea
              rows={4}
              value={m.body}
              maxLength={16000}
              onChange={(e) => materialUpdate(m.id, { body: e.target.value })}
              placeholder="O‘quvchiga tushunarli qilib yozing…"
            />
          </label>
          {m.kind === 'vocabulary' && (
            <>
              <div className="button-row">
                <button
                  className="button secondary"
                  onClick={() => {
                    setQuery('');
                    setPicker({ id: m.id, kind: 'word' });
                  }}
                >
                  <Layers3 size={16} />
                  Bazadan tanlash
                </button>
                <button
                  className="button secondary"
                  onClick={() => materialUpdate(m.id, { words: [...m.words, blankWord()] })}
                >
                  <Plus size={16} />
                  So‘z yozish
                </button>
                <button
                  className="button secondary"
                  onClick={() => {
                    setAi(m.id);
                    setAiWords([]);
                    setAiSkipped([]);
                  }}
                >
                  <Sparkles size={16} />
                  AI yordamchi
                </button>
              </div>
              <WordEditor words={m.words} onChange={(words) => materialUpdate(m.id, { words })} />
            </>
          )}
          {m.kind === 'grammar' && (
            <>
              <button
                className="button secondary"
                onClick={() => {
                  setQuery('');
                  setGrammarTopic('all');
                  setGrammarBook(lesson.curriculumUnit ? 'seoulte-1a' : 'all');
                  setGrammarUnit(lesson.curriculumUnit || 'all');
                  setPicker({ id: m.id, kind: 'grammar' });
                }}
              >
                Mavjud grammatikadan tanlash
              </button>
              <div className="button-row">
                {m.grammarIds.map((g) => (
                  <button
                    className="course-chip"
                    key={g}
                    onClick={() =>
                      materialUpdate(m.id, { grammarIds: m.grammarIds.filter((x) => x !== g) })
                    }
                  >
                    {bank?.grammars.find((x) => x.id === g)?.form}
                    <X size={14} />
                  </button>
                ))}
              </div>
            </>
          )}
          {m.kind === 'reading' && course.level !== 'hangul' && (
            <label>
              Mavjud TOPIK mashqiga havola
              <select
                value={m.topikCategory}
                onChange={(e) => materialUpdate(m.id, { topikCategory: e.target.value })}
              >
                <option value="">Biriktirilmagan</option>
                {bank?.categories.map((c) => (
                  <option key={c} value={c}>
                    읽기 {c}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="course-attachments">
            {m.fileIds.map((fid) => {
              const f = files.find((f) => f.id === fid);
              return (
                <span className="course-chip" key={fid}>
                  <FileText size={15} />
                  {f?.name || 'Fayl'}
                  <button
                    className="icon-button"
                    aria-label="Faylni materialdan ajratish"
                    onClick={() =>
                      materialUpdate(m.id, { fileIds: m.fileIds.filter((x) => x !== fid) })
                    }
                  >
                    <X size={14} />
                  </button>
                </span>
              );
            })}
          </div>
          <div className="form-two">
            <label>
              Fayl qo‘shish <small>Rasm/PDF: 5 MB · audio: 20 MB</small>
              <input
                type="file"
                disabled={busy}
                accept="image/png,image/jpeg,image/webp,application/pdf,audio/mpeg,audio/wav,audio/ogg,audio/mp4,audio/webm,.m4a"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) upload(m.id, f);
                  e.target.value = '';
                }}
              />
            </label>
            <label>
              Video yoki tashqi material havolasi
              <input
                type="url"
                value={m.url}
                onChange={(e) => materialUpdate(m.id, { url: e.target.value })}
                placeholder="https://…"
              />
            </label>
          </div>
          <div className="course-task-settings">
            <label>
              Vazifa sifatida belgilash
              <select
                value={m.task}
                onChange={(e) =>
                  materialUpdate(m.id, { task: e.target.value as LessonMaterial['task'] })
                }
              >
                <option value="none">Faqat o‘rganish materiali</option>
                <option value="self">O‘quvchi “Bajardim” deb belgilaydi</option>
                <option value="quiz">Quiz — avtomatik tekshirish</option>
                <option value="text">Matn yozib topshirish</option>
                <option value="upload">Rasm / PDF bilan topshirish</option>
                <option value="audio">Ovozli javob topshirish</option>
              </select>
            </label>
            {m.task !== 'none' && (
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={m.required}
                  onChange={(e) => materialUpdate(m.id, { required: e.target.checked })}
                />
                Majburiy vazifa
              </label>
            )}
          </div>
          {m.task === 'quiz' && (
            <>
              <div className="button-row">
                {m.words.length > 1 && (
                  <button
                    className="button secondary"
                    onClick={() => materialUpdate(m.id, { questions: makeWordQuestions(m.words) })}
                  >
                    Shu so‘zlardan quiz tuzish
                  </button>
                )}
                {m.grammarIds.length > 0 && (
                  <button
                    className="button secondary"
                    onClick={() => {
                      const qs =
                        bank?.questions
                          .filter((q) => m.grammarIds.includes(q.topic_id))
                          .slice(0, 20)
                          .map((q) => ({ ...q, id: crypto.randomUUID() })) || [];
                      if (!qs.length)
                        notify('Bu grammatikaga bazada savol yo‘q. Savolni qo‘lda kiriting.');
                      else materialUpdate(m.id, { questions: qs });
                    }}
                  >
                    Bazadan grammatika savollari
                  </button>
                )}
              </div>
              <QuestionEditor
                questions={m.questions}
                onChange={(questions) => materialUpdate(m.id, { questions })}
              />
            </>
          )}
        </section>
      ))}
      <section className="panel course-material-editor">
        <div className="section-title">
          <div>
            <span className="eyebrow">수업 시작 · BIRGA TAKRORLAYMIZ</span>
            <h2>Dars boshlanishidagi quiz</h2>
          </div>
          <Trophy size={24} />
        </div>
        <p>Oldingi darslardan savollar tayyorlang. Ustoz quizni guruh uchun alohida boshlaydi.</p>
        <label>
          Oldingi darsdan savollar qo‘shish
          <select
            value=""
            onChange={(e) => {
              const prev = course.lessons.find((l) => l.id === e.target.value);
              if (!prev) return;
              const qs = [
                ...prev.materials.flatMap((m) =>
                  m.questions.map((q) => ({ ...q, id: crypto.randomUUID() })),
                ),
                ...makeWordQuestions(prev.materials.flatMap((m) => m.words)),
              ];
              if (!qs.length)
                notify('Bu darsda quiz yoki kamida ikkita tarjimali so‘z bo‘lishi kerak.');
              else update({ warmup: [...lesson.warmup, ...qs].slice(0, 30) });
            }}
          >
            <option value="">Darsni tanlang</option>
            {course.lessons
              .filter((l) => l.id !== lesson.id && l.position < lesson.position)
              .map((l) => (
                <option key={l.id} value={l.id}>
                  {l.title}
                </option>
              ))}
          </select>
        </label>
        <QuestionEditor questions={lesson.warmup} onChange={(warmup) => update({ warmup })} />
      </section>
      <div className="course-savebar">
        <span>
          {dirty ? 'O‘zgarishlarni saqlang' : 'Qoralama tayyor'} · {lesson.materials.length}{' '}
          material
        </span>
        <div className="button-row">
          <button className="button secondary" disabled={busy} onClick={save}>
            <Save size={16} />
            Saqlash
          </button>
          <button
            className="button primary"
            disabled={busy || dirty || (!lesson.materials.length && !lesson.youtubeUrl)}
            onClick={() => {
              setPublishMaterials(lesson.materials.map((material) => material.id));
              setPublishVideo(!!lesson.youtubeUrl);
              setOpening(true);
            }}
          >
            <LockKeyhole size={16} />
            Guruhga ochish
          </button>
        </div>
      </div>
      {opening && (
        <Modal title="Materiallarni guruhga ochish" onClose={() => setOpening(false)} wide>
          <p>
            Kerakli video, mavzu va vazifalarni tanlang. Shu dars avval ochilgan bo‘lsa, yangi
            tanlov mavjud darsga qo‘shiladi.
          </p>
          {!groups.length ? (
            <Empty title="Mos guruh yo‘q">
              Avval “Guruhlar” bo‘limida {course.title} guruhini yarating yoki mavjud guruhning
              darajasini tanlang.
            </Empty>
          ) : (
            <form
              className="form-stack"
              onSubmit={async (e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                setBusy(true);
                try {
                  await post(`lessons/${lessonId}/open`, {
                    groupId: fd.get('groupId'),
                    availableAt: new Date(String(fd.get('availableAt'))).toISOString(),
                    dueAt: new Date(String(fd.get('dueAt'))).toISOString(),
                    materialIds: publishMaterials,
                    includeVideo: publishVideo,
                    notify: fd.get('notify') === 'on',
                  });
                  notify('Tanlangan materiallar guruhga ochildi.');
                  setOpening(false);
                  onChange();
                } catch (e) {
                  notify(errorText(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              <label>
                Guruh
                <select name="groupId" required>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                      {catalog.releases.some((r) => r.lesson_id === lessonId && r.group_id === g.id)
                        ? ' · dars ochilgan, material qo‘shish mumkin'
                        : ''}
                    </option>
                  ))}
                </select>
              </label>
              <fieldset className="course-publish-items">
                <legend>Ochiladigan qismlar</legend>
                {lesson.youtubeUrl && (
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={publishVideo}
                      onChange={(event) => setPublishVideo(event.target.checked)}
                    />
                    <Video size={18} />
                    <span>
                      <strong>YouTube video</strong>
                      <small>Dars sahifasining yuqorisida ko‘rinadi</small>
                    </span>
                  </label>
                )}
                {lesson.materials.map((material) => (
                  <label className="checkbox-label" key={material.id}>
                    <input
                      type="checkbox"
                      checked={publishMaterials.includes(material.id)}
                      onChange={(event) =>
                        setPublishMaterials((items) =>
                          event.target.checked
                            ? [...items, material.id]
                            : items.filter((item) => item !== material.id),
                        )
                      }
                    />
                    <span lang="ko">{label(material.kind)?.ko}</span>
                    <span>
                      <strong>{material.title}</strong>
                      <small>
                        {material.task === 'none'
                          ? 'O‘quv materiali'
                          : material.task === 'quiz'
                            ? 'Quiz vazifasi'
                            : 'Uyga vazifa'}
                      </small>
                    </span>
                  </label>
                ))}
              </fieldset>
              <div className="form-two">
                <label>
                  O‘quvchilarga ochiladigan vaqt
                  <input
                    type="datetime-local"
                    name="availableAt"
                    defaultValue={new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
                      .toISOString()
                      .slice(0, 16)}
                    required
                  />
                </label>
                <label>
                  Vazifalar muddati
                  <input
                    type="datetime-local"
                    name="dueAt"
                    defaultValue={new Date(
                      Date.now() + 7 * 86400000 - new Date().getTimezoneOffset() * 60000,
                    )
                      .toISOString()
                      .slice(0, 16)}
                    required
                  />
                </label>
              </div>
              <label className="checkbox-label course-notify-choice">
                <input type="checkbox" name="notify" defaultChecked />
                <span>
                  <strong>O‘quvchilarga xabar yuborish</strong>
                  <small>Telegram ulangan bo‘lsa, xabar ochilish vaqtida yuboriladi.</small>
                </span>
              </label>
              <SubmitButton busy={busy} disabled={!publishMaterials.length && !publishVideo}>
                Tanlanganlarni ochish
              </SubmitButton>
            </form>
          )}
        </Modal>
      )}
      {preview && (
        <Modal title="O‘quvchi ko‘rinishi · Qoralama" onClose={() => setPreview(false)} wide>
          <h2>{lesson.title}</h2>
          <p>{lesson.description}</p>
          {lesson.youtubeUrl && (
            <YouTubePlayer url={lesson.youtubeUrl} title={`${lesson.title} videosi`} />
          )}
          {lesson.materials.map((m) => (
            <MaterialReading
              key={m.id}
              material={m}
              files={files}
              grammars={bank?.grammars || []}
            />
          ))}
          <p className="muted">Bu ko‘rib chiqish oynasi. Vazifalar yuborilmaydi.</p>
        </Modal>
      )}
      {picker && (
        <Modal
          title={picker.kind === 'word' ? 'Lug‘at bazasidan tanlash' : 'Grammatikani tanlash'}
          onClose={() => setPicker(null)}
          wide
        >
          <input
            aria-label="Bazadan qidirish"
            placeholder="Qidirish…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {picker.kind === 'word' ? (
            <div className="course-bank-list">
              {bank?.words
                .filter((w) => `${w.ko} ${w.uz}`.toLowerCase().includes(query.toLowerCase()))
                .slice(0, 100)
                .map((w) => {
                  const m = lesson.materials.find((m) => m.id === picker.id)!;
                  const checked = m.words.some((v) => v.id === w.id);
                  return (
                    <label className="checkbox-label" key={w.id}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          materialUpdate(m.id, {
                            words: checked
                              ? m.words.filter((v) => v.id !== w.id)
                              : [
                                  ...m.words,
                                  {
                                    id: w.id,
                                    ko: w.ko,
                                    uz: w.uz,
                                    example: w.example,
                                    translation: w.translation,
                                  },
                                ],
                          })
                        }
                      />
                      <strong lang="ko">{w.ko}</strong>
                      <span>{w.uz}</span>
                    </label>
                  );
                })}
            </div>
          ) : (
            <GrammarBankPicker
              grammars={bank?.grammars || []}
              selectedIds={
                lesson.materials.find((material) => material.id === picker.id)?.grammarIds || []
              }
              query={query}
              topic={grammarTopic}
              book={grammarBook}
              unit={grammarUnit}
              onTopic={setGrammarTopic}
              onBook={(book) => {
                setGrammarBook(book);
                if (book !== 'seoulte-1a') setGrammarUnit('all');
                if (book === 'seoulte-1a') setGrammarTopic('all');
              }}
              onUnit={setGrammarUnit}
              onToggle={(grammarId, checked) => {
                const material = lesson.materials.find((material) => material.id === picker.id)!;
                materialUpdate(material.id, {
                  grammarIds: checked
                    ? [...new Set([...material.grammarIds, grammarId])]
                    : material.grammarIds.filter((id) => id !== grammarId),
                });
              }}
              onToggleMany={(grammarIds, checked) => {
                const material = lesson.materials.find((material) => material.id === picker.id)!;
                materialUpdate(material.id, {
                  grammarIds: checked
                    ? [...new Set([...material.grammarIds, ...grammarIds])]
                    : material.grammarIds.filter((id) => !grammarIds.includes(id)),
                });
              }}
            />
          )}
          <button className="button primary" onClick={() => setPicker(null)}>
            Tanlanganlarni qo‘shish
          </button>
        </Modal>
      )}
      {ai && (
        <Modal
          title="AI lug‘at yordamchisi"
          onClose={() => {
            if (!aiBusy) setAi(null);
          }}
          wide
        >
          <p>
            Koreyscha so‘zlarni yozing yoki rasm yuboring. Natijani tekshirib, keyin darsga
            qo‘shasiz.
          </p>
          {!ai.startsWith('tg:') && (
            <form className="form-stack" onSubmit={extract}>
              <label>
                Koreyscha so‘zlar
                <textarea
                  name="text"
                  rows={3}
                  maxLength={12000}
                  placeholder="가족, 부모님, 동생…"
                />
              </label>
              <label>
                Rasm · 5 MB gacha
                <input name="image" type="file" accept="image/png,image/jpeg,image/webp" />
              </label>
              <SubmitButton busy={aiBusy}>Tarjima va misollarni tayyorlash</SubmitButton>
            </form>
          )}
          {!!aiSkipped.length && <div className="alert">{aiSkipped.join(' · ')}</div>}
          {aiWords.length > 0 && (
            <>
              <h3>Natijani tekshiring</h3>
              <WordEditor words={aiWords} onChange={setAiWords} />
              <button
                className="button primary"
                disabled={aiBusy}
                onClick={async () => {
                  if (ai.startsWith('tg:')) {
                    setAiBusy(true);
                    try {
                      setLesson(
                        await post<CourseLesson>(
                          `lessons/${lessonId}/word-jobs/${ai.slice(3)}/apply`,
                          { revision: lesson.revision, words: aiWords },
                        ),
                      );
                      setDirty(false);
                      setAi(null);
                      loadJobs();
                      onChange();
                      notify('Telegram so‘zlari qoralamaga saqlandi.');
                    } catch (e) {
                      notify(errorText(e));
                    } finally {
                      setAiBusy(false);
                    }
                  } else {
                    const m = lesson.materials.find((m) => m.id === ai)!;
                    materialUpdate(ai, { words: [...m.words, ...aiWords] });
                    setAi(null);
                    notify('So‘zlar qoralamaga qo‘shildi. Darsni saqlang.');
                  }
                }}
              >
                Darsga qo‘shish · {aiWords.length} so‘z
              </button>
            </>
          )}
        </Modal>
      )}
      {confirmBack && (
        <Modal title="Saqlanmagan o‘zgarishlar bor" onClose={() => setConfirmBack(false)}>
          <p>Dasturga qaytishdan oldin qoralamani saqlang.</p>
          <div className="button-row">
            <button
              className="button primary"
              disabled={busy}
              onClick={async () => {
                if (await save()) onBack();
              }}
            >
              Saqlash va qaytish
            </button>
            <button className="button secondary" onClick={onBack}>
              Saqlamasdan chiqish
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
function GrammarBankPicker({
  grammars,
  selectedIds,
  query,
  topic,
  book,
  unit,
  onTopic,
  onBook,
  onUnit,
  onToggle,
  onToggleMany,
}: {
  grammars: Grammar[];
  selectedIds: string[];
  query: string;
  topic: 'all' | GrammarTopicId;
  book: GrammarBookFilter;
  unit: string;
  onTopic: (topic: 'all' | GrammarTopicId) => void;
  onBook: (book: GrammarBookFilter) => void;
  onUnit: (unit: string) => void;
  onToggle: (grammarId: string, checked: boolean) => void;
  onToggleMany: (grammarIds: string[], checked: boolean) => void;
}) {
  const normalizedQuery = query.trim().toLocaleLowerCase('uz');
  const matching = grammars.filter((grammar) => {
    const matchesQuery = `${grammar.form} ${grammar.meaning} ${grammar.syntax}`
      .toLocaleLowerCase('uz')
      .includes(normalizedQuery);
    const matchesBook =
      book === 'all' ||
      (book === 'seoulte-1a' && isSeoulte1AGrammar(grammar.id)) ||
      (book === 'topik' && !isSeoulte1AGrammar(grammar.id));
    const matchesUnit = unit === 'all' || !!seoulte1AUnit(unit)?.grammarIds.includes(grammar.id);
    return (
      matchesQuery &&
      matchesBook &&
      matchesUnit &&
      (topic === 'all' || grammarTopicFor(grammar).id === topic)
    );
  });
  const groups =
    book === 'seoulte-1a'
      ? SEOULTE_1A_UNITS.map((item) => ({
          id: item.id,
          ko: `${item.position}과 · ${item.koTitle}`,
          label: `${item.position}-mavzu · ${item.title}`,
          description: item.description,
          grammars: matching.filter((grammar) => item.grammarIds.includes(grammar.id)),
        })).filter((item) => item.grammars.length > 0)
      : groupGrammarsByTopic(matching);
  const matchingIds = matching.map((grammar) => grammar.id);
  const allMatchingSelected =
    matchingIds.length > 0 && matchingIds.every((grammarId) => selectedIds.includes(grammarId));
  return (
    <div className="course-grammar-picker">
      <div className="course-grammar-picker-summary">
        <div>
          <strong>Grammatika mavzulari</strong>
          <span>Kitob → mavzu → grammatika filtrlari orqali kerakli qoidalarni tez tanlang.</span>
        </div>
        <Badge tone="blue">{selectedIds.length} ta tanlangan</Badge>
      </div>
      <div className="course-grammar-curriculum-filters">
        <label>
          Kitob
          <select
            aria-label="Grammatika bazasi kitobi"
            value={book}
            onChange={(event) => onBook(event.target.value as GrammarBookFilter)}
          >
            <option value="all">Barcha manbalar</option>
            <option value="seoulte-1a">Seoulte 1A</option>
            <option value="topik">TOPIK va qo‘shimcha</option>
          </select>
        </label>
        <label>
          Kitob mavzusi
          <select
            aria-label="Grammatika bazasi mavzusi"
            value={unit}
            disabled={book !== 'seoulte-1a'}
            onChange={(event) => onUnit(event.target.value)}
          >
            <option value="all">Seoulte 1A · barcha mavzular</option>
            {SEOULTE_1A_UNITS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.position}-mavzu · {item.koTitle} · {item.title}
              </option>
            ))}
          </select>
        </label>
      </div>
      {book !== 'seoulte-1a' && (
        <div className="course-grammar-topic-filters" aria-label="Grammatika mavzulari">
          <button
            className={topic === 'all' ? 'active' : ''}
            aria-pressed={topic === 'all'}
            onClick={() => onTopic('all')}
          >
            <span>Barcha vazifalar</span>
            <small>{grammars.length}</small>
          </button>
          {GRAMMAR_TOPICS.map((item) => (
            <button
              key={item.id}
              className={topic === item.id ? 'active' : ''}
              aria-pressed={topic === item.id}
              onClick={() => onTopic(item.id)}
            >
              <span>{item.label}</span>
              <small>
                {
                  grammars.filter(
                    (grammar) =>
                      (book !== 'topik' || !isSeoulte1AGrammar(grammar.id)) &&
                      grammarTopicFor(grammar).id === item.id,
                  ).length
                }
              </small>
            </button>
          ))}
        </div>
      )}
      <div className="course-grammar-bulk-actions">
        <span>{matching.length} ta grammatika ko‘rsatilmoqda</span>
        {matchingIds.length > 0 && matchingIds.length <= 30 && (
          <button
            className="text-button"
            onClick={() => onToggleMany(matchingIds, !allMatchingSelected)}
          >
            {allMatchingSelected
              ? 'Ko‘rinayotganlarni bekor qilish'
              : 'Ko‘rinayotgan barchasini tanlash'}
          </button>
        )}
      </div>
      <div className="course-bank-list course-grammar-bank-list">
        {!groups.length && (
          <Empty title="Mos grammatika topilmadi">Boshqa so‘z bilan qidiring.</Empty>
        )}
        {groups.map((group) => (
          <section key={group.id} className="course-grammar-bank-group">
            <header>
              <div>
                <span lang="ko">{group.ko}</span>
                <strong>{group.label}</strong>
                <small>{group.description}</small>
              </div>
              <Badge tone="neutral">{group.grammars.length} ta</Badge>
            </header>
            {group.grammars.map((grammar) => {
              const checked = selectedIds.includes(grammar.id);
              return (
                <label className="checkbox-label" key={grammar.id}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) => onToggle(grammar.id, event.target.checked)}
                  />
                  <strong lang="ko">{grammar.form}</strong>
                  <span>{grammar.meaning}</span>
                </label>
              );
            })}
          </section>
        ))}
      </div>
    </div>
  );
}
function WordEditor({
  words,
  onChange,
}: {
  words: LessonWord[];
  onChange: (v: LessonWord[]) => void;
}) {
  return (
    <div className="course-word-editor">
      {words.map((w, i) => (
        <div className="course-word-row" key={w.id}>
          <span>{i + 1}</span>
          <div>
            <div className="form-two">
              <label>
                Koreyscha
                <input
                  value={w.ko}
                  maxLength={100}
                  onChange={(e) =>
                    onChange(words.map((v) => (v.id === w.id ? { ...v, ko: e.target.value } : v)))
                  }
                />
              </label>
              <label>
                O‘zbekcha
                <input
                  value={w.uz}
                  maxLength={250}
                  onChange={(e) =>
                    onChange(words.map((v) => (v.id === w.id ? { ...v, uz: e.target.value } : v)))
                  }
                />
              </label>
            </div>
            <details>
              <summary>Misol va tarjima</summary>
              <label>
                Koreyscha misol
                <input
                  value={w.example}
                  onChange={(e) =>
                    onChange(
                      words.map((v) => (v.id === w.id ? { ...v, example: e.target.value } : v)),
                    )
                  }
                />
              </label>
              <label>
                Misol tarjimasi
                <input
                  value={w.translation}
                  onChange={(e) =>
                    onChange(
                      words.map((v) => (v.id === w.id ? { ...v, translation: e.target.value } : v)),
                    )
                  }
                />
              </label>
            </details>
          </div>
          <button
            className="icon-button"
            aria-label="So‘zni olib tashlash"
            onClick={() => onChange(words.filter((v) => v.id !== w.id))}
          >
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
function QuestionEditor({
  questions,
  onChange,
}: {
  questions: LessonQuestion[];
  onChange: (q: LessonQuestion[]) => void;
}) {
  const edit = (i: number, patch: Partial<LessonQuestion>) =>
    onChange(questions.map((q, j) => (j === i ? { ...q, ...patch } : q)));
  return (
    <div className="course-questions">
      {questions.map((q, i) => (
        <details key={q.id} open={i === questions.length - 1}>
          <summary>
            {i + 1}. {q.prompt || 'Yangi savol'}
          </summary>
          <label>
            Savol
            <input value={q.prompt} onChange={(e) => edit(i, { prompt: e.target.value })} />
          </label>
          <div className="course-options-editor">
            {q.options.map((opt, j) => (
              <label key={j}>
                <input
                  type="radio"
                  name={`answer-${q.id}`}
                  aria-label={`${j + 1}-variant to‘g‘ri`}
                  checked={q.answer === j}
                  onChange={() => edit(i, { answer: j })}
                />
                <input
                  aria-label={`${j + 1}-variant`}
                  value={opt}
                  onChange={(e) =>
                    edit(i, { options: q.options.map((v, k) => (k === j ? e.target.value : v)) })
                  }
                />
              </label>
            ))}
          </div>
          <small>To‘g‘ri javob yonidagi doirani belgilang.</small>
          <label>
            Javob izohi
            <textarea
              rows={2}
              value={q.explanation || ''}
              onChange={(e) => edit(i, { explanation: e.target.value })}
            />
          </label>
          <button
            className="text-button"
            onClick={() => onChange(questions.filter((_, j) => j !== i))}
          >
            <Trash2 size={14} />
            Savolni olib tashlash
          </button>
        </details>
      ))}
      <button
        className="button secondary"
        disabled={questions.length >= 30}
        onClick={() => onChange([...questions, blankQuestion()])}
      >
        <Plus size={16} />
        Savol qo‘shish
      </button>
    </div>
  );
}
function MaterialReading({
  material: m,
  files,
  grammars,
}: {
  material: LessonMaterial;
  files: CourseFile[];
  grammars: Grammar[];
}) {
  const materialYoutube = youtubeEmbedUrl(m.url);
  const [selectedGrammarId, setSelectedGrammarId] = useState<string | null>(null);
  const grammarGroups = groupGrammarsByTopic(
    m.grammarIds.flatMap((id) => {
      const grammar = grammars.find((item) => item.id === id);
      return grammar ? [grammar] : [];
    }),
  );
  const selectedGrammar = grammars.find((grammar) => grammar.id === selectedGrammarId);
  return (
    <div className="course-reading">
      <div className="section-title">
        <Badge tone="green">
          {label(m.kind)?.ko} · {label(m.kind)?.label}
        </Badge>
        {m.task !== 'none' && (
          <Badge tone="neutral">{m.required ? 'Majburiy vazifa' : 'Ixtiyoriy'}</Badge>
        )}
      </div>
      <h3>{m.title}</h3>
      {m.body && (
        <p className="course-preserve" lang="ko">
          {m.body}
        </p>
      )}
      {grammarGroups.length > 0 && (
        <div className="course-grammar-topics">
          <div className="course-grammar-topics-intro">
            <span className="course-grammar-topics-icon">
              <BookOpen size={21} />
            </span>
            <div>
              <strong>Shu dars grammatikasi</strong>
              <span>Grammatikani bosib, qoida va misollar bilan o‘rganing.</span>
            </div>
          </div>
          {grammarGroups.map((group) => (
            <section className="course-grammar-topic" key={group.id}>
              <header>
                <div>
                  <span lang="ko">{group.ko}</span>
                  <h4>{group.label}</h4>
                </div>
                <small>{group.grammars.length} ta grammatika</small>
              </header>
              <div className="course-grammar-grid">
                {group.grammars.map((grammar) => (
                  <button
                    key={grammar.id}
                    className="course-grammar-card"
                    onClick={() => setSelectedGrammarId(grammar.id)}
                    aria-label={`${grammar.form} grammatikasini o‘rganish`}
                  >
                    <span className="course-grammar-card-top">
                      <strong lang="ko">{grammar.form}</strong>
                      <ArrowRight size={18} />
                    </span>
                    <span>{grammar.meaning}</span>
                    <small>Qoida · misol · mashq</small>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
      {m.words.length > 0 && <WordGames words={m.words} />}
      {m.fileIds.map((fid) => {
        const f = files.find((f) => f.id === fid);
        return f ? (
          <div className="course-file" key={fid}>
            {f.mime.startsWith('audio/') || f.mime === 'application/ogg' ? (
              <audio controls preload="none" src={`/api/courses/files/${fid}`} />
            ) : f.mime.startsWith('image/') ? (
              <a href={`/api/courses/files/${fid}`} target="_blank" rel="noreferrer">
                <img alt={f.name} src={`/api/courses/files/${fid}`} />
              </a>
            ) : null}
            <a href={`/api/courses/files/${fid}`} target="_blank" rel="noreferrer">
              <FileText size={16} />
              {f.name}
            </a>
          </div>
        ) : null;
      })}
      {materialYoutube ? (
        <YouTubePlayer url={m.url} title={`${m.title} videosi`} />
      ) : m.url && /^https?:\/\//i.test(m.url) ? (
        <a className="button secondary" href={m.url} target="_blank" rel="noopener noreferrer">
          Qo‘shimcha materialni ochish <ArrowRight size={16} />
        </a>
      ) : null}
      {m.topikCategory && (
        <a
          className="button secondary"
          href={`/topik?category=${encodeURIComponent(m.topikCategory)}`}
        >
          TOPIK 읽기 {m.topikCategory} mashqlari <ArrowRight size={16} />
        </a>
      )}
      {selectedGrammar && (
        <Modal
          title={`${selectedGrammar.form} · Grammatika darsi`}
          onClose={() => setSelectedGrammarId(null)}
          wide
        >
          <div className="course-grammar-lesson-heading">
            <Badge tone="blue">{grammarTopicFor(selectedGrammar).label}</Badge>
            <p>{selectedGrammar.meaning}</p>
          </div>
          <GrammarLesson
            key={selectedGrammar.id}
            grammar={selectedGrammar}
            grammars={grammars}
            correctDays={0}
            showMastery={false}
          />
        </Modal>
      )}
    </div>
  );
}

function YouTubePlayer({
  url,
  title,
  compact = false,
}: {
  url: string;
  title: string;
  compact?: boolean;
}) {
  const embedUrl = youtubeEmbedUrl(url);
  if (!embedUrl) return null;
  return (
    <div className={`course-youtube ${compact ? 'compact' : ''}`}>
      <div className="course-youtube-heading">
        <span>
          <Video size={19} /> Video dars
        </span>
        <a href={url} target="_blank" rel="noopener noreferrer">
          YouTube’da ochish <ArrowRight size={15} />
        </a>
      </div>
      <div className="course-youtube-frame">
        <iframe
          src={embedUrl}
          title={title}
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>
    </div>
  );
}
function WordGames({ words }: { words: LessonWord[] }) {
  const [mode, setMode] = useState<'list' | 'cards' | 'quiz' | 'pairs'>('list'),
    [index, setIndex] = useState(0),
    [flipped, setFlipped] = useState(false),
    [choice, setChoice] = useState<number | null>(null),
    [questions, setQuestions] = useState<LessonQuestion[]>([]),
    [selected, setSelected] = useState<string | null>(null),
    [matched, setMatched] = useState<string[]>([]),
    [mistake, setMistake] = useState(false);
  const w = words[index % words.length],
    q = questions[index % Math.max(questions.length, 1)];
  const pairWords = words.slice(0, 8);
  return (
    <div className="course-word-games">
      <div className="course-game-tabs">
        {(['list', 'cards', 'quiz', 'pairs'] as const).map((m, i) => (
          <button
            key={m}
            className={mode === m ? 'active' : ''}
            onClick={() => {
              setMode(m);
              setIndex(0);
              setFlipped(false);
              setChoice(null);
              setQuestions(makeWordQuestions(words));
              setMatched([]);
              setSelected(null);
            }}
          >
            {['Tarjimalar', 'Kartochka', 'Mini quiz', 'Juftliklar'][i]}
          </button>
        ))}
      </div>
      {mode === 'list' ? (
        <div className="course-word-list">
          {words.map((w) => (
            <div key={w.id}>
              <strong lang="ko">{w.ko}</strong>
              <span>{w.uz}</span>
              {w.example && (
                <small>
                  <span lang="ko">{w.example}</span>
                  <br />
                  {w.translation}
                </small>
              )}
            </div>
          ))}
        </div>
      ) : mode === 'cards' ? (
        <>
          <button className="course-flashcard" onClick={() => setFlipped(!flipped)}>
            <small>
              {index + 1} / {words.length} · Tarjimani ko‘rish uchun bosing
            </small>
            <strong lang={flipped ? 'uz' : 'ko'}>{flipped ? w.uz : w.ko}</strong>
            <span>{flipped ? w.translation : w.example}</span>
          </button>
          <button
            className="button secondary"
            onClick={() => {
              setIndex((index + 1) % words.length);
              setFlipped(false);
            }}
          >
            Keyingi so‘z <ArrowRight size={16} />
          </button>
        </>
      ) : mode === 'quiz' ? (
        q ? (
          <div className="course-mini-quiz">
            <h3 lang="ko">{q.prompt}</h3>
            {q.options.map((o, i) => (
              <button
                key={i}
                className={`course-answer ${choice !== null && i === q.answer ? 'correct' : ''}`}
                disabled={choice !== null}
                onClick={() => setChoice(i)}
              >
                {o}
              </button>
            ))}
            {choice !== null && (
              <>
                <p>
                  {choice === q.answer ? 'To‘g‘ri!' : 'Qayta eslab qoling:'} {q.options[q.answer!]}
                </p>
                <button
                  className="button secondary"
                  onClick={() => {
                    setIndex((index + 1) % questions.length);
                    setChoice(null);
                  }}
                >
                  Keyingi savol
                </button>
              </>
            )}
          </div>
        ) : (
          <p>Quiz uchun kamida ikki xil tarjimali so‘z kerak.</p>
        )
      ) : (
        <>
          <div className="course-pairs">
            <div>
              {pairWords.map((w) => (
                <button
                  key={w.id}
                  disabled={matched.includes(w.id)}
                  className={selected === w.id ? 'selected' : ''}
                  onClick={() => {
                    setSelected(w.id);
                    setMistake(false);
                  }}
                  lang="ko"
                >
                  {w.ko}
                </button>
              ))}
            </div>
            <div>
              {[...pairWords].reverse().map((w) => (
                <button
                  key={w.id}
                  disabled={matched.includes(w.id) || !selected}
                  onClick={() => {
                    if (selected === w.id) {
                      setMatched([...matched, w.id]);
                      setSelected(null);
                      setMistake(false);
                    } else setMistake(true);
                  }}
                >
                  {w.uz}
                </button>
              ))}
            </div>
          </div>
          <p role="status">
            {matched.length === pairWords.length
              ? 'Barcha juftliklar topildi!'
              : mistake
                ? 'Bu juftlik mos kelmadi. Yana urinib ko‘ring.'
                : 'Avval koreyscha so‘zni, keyin tarjimasini tanlang.'}
          </p>
        </>
      )}
    </div>
  );
}
export function CourseHome({
  data,
  name,
  go,
}: {
  data: CourseStudentState;
  name: string;
  go: (p: string) => void;
}) {
  const tasks = data.releases.flatMap((r) => r.tasks),
    done = tasks.filter((t) => t.status === 'done').length;
  return (
    <div className="course-space">
      <div className="page-heading">
        <div>
          <span className="eyebrow">나의 배움 · {data.groupName}</span>
          <h1>안녕하세요, {name.split(' ')[0]}!</h1>
          <p>Bugungi kichik qadam — ertangi katta natija.</p>
        </div>
        <Badge tone="green">{COURSE_LEVELS.find((l) => l.id === data.level)?.label}</Badge>
      </div>
      <div className="course-progress-hero">
        <div>
          <span className="eyebrow">MENING VAZIFALARIM</span>
          <h2>
            {done} <small>/ {tasks.length} bajarilgan</small>
          </h2>
          <progress value={done} max={Math.max(tasks.length, 1)} />
          <p>
            {tasks.some((t) => t.status === 'submitted')
              ? 'Yuborilgan ishlaringiz ustoz tekshiruvida.'
              : tasks.length > done
                ? 'Qolgan vazifalardan birini davom ettiring.'
                : 'Har kuni birga o‘rganamiz.'}
          </p>
        </div>
        <div className="course-points">
          <Trophy size={28} />
          <strong>{data.points} ball</strong>
          <span>
            {data.points >= 100
              ? 'Kitob sovg‘asi uchun marraga yetdingiz!'
              : `Kitob sovg‘asigacha yana ${100 - data.points} ball.`}
          </span>
        </div>
      </div>
      {!data.releases.length ? (
        <section className="panel">
          <Empty title="Ustoz darslarni tayyorlamoqda">
            Guruhingiz uchun dars ochilgach, materiallar va vazifalar shu yerda ko‘rinadi.
          </Empty>
        </section>
      ) : (
        <div className="course-lesson-list">
          {data.releases.map((r) => (
            <button className="course-lesson-row" key={r.id} onClick={() => go(`/lessons/${r.id}`)}>
              <span className="course-step">{String(r.position).padStart(2, '0')}</span>
              <div>
                <strong>{r.title}</strong>
                <p>
                  {r.lesson_date} · {r.tasks.filter((t) => t.status === 'done').length}/
                  {r.tasks.length} vazifa bajarilgan
                </p>
                <div className="course-home-tasks">
                  {r.tasks.map((t) => (
                    <span key={t.materialId} className={t.status}>
                      <span>
                        {t.status === 'done' ? '✓' : t.status === 'submitted' ? '◷' : '○'}
                      </span>
                      <span>
                        {label(t.kind)?.ko} · {t.title}
                      </span>
                      <small>
                        {t.status === 'done'
                          ? 'Bajarilgan'
                          : t.status === 'submitted'
                            ? 'Tekshiruvda'
                            : 'Bajarish kerak'}
                      </small>
                    </span>
                  ))}
                </div>
                <div className="button-row">
                  {r.liveQuiz && <Badge tone="green">Quiz boshlandi</Badge>}
                  {r.tasks.some((t) => t.status === 'todo') && (
                    <Badge tone="neutral">Bajarilmagan vazifa bor</Badge>
                  )}
                  {r.tasks.some((t) => t.status === 'submitted') && (
                    <Badge tone="neutral">Tekshiruvda</Badge>
                  )}
                </div>
              </div>
              <ArrowRight size={20} />
            </button>
          ))}
        </div>
      )}
      <div className="course-practice-links">
        <button onClick={() => go('/vocabulary')}>
          <Layers3 size={22} />
          <strong>Lug‘atni takrorlash</strong>
          <span>Ochiq darslaringizdagi so‘zlar</span>
        </button>
        <button onClick={() => go('/lessons')}>
          <BookOpen size={22} />
          <strong>Oldingi darslar</strong>
          <span>Bilimingizni mustahkamlang</span>
        </button>
        <button onClick={() => go('/my-group')}>
          <Trophy size={22} />
          <strong>Guruhim</strong>
          <span>Vazifalar va umumiy natijalar</span>
        </button>
      </div>
    </div>
  );
}
export function StudentLesson({
  releaseId,
  notify,
}: {
  releaseId: string;
  notify: (s: string) => void;
}) {
  const [lesson, setLesson] = useState<ReturnType<typeof lessonView> | null>(null),
    [error, setError] = useState('');
  const load = useCallback(async () => {
    try {
      setLesson(await api(`courses/releases/${releaseId}`));
      setError('');
    } catch (e) {
      setError(errorText(e));
    }
  }, [releaseId]);
  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    if (!lesson || !window.location.hash.startsWith('#material-')) return;
    document.getElementById(window.location.hash.slice(1))?.scrollIntoView({ block: 'start' });
  }, [lesson]);
  if (!lesson)
    return (
      <div className="panel course-editor-meta">
        {error || 'Dars yuklanmoqda…'}
        <a href="/lessons">Darslarimga qaytish</a>
      </div>
    );
  return (
    <div className="course-space">
      <a href="/lessons" className="text-button">
        <ArrowLeft size={16} />
        Darslarim
      </a>
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            {lesson.lesson_date} · {lesson.position}-DARS
          </span>
          <h1>{lesson.title}</h1>
          <p>{lesson.snapshot.description}</p>
        </div>
        <Badge tone="green">O‘rganishda davom eting</Badge>
      </div>
      {lesson.snapshot.youtubeUrl && (
        <YouTubePlayer url={lesson.snapshot.youtubeUrl} title={`${lesson.title} video darsi`} />
      )}
      <LiveQuiz releaseId={releaseId} teacher={false} notify={notify} />
      {lesson.snapshot.materials.map((m) => (
        <section
          className="panel course-student-material"
          id={`material-${m.id}`}
          style={{ scrollMarginTop: 20 }}
          key={m.id}
        >
          <MaterialReading material={m} files={lesson.files} grammars={lesson.grammars} />
          {m.task !== 'none' && (
            <MaterialTask
              key={`${m.id}-${lesson.tasks.find((t) => t.materialId === m.id)?.status}`}
              releaseId={releaseId}
              material={m}
              status={lesson.tasks.find((t) => t.materialId === m.id)!}
              dueAt={lesson.tasks.find((t) => t.materialId === m.id)?.dueAt || lesson.due_at}
              notify={notify}
              refresh={load}
            />
          )}
        </section>
      ))}
    </div>
  );
}
function MaterialTask({
  releaseId,
  material: m,
  status,
  dueAt,
  notify,
  refresh,
}: {
  releaseId: string;
  material: LessonMaterial;
  status: TaskStatus;
  dueAt: string;
  notify: (s: string) => void;
  refresh: () => void;
}) {
  const [busy, setBusy] = useState(false),
    [answers, setAnswers] = useState<number[]>(Array(m.questions.length).fill(-1)),
    [result, setResult] = useState<{
      score: number;
      total: number;
      solutions: LessonQuestion[];
    } | null>(null);
  async function complete() {
    setBusy(true);
    try {
      setResult(await post(`releases/${releaseId}/complete`, { materialId: m.id, answers }));
      if (m.task !== 'quiz') refresh();
    } catch (e) {
      notify(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  if (status.status !== 'todo')
    return (
      <div className={`course-task-status ${status.status}`}>
        <Check size={18} />
        <div>
          <strong>
            {status.status === 'done' ? 'Bajarilgan' : 'Topshirildi · ustoz tekshiruvida'}
          </strong>
          {status.total && (
            <p>
              Natija: {status.score}/{status.total}
            </p>
          )}
          {status.feedback && <p>{status.feedback}</p>}
        </div>
      </div>
    );
  return (
    <>
      {status.outcome === 'fail' && (
        <div className="course-task-status fail">
          <X size={18} />
          <div>
            <strong>Fail · vazifani qayta topshiring</strong>
            {status.feedback && <p>{status.feedback}</p>}
          </div>
        </div>
      )}
      <div className="course-task">
        <div className="section-title">
          <h3>{status.outcome === 'fail' ? 'Qayta topshirish' : 'Vazifa · bajarish kerak'}</h3>
          <small>Muddat: {new Date(dueAt).toLocaleString('uz-UZ')}</small>
        </div>
        {m.task === 'self' ? (
          <>
            <p>
              Materialni o‘rganib bo‘lgach belgilang. Bu sizning tasdig‘ingiz sifatida qayd etiladi.
            </p>
            <button className="button primary" disabled={busy} onClick={complete}>
              <Check size={17} />
              Bajardim
            </button>
          </>
        ) : m.task === 'quiz' ? (
          result ? (
            <div>
              <h3>
                {result.score}/{result.total} to‘g‘ri javob
              </h3>
              {result.solutions.map((q) => (
                <p key={q.id}>
                  {q.prompt}
                  <br />
                  <strong>{q.options[q.answer!]}</strong> · {q.explanation}
                </p>
              ))}
              <button className="button primary" onClick={refresh}>
                Natijani ko‘rish
              </button>
            </div>
          ) : (
            <>
              <AnswerQuestions questions={m.questions} answers={answers} setAnswers={setAnswers} />
              <button
                className="button primary"
                disabled={busy || answers.includes(-1)}
                onClick={complete}
              >
                Javoblarni tekshirish
              </button>
            </>
          )
        ) : (
          <SubmissionForm
            task={m.task}
            assignmentId={status.assignmentId!}
            notify={notify}
            refresh={refresh}
          />
        )}
      </div>
    </>
  );
}
function AnswerQuestions({
  questions,
  answers,
  setAnswers,
}: {
  questions: LessonQuestion[];
  answers: number[];
  setAnswers: (a: number[]) => void;
}) {
  return (
    <div className="course-answer-questions">
      {questions.map((q, i) => (
        <fieldset key={q.id}>
          <legend>
            {i + 1}. {q.prompt}
          </legend>
          {q.options.map((o, j) => (
            <label key={j} className={answers[i] === j ? 'selected' : ''}>
              <input
                type="radio"
                name={q.id}
                checked={answers[i] === j}
                onChange={() =>
                  setAnswers(questions.map((_, k) => (k === i ? j : (answers[k] ?? -1))))
                }
              />
              {o}
            </label>
          ))}
        </fieldset>
      ))}
    </div>
  );
}
function SubmissionForm({
  task,
  assignmentId,
  notify,
  refresh,
}: {
  task: string;
  assignmentId: string;
  notify: (s: string) => void;
  refresh: () => void;
}) {
  const [busy, setBusy] = useState(false),
    [recording, setRecording] = useState(false),
    [audio, setAudio] = useState<File | null>(null);
  const recorder = useRef<MediaRecorder | null>(null),
    stream = useRef<MediaStream | null>(null);
  useEffect(
    () => () => {
      if (recorder.current?.state === 'recording') recorder.current.stop();
      stream.current?.getTracks().forEach((t) => t.stop());
    },
    [],
  );
  async function record() {
    if (recording) {
      recorder.current?.stop();
      return;
    }
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder)
        throw new Error('Bu brauzerda yozib olish mavjud emas. Audio fayl yuklang.');
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = s;
      const rec = new MediaRecorder(s);
      recorder.current = rec;
      const chunks: BlobPart[] = [];
      let size = 0;
      rec.ondataavailable = (e) => {
        size += e.data.size;
        chunks.push(e.data);
        if (size > 19 * 1024 * 1024 && rec.state === 'recording') rec.stop();
      };
      rec.onstop = () => {
        setRecording(false);
        s.getTracks().forEach((t) => t.stop());
        const mime = rec.mimeType.split(';')[0];
        setAudio(
          new File(chunks, `ovozli-javob.${mime.includes('mp4') ? 'm4a' : 'webm'}`, { type: mime }),
        );
      };
      rec.start(1000);
      setRecording(true);
    } catch (e) {
      notify(errorText(e));
    }
  }
  return (
    <form
      className="form-stack"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const form = new FormData(e.currentTarget);
        form.set('assignmentId', assignmentId);
        if (audio) form.append('files', audio);
        try {
          await api('submissions', { method: 'POST', body: form });
          notify('Vazifa ustozga yuborildi.');
          refresh();
        } catch (e) {
          notify(errorText(e));
        } finally {
          setBusy(false);
        }
      }}
    >
      <label>
        Javobingiz
        <textarea
          name="body"
          rows={4}
          required={task === 'text'}
          maxLength={16000}
          placeholder={
            task === 'audio' ? 'Ovozli javobga izoh (ixtiyoriy)' : 'Javobingizni shu yerga yozing…'
          }
        />
      </label>
      {task === 'audio' && (
        <div className="button-row">
          <button type="button" className="button secondary" onClick={record}>
            <Mic size={17} />
            {recording ? 'Yozishni tugatish' : 'Ovoz yozish'}
          </button>
          {audio && <span>{audio.name} · tayyor</span>}
        </div>
      )}
      <label>
        {task === 'audio' ? 'Audio fayl · 20 MB gacha' : 'Rasm yoki PDF · har biri 5 MB gacha'}
        <input
          type="file"
          name="files"
          multiple={task !== 'audio'}
          required={(task === 'audio' && !audio) || task === 'upload'}
          accept={
            task === 'audio' ? 'audio/*,.m4a' : 'image/png,image/jpeg,image/webp,application/pdf'
          }
        />
      </label>
      <SubmitButton busy={busy || recording}>Ustozga topshirish</SubmitButton>
    </form>
  );
}
type LiveData = {
  status: string;
  total?: number;
  questions: LessonQuestion[];
  attempt: { completed_at: string | null; score: number | null; elapsed_ms: number | null } | null;
  results: { name: string; score: number; elapsed_ms: number }[];
};
function LiveQuiz({
  releaseId,
  teacher,
  notify,
}: {
  releaseId: string;
  teacher: boolean;
  notify: (s: string) => void;
}) {
  const [data, setData] = useState<LiveData | null>(null),
    [answers, setAnswers] = useState<number[]>([]),
    [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try {
      setData(await api(`courses/releases/${releaseId}/live`));
    } catch {}
  }, [releaseId]);
  useEffect(() => {
    load();
    const timer = setInterval(load, 7000);
    return () => clearInterval(timer);
  }, [load]);
  async function act(action: string) {
    setBusy(true);
    try {
      const r = await post<LiveData>(`releases/${releaseId}/live`, { action, answers });
      setData(r);
      if (action === 'start') setAnswers(r.questions.map(() => -1));
    } catch (e) {
      notify(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  if (!data || (!teacher && data.status === 'waiting')) return null;
  return (
    <section className="course-live panel">
      <div className="section-title">
        <div>
          <span className="eyebrow">함께 도전 · DARS QUIZI</span>
          <h2>Birga takrorlaymiz</h2>
        </div>
        <Badge tone={data.status === 'open' ? 'green' : 'neutral'}>
          {data.status === 'open' ? 'Ochiq' : data.status === 'closed' ? 'Yakunlangan' : 'Tayyor'}
        </Badge>
      </div>
      {teacher ? (
        <>
          <p>
            Avval to‘g‘ri javoblar soni, teng bo‘lsa sarflangan vaqt hisoblanadi. Natijalar quiz
            yopilgach guruhga ko‘rinadi.
          </p>
          {data.status === 'waiting' ? (
            <button className="button primary" disabled={busy} onClick={() => act('open')}>
              Quizni boshlash
            </button>
          ) : data.status === 'open' ? (
            <button className="button secondary" disabled={busy} onClick={() => act('close')}>
              Quizni yakunlash
            </button>
          ) : null}
        </>
      ) : data.attempt?.completed_at ? (
        <p>
          Javobingiz qabul qilindi. {data.attempt.score}/{data.total} to‘g‘ri ·{' '}
          {Math.round((data.attempt.elapsed_ms || 0) / 1000)} soniya.
        </p>
      ) : data.status === 'open' ? (
        data.questions.length ? (
          <>
            <AnswerQuestions questions={data.questions} answers={answers} setAnswers={setAnswers} />
            <button
              className="button primary"
              disabled={busy || answers.length !== data.questions.length || answers.includes(-1)}
              onClick={() => act('submit')}
            >
              Quizni topshirish
            </button>
          </>
        ) : (
          <>
            <p>Ustoz takrorlash quizini ochdi. Vaqt “Boshlash” tugmasidan hisoblanadi.</p>
            <button className="button primary" disabled={busy} onClick={() => act('start')}>
              Boshlash
            </button>
          </>
        )
      ) : null}
      {data.results.length > 0 && (
        <div className="course-live-results">
          {data.results.map((r, i) => (
            <div key={i}>
              <strong>
                {i + 1}. {r.name}
              </strong>
              <span>
                {r.score}/{data.total} to‘g‘ri
              </span>
              <span>{(r.elapsed_ms / 1000).toFixed(1)} s</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
export function GroupBoard({
  groupId,
  teacher,
  notify,
}: {
  groupId: string;
  teacher: boolean;
  notify: (s: string) => void;
}) {
  const [data, setData] = useState<ReturnType<typeof courseBoard> | null>(null),
    [selected, setSelected] = useState<
      ReturnType<typeof courseBoard>['submissions'][number] | null
    >(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const load = useCallback(async () => {
    try {
      setData(await api(`courses/board/${groupId}`));
      setError('');
    } catch (e) {
      setError(errorText(e));
    }
  }, [groupId]);
  useEffect(() => {
    load();
  }, [load]);
  async function points(releaseId: string, userId: string, n: number) {
    setBusy(true);
    try {
      await post(`releases/${releaseId}/points`, { userId, points: n });
      await load();
      notify('Dars balli saqlandi.');
    } catch (e) {
      notify(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  if (!data) return <p>{error || 'Guruh natijalari yuklanmoqda…'}</p>;
  return (
    <div className="course-space">
      <div className="page-heading">
        <div>
          <span className="eyebrow">우리 반 · BIRGA O‘SAMIZ</span>
          <h1>Guruhim</h1>
          <p>✅ Success · ❌ Fail · ⏳ Tekshiruvda · ○ Bajarish kerak</p>
        </div>
        <button className="button secondary" onClick={load}>
          Yangilash
        </button>
      </div>
      {!data.releases.length ? (
        <Empty title="Hali dars ochilmagan">
          Darslar ochilgach, vazifalar va ball shu yerda ko‘rinadi.
        </Empty>
      ) : (
        <div className="panel course-board-wrap">
          <table className="course-board">
            <thead>
              <tr>
                <th>O‘quvchi</th>
                {data.releases.map((r) => (
                  <th key={r.id}>
                    {r.lesson_date}
                    <small>{r.title}</small>
                  </th>
                ))}
                <th>Jami ball</th>
              </tr>
            </thead>
            <tbody>
              {data.students.map((s) => (
                <tr key={s.id}>
                  <th>{s.name}</th>
                  {s.lessons.map((l) => (
                    <td key={l.releaseId}>
                      <span
                        aria-label={
                          l.status === 'done'
                            ? 'Success'
                            : l.status === 'fail'
                              ? 'Fail · qayta topshirish kerak'
                              : l.status === 'submitted'
                                ? 'Tekshiruvda'
                                : l.status === 'partial'
                                  ? 'Qisman bajarilgan'
                                  : 'Bajarilmagan'
                        }
                      >
                        {l.status === 'done'
                          ? '✅'
                          : l.status === 'fail'
                            ? '❌'
                            : l.status === 'submitted'
                              ? '⏳'
                              : l.status === 'partial'
                                ? '◐'
                                : '○'}
                      </span>
                      {teacher ? (
                        <form
                          className="course-point-form"
                          onSubmit={(e) => {
                            e.preventDefault();
                            points(
                              l.releaseId,
                              s.id,
                              Number(new FormData(e.currentTarget).get('points')),
                            );
                          }}
                        >
                          <input
                            key={`${l.releaseId}-${l.points}`}
                            aria-label={`${s.name} dars balli`}
                            name="points"
                            type="number"
                            min={0}
                            max={10}
                            defaultValue={l.points ?? ''}
                            required
                          />
                          <button
                            className="icon-button"
                            disabled={busy}
                            aria-label="Ballni saqlash"
                          >
                            <Check size={14} />
                          </button>
                        </form>
                      ) : (
                        <small>{l.points ?? '—'} ball</small>
                      )}
                    </td>
                  ))}
                  <td>
                    <strong>{s.points}</strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="section-title course-shared-title">
        <div>
          <h2>Guruh vazifalari</h2>
          <p className="muted">
            Talabalar topshirgan ishlar va ustozning natijasi hammaga ko‘rinadi.
          </p>
        </div>
        <Badge tone="neutral">{data.submissions.length} ta ish</Badge>
      </div>
      {data.submissions.length ? (
        <div className="course-shared-submissions">
          {data.submissions.map((submission) => (
            <button
              className={`course-shared-card ${submission.review_outcome || 'pending'}`}
              key={submission.id}
              onClick={() => setSelected(submission)}
            >
              <div>
                <span className="avatar">{submission.student_name?.[0]}</span>
                <span>
                  <strong>{submission.student_name}</strong>
                  <small>{submission.assignment_title}</small>
                </span>
                <span className={`course-review-status ${submission.review_outcome || 'pending'}`}>
                  {submission.review_outcome === 'success' ? (
                    <CircleCheckBig size={17} />
                  ) : submission.review_outcome === 'fail' ? (
                    <CircleX size={17} />
                  ) : (
                    <Clock3 size={17} />
                  )}
                  {submission.review_outcome === 'success'
                    ? 'Success'
                    : submission.review_outcome === 'fail'
                      ? 'Fail'
                      : 'Tekshirilmoqda'}
                </span>
              </div>
              <p lang="ko">{submission.body || 'Javob biriktirilgan faylda.'}</p>
              <small>
                {submission.attempt > 1 ? `${submission.attempt}-urinish · ` : ''}
                {dateLabel(submission.updated_at)}
              </small>
            </button>
          ))}
        </div>
      ) : (
        <Empty title="Hali topshirilgan vazifa yo‘q">
          Birinchi topshiriq yuborilgach, guruh natijalari shu yerda ko‘rinadi.
        </Empty>
      )}
      <div className="section-title">
        <h2>Guruh reytingi</h2>
        <Badge tone="green">100 ball = kitob sovg‘asi</Badge>
      </div>
      <p className="muted">
        Avval ustoz qo‘ygan jami ball, teng bo‘lsa bajarilgan darslar va quiz natijasi hisoblanadi.
        Har dars uchun 0–10 ball.
      </p>
      <div className="course-ranking">
        {data.students.map((s, i) => (
          <div key={s.id}>
            <span className="course-rank">{i + 1}</span>
            <div>
              <strong>{s.name}</strong>
              <p>
                {s.homework} dars tasdiqlangan · quizlarda {s.quizScore} to‘g‘ri javob
              </p>
              <progress value={s.points % 100 || (s.points ? 100 : 0)} max={100} />
              <small>
                {s.points < 100
                  ? `Kitobgacha yana ${100 - s.points} ball`
                  : `${s.points} ball · ${s.gifts.length} sovg‘a berilgan`}
              </small>
            </div>
            <strong>{s.points} ball</strong>
            {teacher && Math.floor(s.points / 100) > s.gifts.length && (
              <button
                className="button secondary"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const milestone = Array.from(
                      { length: Math.floor(s.points / 100) },
                      (_, j) => (j + 1) * 100,
                    ).find((n) => !s.gifts.includes(n));
                    await post(`board/${groupId}/gift`, { userId: s.id, milestone });
                    await load();
                    notify('Kitob sovg‘asi berilgani qayd etildi.');
                  } catch (e) {
                    notify(errorText(e));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Kitob berildi
              </button>
            )}
          </div>
        ))}
      </div>
      {teacher &&
        data.releases.map((r) => (
          <details key={r.id} className="panel course-group-live">
            <summary>{r.title} · Dars quizini boshqarish</summary>
            <LiveQuiz releaseId={r.id} teacher notify={notify} />
          </details>
        ))}
      {selected && (
        <Modal
          title={`${selected.student_name} · ${selected.assignment_title}`}
          onClose={() => setSelected(null)}
          wide
        >
          <div className="course-shared-detail">
            <div className={`course-review-banner ${selected.review_outcome || 'pending'}`}>
              {selected.review_outcome === 'success' ? (
                <CircleCheckBig size={28} />
              ) : selected.review_outcome === 'fail' ? (
                <CircleX size={28} />
              ) : (
                <Clock3 size={28} />
              )}
              <div>
                <strong>
                  {selected.review_outcome === 'success'
                    ? 'Success'
                    : selected.review_outcome === 'fail'
                      ? 'Fail · qayta topshirish kerak'
                      : 'Tekshirilmoqda'}
                </strong>
                <small>
                  {selected.review_outcome === 'success'
                    ? 'Ustoz vazifani qabul qildi.'
                    : selected.review_outcome === 'fail'
                      ? 'Ustoz izohini o‘qib, vazifani qayta yuboring.'
                      : 'Vazifa ustoz tekshiruvida.'}
                </small>
              </div>
            </div>
            <div className="submitted-text" lang="ko">
              {selected.body || 'Javob biriktirilgan faylda.'}
            </div>
            <div className="submission-attachments">
              {selected.attachments?.map((file) =>
                file.mime.startsWith('audio/') || file.mime === 'application/ogg' ? (
                  <div className="course-file" key={file.id}>
                    <audio controls preload="none" src={`/api/files/${file.id}`} />
                    <a href={`/api/files/${file.id}`} target="_blank" rel="noreferrer">
                      {file.name}
                    </a>
                  </div>
                ) : (
                  <a
                    className={file.mime.startsWith('image/') ? 'image-attachment' : 'file-chip'}
                    href={`/api/files/${file.id}`}
                    target="_blank"
                    rel="noreferrer"
                    key={file.id}
                  >
                    {file.mime.startsWith('image/') ? (
                      <img src={`/api/files/${file.id}`} alt={file.name} />
                    ) : (
                      <FileText size={22} />
                    )}
                    <span>{file.name}</span>
                  </a>
                ),
              )}
            </div>
            {selected.published_at && (
              <div className="feedback-box">
                <div>
                  <h3>Ustoz izohi</h3>
                  <Badge tone={selected.review_outcome === 'success' ? 'green' : 'orange'}>
                    {selected.score}/100
                  </Badge>
                </div>
                <p>{selected.feedback}</p>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
export function TeacherCourseBoard({
  groups,
  notify,
}: {
  groups: Group[];
  notify: (s: string) => void;
}) {
  const [gid, setGid] = useState(groups[0]?.id || '');
  return (
    <>
      <label className="course-group-select">
        Guruh
        <select value={gid} onChange={(e) => setGid(e.target.value)}>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      </label>
      {gid ? (
        <GroupBoard key={gid} groupId={gid} teacher notify={notify} />
      ) : (
        <Empty title="Avval guruh oching" />
      )}
    </>
  );
}
