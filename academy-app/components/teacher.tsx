'use client';
import { COURSE_LEVELS } from '@/lib/course-types';
import TopikTeaching from './topik-teaching';

import { useState, useEffect } from 'react';
import {
  Users,
  PenLine,
  Activity,
  Layers3,
  Plus,
  ArrowRight,
  ArrowUpRight,
  Copy,
  Check,
  Clock3,
  FileText,
  Sparkles,
  Send,
  BookOpen,
  Languages,
  Search,
  ChevronRight,
  Settings2,
  GraduationCap,
  AlertCircle,
  LoaderCircle,
} from 'lucide-react';
import type { teacherState } from '@/lib/learning';
import type { Group, Submission, AIReview, Grammar, Word, HomeworkSkill } from '@/lib/types';
import { api, Badge, Modal, Empty, SectionTitle, SubmitButton, dateLabel, errorText } from './ui';
export type TeacherData = ReturnType<typeof teacherState>;
export function TeacherHome({
  data,
  go,
  openReview,
}: {
  data: TeacherData;
  go: (s: string) => void;
  openReview: (s: Submission) => void;
}) {
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">선생님의 교실 · O‘QITUVCHI MAKONI</span>
          <h1>Bugun guruhlarda nimalar bo‘lyapti?</h1>
          <p>O‘quvchilar, mashqlar va sizni kutayotgan yozma ishlar.</p>
        </div>
        <Badge tone="blue">O‘qituvchi</Badge>
      </div>
      <div className="teacher-stats">
        {[
          { icon: Users, value: data.stats.students, label: 'O‘quvchi', tone: 'blue' },
          { icon: Layers3, value: data.stats.groups, label: 'Guruh', tone: 'purple' },
          { icon: Activity, value: data.stats.active, label: 'Oxirgi 3 kunda faol', tone: 'mint' },
          {
            icon: PenLine,
            value: data.stats.pending,
            label: 'Tekshirish kutilmoqda',
            tone: 'orange',
          },
        ].map((s) => (
          <div className="stat-card" key={s.label}>
            <span className={`stat-icon ${s.tone}`}>
              <s.icon size={22} />
            </span>
            <div>
              <strong>{s.value}</strong>
              <p>{s.label}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="teacher-home-grid">
        <div>
          <SectionTitle
            title="Sizni kutayotgan ishlar"
            action="Barchasini ochish"
            onAction={() => go('/reviews')}
          />
          <div className="panel submissions-summary">
            {data.submissions
              .filter((s) => !s.published_at)
              .slice(0, 5)
              .map((s) => (
                <button key={s.id} className="submission-row" onClick={() => openReview(s)}>
                  <div className="avatar">{s.student_name?.slice(0, 1)}</div>
                  <div>
                    <h3>{s.student_name}</h3>
                    <p>{s.assignment_title}</p>
                  </div>
                  <Badge tone="orange">Yangi ish</Badge>
                  <ChevronRight size={18} />
                </button>
              ))}
            {!data.stats.pending && (
              <Empty title="Barcha ishlar ko‘rib chiqildi">
                Yangi topshirilgan vazifalar shu yerda ko‘rinadi.
              </Empty>
            )}
          </div>
          <SectionTitle
            title="O‘quvchilar faolligi"
            action="Guruhlarni ochish"
            onAction={() => go('/groups')}
          />
          <StudentTable students={data.students} />
          <TopikTeaching />
        </div>
        <aside>
          <section className="teacher-focus">
            <span className="eyebrow">DARS OLDIDAN</span>
            <h2 lang="ko">
              함께,
              <br />한 걸음 더.
            </h2>
            <h3>Kimga yordam kerak?</h3>
            <p>
              {
                data.students.filter(
                  (s) => !s.last_at || new Date(s.last_at).getTime() < Date.now() - 3 * 86400000,
                ).length
              }{' '}
              nafar o‘quvchi oxirgi 3 kunda mashq qilmagan.
            </p>
            <button className="button white" onClick={() => go('/groups')}>
              Guruhni ko‘rish
              <ArrowRight size={17} />
            </button>
          </section>
          <section className="panel weak-panel">
            <h3>Qayta tushuntirishga arziydi</h3>
            <p>Ko‘p xato qilingan mavzular</p>
            {data.weakTopics.length ? (
              data.weakTopics.map((t) => (
                <div className="weak-topic" key={t.topic}>
                  <span lang="ko">{t.label}</span>
                  <Badge tone="orange">
                    {t.wrong}/{t.total} xato
                  </Badge>
                </div>
              ))
            ) : (
              <div className="gentle-empty">Hozircha xato qilingan mavzu qayd etilmagan.</div>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}
export function StudentTable({ students }: { students: TeacherData['students'] }) {
  return (
    <div className="table-wrap panel">
      <table>
        <thead>
          <tr>
            <th>O‘quvchi</th>
            <th>7 kunlik faollik</th>
            <th>Birinchi / oxirgi</th>
            <th>Oxirgi mashq</th>
          </tr>
        </thead>
        <tbody>
          {students.map((s) => (
            <tr key={s.id}>
              <td>
                <div className="student-cell">
                  <div className="avatar small">{s.name[0]}</div>
                  <div>
                    <strong>{s.name}</strong>
                    <small>{s.group_name}</small>
                  </div>
                </div>
              </td>
              <td>
                <div className="mini-days">
                  {Array.from({ length: 7 }, (_, i) => (
                    <span key={i} className={i < s.week_days ? 'active' : ''} />
                  ))}
                </div>
                <small>{s.week_days} kun</small>
              </td>
              <td>
                {s.first_score === null ? (
                  'Hali mashq yo‘q'
                ) : (
                  <span className="score-change">
                    {s.first_score}% <ArrowRight size={13} /> <strong>{s.latest_score}%</strong>
                  </span>
                )}
              </td>
              <td>
                {s.last_at ? dateLabel(s.last_at) : <Badge tone="neutral">Boshlamagan</Badge>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!students.length && (
        <Empty title="Hali o‘quvchi yo‘q">Guruh kodini o‘quvchilaringizga yuboring.</Empty>
      )}
    </div>
  );
}
export function Groups({
  data,
  refresh,
  notify,
}: {
  data: TeacherData;
  refresh: () => void;
  notify: (s: string) => void;
}) {
  const [editing, setEditing] = useState<Partial<Group> | null>(null);
  const [assignment, setAssignment] = useState(false);
  const [groupId, setGroupId] = useState('all');
  const [busy, setBusy] = useState(false);
  const [grammarIds, setGrammarIds] = useState<string[]>([]);
  const [wordIds, setWordIds] = useState<string[]>([]);
  function edit(g?: Group) {
    setEditing(g || {});
    setGrammarIds(
      g
        ? JSON.parse(g.grammar_ids)
        : data.grammars
            .filter((x) => x.id.startsWith('A'))
            .slice(0, 15)
            .map((x) => x.id),
    );
    setWordIds(g ? JSON.parse(g.vocabulary_ids) : data.words.map((x) => x.id));
  }
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    try {
      await api('teacher/groups', {
        method: 'POST',
        body: JSON.stringify({
          id: editing?.id,
          name: fd.get('name'),
          level: fd.get('level'),
          grammarIds,
          vocabularyIds: wordIds,
        }),
      });
      setEditing(null);
      refresh();
      notify('Guruh saqlandi.');
    } catch (e) {
      notify(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">그룹 · BIRGA O‘RGANAMIZ</span>
          <h1>Guruhlar va vazifalar</h1>
          <p>Har bir guruh uchun mavzular va o‘z sur’atidagi mashqlar.</p>
        </div>
        <div className="button-row">
          <button className="button secondary" onClick={() => edit()}>
            <Plus size={17} />
            Guruh
          </button>
          <button className="button primary" onClick={() => setAssignment(true)}>
            <Plus size={17} />
            Vazifa berish
          </button>
        </div>
      </div>
      <div className="group-grid">
        {data.groups.map((g) => (
          <article className="group-card" key={g.id}>
            <div>
              <span className="square-icon pale-blue">
                <GraduationCap size={25} />
              </span>
              <button
                className="icon-button"
                onClick={() => edit(g)}
                aria-label="Guruhni tahrirlash"
              >
                <Settings2 size={18} />
              </button>
            </div>
            <h2>{g.name}</h2>
            <p>
              {g.level} · {data.students.filter((s) => s.group_id === g.id).length} o‘quvchi
            </p>
            <div className="group-counts">
              <span>
                <BookOpen size={16} />
                {JSON.parse(g.grammar_ids).length} grammatika
              </span>
              <span>
                <Languages size={16} />
                {JSON.parse(g.vocabulary_ids).length} so‘z
              </span>
            </div>
            <a className="button secondary" href="/courses">
              {g.course_id ? 'Darslarni boshqarish' : 'Dasturga ulash uchun darajani tanlang'}
            </a>
            <div className="invite-code">
              <div>
                <small>TAKLIF KODI</small>
                <strong>{g.invite_code}</strong>
              </div>
              <button
                className="icon-button"
                aria-label="Taklif kodini nusxalash"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(g.invite_code);
                    notify('Taklif kodi nusxalandi.');
                  } catch {
                    notify(g.invite_code);
                  }
                }}
              >
                <Copy size={18} />
              </button>
            </div>
            <button
              className="button secondary"
              onClick={async () => {
                const link = `${window.location.origin}/register?invite=${encodeURIComponent(g.invite_code)}`;
                try {
                  await navigator.clipboard.writeText(link);
                  notify('Guruhga kirish havolasi nusxalandi.');
                } catch {
                  notify(link);
                }
              }}
            >
              Guruh havolasini nusxalash
            </button>
          </article>
        ))}
      </div>
      <SectionTitle title="O‘quvchilar" />
      <div className="library-toolbar">
        <select
          aria-label="Guruh bo‘yicha ko‘rsatish"
          value={groupId}
          onChange={(e) => setGroupId(e.target.value)}
        >
          <option value="all">Barcha guruhlar</option>
          {data.groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      </div>
      <StudentTable
        students={data.students.filter((s) => groupId === 'all' || s.group_id === groupId)}
      />
      <SectionTitle title="Berilgan vazifalar" />
      <div className="panel assignments-table">
        {data.assignments.map((a) => (
          <div className="history-row" key={a.id}>
            <span className={`square-icon ${a.kind === 'writing' ? 'sand' : 'lavender'}`}>
              {a.kind === 'writing' ? <PenLine size={21} /> : <BookOpen size={21} />}
            </span>
            <div>
              <strong>{a.title}</strong>
              <p>
                {a.group_name} ·{' '}
                {{ listening: '듣기', reading: '읽기', writing: '쓰기', speaking: '말하기' }[
                  a.skill
                ] || '읽기'}{' '}
                · {dateLabel(a.due_at)} gacha
              </p>
            </div>
            <Badge tone="neutral">
              {a.kind === 'writing'
                ? 'Yozma'
                : a.kind === 'grammar'
                  ? 'Grammatika'
                  : a.kind === 'topik'
                    ? 'TOPIK'
                    : a.kind === 'topik_words'
                      ? 'TOPIK lug‘ati'
                      : 'Lug‘at'}
            </Badge>
          </div>
        ))}
      </div>
      {editing && (
        <Modal
          title={editing.id ? 'Guruhni sozlash' : 'Yangi guruh'}
          onClose={() => setEditing(null)}
          wide
        >
          <form className="form-stack" onSubmit={save}>
            <div className="form-two">
              <label>
                Guruh nomi
                <input
                  name="name"
                  defaultValue={editing.name}
                  required
                  placeholder="Masalan, Busan · TOPIK II"
                />
              </label>
              <label>
                Darajasi
                <select
                  name="level"
                  defaultValue={
                    editing.level === '한글'
                      ? 'hangul'
                      : editing.level?.includes('5')
                        ? 'topik56'
                        : 'topik34'
                  }
                  required
                >
                  {COURSE_LEVELS.map((level) => (
                    <option key={level.id} value={level.id}>
                      {level.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="alert">
              Tanlangan darajadagi o‘quv dasturi avtomatik biriktiriladi. Materiallarni “Dars
              dasturlari” bo‘limida tayyorlang va shu guruh uchun darslarni oching.
            </div>
            <SubmitButton busy={busy}>
              Guruhni saqlash
              <Check size={18} />
            </SubmitButton>
          </form>
        </Modal>
      )}
      {assignment && (
        <AssignmentForm
          data={data}
          onClose={() => setAssignment(false)}
          onSave={() => {
            setAssignment(false);
            refresh();
            notify('Vazifa guruhga berildi.');
          }}
          notify={notify}
        />
      )}
    </>
  );
}
function AssignmentForm({
  data,
  onClose,
  onSave,
  notify,
}: {
  data: TeacherData;
  onClose: () => void;
  onSave: () => void;
  notify: (s: string) => void;
}) {
  const [kind, setKind] = useState('writing');
  const [skill, setSkill] = useState<HomeworkSkill>('writing');
  const [topics, setTopics] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    try {
      await api('teacher/assignments', {
        method: 'POST',
        body: JSON.stringify({
          groupId: fd.get('groupId'),
          title: fd.get('title'),
          kind,
          skill,
          prompt: fd.get('prompt'),
          topicIds: topics,
          dueAt: new Date(String(fd.get('dueAt'))).toISOString(),
        }),
      });
      onSave();
    } catch (e) {
      notify(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Guruhga vazifa berish" onClose={onClose} wide>
      <form className="form-stack" onSubmit={submit}>
        <div className="form-two">
          <label>
            Guruh
            <select name="groupId" required>
              {data.groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Vazifa turi
            <select
              value={kind}
              onChange={(e) => {
                const next = e.target.value;
                setKind(next);
                setSkill(next === 'writing' ? 'writing' : 'reading');
                setTopics([]);
              }}
            >
              <option value="writing">Yozma vazifa</option>
              <option value="grammar">Grammatika quiz</option>
              <option value="vocabulary">Lug‘at quiz</option>
            </select>
          </label>
          <label>
            Ko‘nikma
            <select value={skill} onChange={(e) => setSkill(e.target.value as HomeworkSkill)}>
              <option value="listening">듣기 · Tinglash</option>
              <option value="reading">읽기 · O‘qish</option>
              <option value="writing">쓰기 · Yozish</option>
              <option value="speaking">말하기 · Gapirish</option>
            </select>
          </label>
        </div>
        <label>
          Sarlavha
          <input
            name="title"
            required
            minLength={2}
            maxLength={140}
            placeholder="Masalan, Mening kelajak rejalarim"
          />
        </label>
        <label>
          Topshiriq va ko‘rsatma
          <textarea
            name="prompt"
            required
            minLength={5}
            rows={5}
            maxLength={5000}
            placeholder="O‘quvchi nima yozishi yoki qaysi mavzuni mashq qilishi kerak?"
          />
        </label>
        <label>
          Topshirish muddati
          <input type="datetime-local" name="dueAt" required />
        </label>
        {kind !== 'writing' && (
          <>
            <label>Mavzular (tanlanmasa guruhning barcha mavzulari)</label>
            <div className="check-grid">
              {(kind === 'grammar' ? data.grammars : data.words).map((t) => (
                <label className="checkbox-label" key={t.id}>
                  <input
                    type="checkbox"
                    checked={topics.includes(t.id)}
                    onChange={(e) =>
                      setTopics(
                        e.target.checked ? [...topics, t.id] : topics.filter((x) => x !== t.id),
                      )
                    }
                  />
                  <span>{'form' in t ? t.form : t.ko}</span>
                </label>
              ))}
            </div>
          </>
        )}
        <SubmitButton busy={busy}>
          Guruhga berish
          <Send size={18} />
        </SubmitButton>
      </form>
    </Modal>
  );
}
export function Reviews({
  data,
  openReview,
}: {
  data: TeacherData;
  openReview: (s: Submission) => void;
}) {
  const [filter, setFilter] = useState('pending');
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">피드백 · O‘SISH UCHUN IZOH</span>
          <h1>Yozma ishlarni tekshirish</h1>
          <p>O‘quvchi ishini ko‘ring, AI ustozdan yordam oling va izoh yuboring.</p>
        </div>
        <div className="heading-icon lavender">
          <PenLine size={29} />
        </div>
      </div>
      <div className="segmented standalone">
        <button
          className={filter === 'pending' ? 'active' : ''}
          onClick={() => setFilter('pending')}
        >
          Kutilmoqda · {data.stats.pending}
        </button>
        <button className={filter === 'done' ? 'active' : ''} onClick={() => setFilter('done')}>
          Tekshirilgan
        </button>
        <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>
          Barchasi
        </button>
      </div>
      <div className="review-grid">
        {data.submissions
          .filter(
            (s) => filter === 'all' || (filter === 'pending' ? !s.published_at : !!s.published_at),
          )
          .map((s) => (
            <button className="review-list-card" key={s.id} onClick={() => openReview(s)}>
              <div>
                <div className="student-cell">
                  <div className="avatar">{s.student_name?.[0]}</div>
                  <div>
                    <h3>{s.student_name}</h3>
                    <small>{s.group_name}</small>
                  </div>
                </div>
                <Badge tone={s.published_at ? 'green' : 'orange'}>
                  {s.published_at ? `${s.score}/100` : 'Tekshirish kerak'}
                </Badge>
              </div>
              <h2>{s.assignment_title}</h2>
              <p lang="ko">{s.body || 'Javob biriktirilgan faylda.'}</p>
              <footer>
                <span>
                  <FileText size={16} />
                  {s.attachments.length} fayl · {dateLabel(s.created_at)}
                </span>
                <span>
                  Ochish
                  <ArrowUpRight size={17} />
                </span>
              </footer>
            </button>
          ))}
      </div>
      {!data.submissions.filter(
        (s) => filter === 'all' || (filter === 'pending' ? !s.published_at : !!s.published_at),
      ).length && (
        <Empty title="Bu yerda hozircha ish yo‘q">
          Topshirilgan yozma vazifalar shu yerga keladi.
        </Empty>
      )}
    </>
  );
}
export function ReviewDetail({
  submission,
  aiEnabled,
  model,
  onClose,
  refresh,
  notify,
}: {
  submission: Submission;
  aiEnabled: boolean;
  model: string;
  onClose: () => void;
  refresh: () => void;
  notify: (s: string) => void;
}) {
  const [s, setS] = useState(submission);
  const [feedback, setFeedback] = useState(submission.feedback || '');
  const [score, setScore] = useState(submission.score ?? 0);
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  let review: AIReview | null = null;
  try {
    review = s.ai?.result ? JSON.parse(s.ai.result) : null;
  } catch {}
  useEffect(() => {
    if (s.ai?.status !== 'queued' && s.ai?.status !== 'running') return;
    const timer = setInterval(() => {
      api<Submission>(`submissions/${s.id}`)
        .then(setS)
        .catch(() => {});
    }, 6000);
    return () => clearInterval(timer);
  }, [s.id, s.ai?.status]);
  async function ai() {
    setBusy(true);
    setError('');
    try {
      await api('teacher/ai-review', {
        method: 'POST',
        body: JSON.stringify({ submissionId: s.id }),
      });
      const result = await api<Submission>(`submissions/${s.id}`);
      setS(result);
      refresh();
      notify('Ish AI ustoz navbatiga qo‘shildi. Natija shu yerda ko‘rinadi.');
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function reload() {
    try {
      setS(await api<Submission>(`submissions/${s.id}`));
      refresh();
    } catch (e) {
      notify(errorText(e));
    }
  }
  async function publish(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError('');
    try {
      await api('teacher/feedback', {
        method: 'POST',
        body: JSON.stringify({ submissionId: s.id, feedback, score }),
      });
      notify('Izoh o‘quvchiga yuborildi.');
      refresh();
      onClose();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setSending(false);
    }
  }
  function useAI() {
    if (!review) return;
    setScore(review.score);
    setFeedback(
      [
        review.summary,
        'Yaxshi jihatlar:',
        ...review.strengths.map((x) => '• ' + x),
        'Tuzatishlar:',
        ...review.corrections.map((x) => `${x.original} → ${x.corrected}\n${x.explanation}`),
        'Yaxshilangan namuna:',
        review.improved_text,
        'Keyingi qadamlar:',
        ...review.next_steps.map((x) => '• ' + x),
      ].join('\n\n'),
    );
  }
  return (
    <Modal title={`${s.student_name || 'O‘quvchi'} · Yozma ish`} onClose={onClose} wide>
      <div className="review-detail">
        <div className="assignment-prompt">
          <Badge tone="neutral">{s.assignment_title}</Badge>
          <p>{s.prompt}</p>
        </div>
        <h3>O‘quvchi javobi</h3>
        <div className="submitted-text" lang="ko">
          {s.body || 'Javob biriktirilgan faylda.'}
        </div>
        <div className="submission-attachments">
          {s.attachments?.map((f) =>
            f.mime.startsWith('audio/') || f.mime === 'application/ogg' ? (
              <div key={f.id} className="course-file">
                <audio controls preload="none" src={`/api/files/${f.id}`} />
                <a href={`/api/files/${f.id}`} target="_blank" rel="noreferrer">
                  {f.name}
                </a>
              </div>
            ) : (
              <a
                key={f.id}
                href={`/api/files/${f.id}`}
                target="_blank"
                rel="noreferrer"
                className={f.mime.startsWith('image/') ? 'image-attachment' : 'file-chip'}
              >
                {f.mime.startsWith('image/') ? (
                  <img src={`/api/files/${f.id}`} alt={f.name} />
                ) : (
                  <FileText size={23} />
                )}
                <span>{f.name}</span>
                <ArrowUpRight size={17} />
              </a>
            ),
          )}
        </div>
        <section className="ai-panel">
          <div className="ai-panel-head">
            <span className="square-icon lavender">
              <Sparkles size={23} />
            </span>
            <div>
              <h3>AI ustoz</h3>
              <p>{model} · Siz uchun tekshirish yordamchisi</p>
            </div>
            {s.ai?.status === 'completed' && <Badge tone="green">Tayyor</Badge>}
          </div>
          {s.attachments?.some(
            (f) => f.mime.startsWith('audio/') || f.mime === 'application/ogg',
          ) && (
            <p className="alert">
              Ovozli javobni tinglab baholang. AI tekshiruvi matn, rasm va PDF uchun.
            </p>
          )}
          <p>
            Matn va ilovalar tekshirishga yuboriladi. AI tavsiyasini ko‘rib chiqib, yakuniy izohni
            o‘zingiz yuborasiz.
          </p>
          {!aiEnabled && (
            <div className="alert">
              <AlertCircle size={18} />
              AI ustoz hali ulanmagan. API kaliti sozlangach ishga tushadi.
            </div>
          )}
          {s.ai?.status === 'queued' || s.ai?.status === 'running' ? (
            <div className="ai-pending">
              <LoaderCircle size={19} className="spin" />
              <span>
                {s.ai.status === 'queued' ? 'Tekshirish navbatida' : 'AI ustoz tahlil qilmoqda…'}
              </span>
              <button className="text-button" onClick={reload}>
                Yangilash
              </button>
            </div>
          ) : (
            <button
              className="button ai-button"
              disabled={
                !aiEnabled ||
                busy ||
                s.attachments?.some(
                  (f) => f.mime.startsWith('audio/') || f.mime === 'application/ogg',
                )
              }
              onClick={ai}
            >
              <Sparkles size={17} />
              {busy
                ? 'Yuborilmoqda…'
                : review
                  ? 'Qayta AI tekshiruviga yuborish'
                  : 'AI ustozga tekshirtirish'}
            </button>
          )}
          {s.ai?.status === 'failed' && (
            <p className="alert error">
              {s.ai.error || 'Tekshirish tugamadi. Qayta urinib ko‘ring.'}
            </p>
          )}
          {review && (
            <div className="ai-result">
              <div className="rubric-row">
                {[
                  { name: 'Mazmun', value: review.rubric.task, max: 30 },
                  { name: 'Grammatika', value: review.rubric.grammar, max: 30 },
                  { name: 'Lug‘at', value: review.rubric.vocabulary, max: 20 },
                  { name: 'Bog‘lanish', value: review.rubric.coherence, max: 20 },
                ].map((r) => (
                  <div key={r.name}>
                    <strong>
                      {r.value}
                      <small>/{r.max}</small>
                    </strong>
                    <span>{r.name}</span>
                  </div>
                ))}
              </div>
              <p>{review.summary}</p>
              <h4>Yaxshi jihatlar</h4>
              <ul>
                {review.strengths.map((x, i) => (
                  <li key={i}>{x}</li>
                ))}
              </ul>
              <h4>Tuzatishlar</h4>
              {review.corrections.map((x, i) => (
                <div className="correction" key={i}>
                  <del lang="ko">{x.original}</del>
                  <strong lang="ko">{x.corrected}</strong>
                  <p>{x.explanation}</p>
                </div>
              ))}
              <h4>Yaxshilangan namuna</h4>
              <p className="submitted-text" lang="ko">
                {review.improved_text}
              </p>
              <h4>Keyingi mashqlar</h4>
              <ul>
                {review.next_steps.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ul>
              {review.uncertainty.length > 0 && (
                <div className="alert">{review.uncertainty.join(' ')}</div>
              )}
              <button className="button secondary" onClick={useAI}>
                Tavsiyani izohga qo‘shish
                <ArrowRight size={17} />
              </button>
            </div>
          )}
        </section>
        <form className="form-stack" onSubmit={publish}>
          <div className="section-title">
            <h3>Sizning yakuniy izohingiz</h3>
            <span className="muted">O‘quv mashqi bahosi</span>
          </div>
          <label>
            O‘quvchiga tushuntirish
            <textarea
              rows={7}
              value={feedback}
              minLength={10}
              maxLength={12000}
              required
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Nima yaxshi chiqqani va nimani yaxshilash kerakligini yozing."
            />
          </label>
          <label className="score-input">
            Baho (0–100)
            <input
              type="number"
              min={0}
              max={100}
              required
              value={score}
              onChange={(e) => setScore(Number(e.target.value))}
            />
          </label>
          {error && <div className="alert error">{error}</div>}
          <SubmitButton busy={sending}>
            <Send size={17} />
            {s.published_at ? 'Izohni yangilash va yuborish' : 'Izohni o‘quvchiga yuborish'}
          </SubmitButton>
        </form>
      </div>
    </Modal>
  );
}
export function ContentManager({
  data,
  refresh,
  notify,
}: {
  data: TeacherData;
  refresh: () => void;
  notify: (s: string) => void;
}) {
  const [kind, setKind] = useState<'grammar' | 'vocabulary'>('grammar');
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    try {
      await api('teacher/questions', {
        method: 'POST',
        body: JSON.stringify({
          kind,
          topicId: fd.get('topicId'),
          prompt: fd.get('prompt'),
          options: [0, 1, 2, 3].map((i) => fd.get(`option${i}`)),
          answer: Number(fd.get('answer')),
          explanation: fd.get('explanation'),
          translation: fd.get('translation'),
        }),
      });
      setAdding(false);
      refresh();
      notify('Yangi quiz savoli qo‘shildi.');
    } catch (e) {
      notify(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">학습 자료 · O‘QUV MATERIALLARI</span>
          <h1>Quiz va mavzular bazasi</h1>
          <p>{data.questionCount} ta savol. Har biriga to‘g‘ri javob va izoh biriktirilgan.</p>
        </div>
        <div className="button-row">
          {kind === 'vocabulary' && (
            <a className="button secondary" href="/vocabulary">
              <Languages size={18} /> Lug‘atni boshqarish
            </a>
          )}
          <button className="button primary" onClick={() => setAdding(true)}>
            <Plus size={18} />
            Savol qo‘shish
          </button>
        </div>
      </div>
      <div className="library-toolbar">
        <div className="segmented">
          <button className={kind === 'grammar' ? 'active' : ''} onClick={() => setKind('grammar')}>
            <BookOpen size={16} />
            Grammatika quizlari
          </button>
          <button
            className={kind === 'vocabulary' ? 'active' : ''}
            onClick={() => setKind('vocabulary')}
          >
            <Languages size={16} />
            Lug‘at quizlari
          </button>
        </div>
        <label className="search-box">
          <Search size={18} />
          <input
            value={search}
            aria-label="Mavzuni qidirish"
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Mavzuni qidirish…"
          />
        </label>
      </div>
      <div className="grammar-grid">
        {(kind === 'grammar' ? data.grammars : data.words)
          .filter((t) => JSON.stringify(t).toLowerCase().includes(search.toLowerCase()))
          .map((t) => (
            <div className="grammar-card" key={t.id}>
              <div>
                <span className="muted">{t.id}</span>
                <Badge tone={kind === 'grammar' ? 'purple' : 'green'}>
                  {data.coverage[t.id] || 0} savol
                </Badge>
              </div>
              <h3 lang="ko">{'form' in t ? t.form : t.ko}</h3>
              <p>{'meaning' in t ? t.meaning : t.uz}</p>
            </div>
          ))}
      </div>
      {adding && (
        <Modal
          title={
            kind === 'grammar'
              ? 'Grammatika quiziga savol qo‘shish'
              : 'Lug‘at quiziga savol qo‘shish'
          }
          onClose={() => setAdding(false)}
          wide
        >
          <form onSubmit={submit} className="form-stack">
            <label>
              Mavzu
              <select name="topicId" required>
                {(kind === 'grammar' ? data.grammars : data.words).map((t) => (
                  <option key={t.id} value={t.id}>
                    {'form' in t ? t.form : t.ko}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Savol
              <textarea
                name="prompt"
                required
                minLength={5}
                maxLength={2000}
                rows={3}
                placeholder="Koreyscha gap yoki savolni yozing."
              />
            </label>
            <div className="form-two">
              {[0, 1, 2, 3].map((i) => (
                <label key={i}>
                  {'ABCD'[i]} varianti
                  <input name={`option${i}`} required maxLength={300} />
                </label>
              ))}
            </div>
            <label>
              To‘g‘ri javob
              <select name="answer">
                {[0, 1, 2, 3].map((i) => (
                  <option key={i} value={i}>
                    {'ABCD'[i]} varianti
                  </option>
                ))}
              </select>
            </label>
            <label>
              Nima uchun shu javob to‘g‘ri?
              <textarea
                name="explanation"
                required
                minLength={10}
                maxLength={2000}
                rows={3}
                placeholder="O‘quvchiga tushunarli o‘zbekcha izoh."
              />
            </label>
            <label>
              Gap tarjimasi
              <input name="translation" maxLength={2000} />
            </label>
            <SubmitButton busy={busy}>
              Savolni saqlash
              <Check size={18} />
            </SubmitButton>
          </form>
        </Modal>
      )}
    </>
  );
}
