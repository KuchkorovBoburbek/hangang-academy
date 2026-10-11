'use client';
import { useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronRight,
  CircleDashed,
  Clock3,
  Gift,
  Headphones,
  Languages,
  Mic,
  NotebookPen,
  PenLine,
  Plus,
  Radio,
  RotateCcw,
  Sparkles,
  Trash2,
  Trophy,
} from 'lucide-react';
import {
  HOME_SKILLS,
  homeTasks,
  taskSummary,
  type HomeSkill,
  type HomeTask,
} from '@/lib/student-home';
import { COURSE_LEVELS } from '@/lib/course-types';
import type { User } from '@/lib/types';
import type { TodayPlanItem } from '@/lib/study';
import type { StudentData, StartQuiz } from './student';
import { Modal, SubmitButton, api, dateLabel, errorText } from './ui';
import '@/app/student-home.css';

const skillIcons = { reading: BookOpen, listening: Headphones, speaking: Mic, writing: PenLine };
const statusIcons = { todo: ArrowUpRight, submitted: Clock3, done: Check, empty: CircleDashed };
const PLAN_ACTIVITIES: Array<{
  kind: TodayPlanItem['kind'];
  ko?: string;
  label: string;
}> = [
  { kind: 'reading', ko: '읽기', label: 'O‘qish' },
  { kind: 'listening', ko: '듣기', label: 'Tinglash' },
  { kind: 'speaking', ko: '말하기', label: 'Gapirish' },
  { kind: 'writing', ko: '쓰기', label: 'Yozish' },
  { kind: 'vocabulary', ko: '단어', label: 'Lug‘at' },
  { kind: 'grammar', ko: '문법', label: 'Grammatika' },
  { kind: 'homework', label: 'Uyga vazifa' },
  { kind: 'other', label: 'Boshqa reja' },
];
const planIcons = {
  reading: BookOpen,
  listening: Headphones,
  speaking: Mic,
  writing: PenLine,
  vocabulary: Languages,
  grammar: Sparkles,
  homework: NotebookPen,
  other: CircleDashed,
};
const PLAN_MINUTES = [10, 15, 20, 30, 45, 60];

function HangangScene() {
  return (
    <svg className="hangang-scene" viewBox="0 0 180 110" fill="none" aria-hidden="true">
      <circle cx="126" cy="31" r="21" fill="var(--blue-fill)" />
      <path
        d="M19 79C38 67 45 57 62 66C78 75 83 47 105 47C126 47 138 73 166 78"
        fill="var(--blue-light)"
      />
      <path
        d="M9 89C38 75 59 91 85 84C119 74 135 86 174 81M22 98C64 85 79 103 113 92C133 85 152 94 173 90"
        stroke="var(--blue-border)"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <g stroke="var(--blue)" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round">
        <path d="M101 48L103 27H109L111 48M102 26H110L112 22H100L102 26ZM106 22V7M103 17H109" />
        <path d="M35 77V65H68V78M30 64C38 63 45 57 51 52C57 57 64 63 73 64H30Z" />
        <path d="M34 58C41 58 47 54 51 51C55 54 61 58 68 58M42 76V68H49V76M56 76V68H62V77" />
      </g>
      <path
        d="M141 56Q145 52 149 56Q153 52 157 56M15 33Q19 29 23 33Q27 29 31 33"
        stroke="var(--blue-border)"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function StudentHome({
  data,
  user,
  start,
  go,
  notify,
  refresh,
}: {
  data: StudentData;
  user: User;
  start: StartQuiz;
  go: (path: string) => void;
  notify: (message: string) => void;
  refresh: () => void;
}) {
  const [sheet, setSheet] = useState<{ type: 'tasks' | 'practice'; skill: HomeSkill } | null>(null);
  const [planOpen, setPlanOpen] = useState(false);
  const [planDraft, setPlanDraft] = useState<TodayPlanItem[]>([]);
  const [planKind, setPlanKind] = useState<TodayPlanItem['kind']>('reading');
  const [planMinutes, setPlanMinutes] = useState(20);
  const [planCustomTitle, setPlanCustomTitle] = useState('');
  const [planSaving, setPlanSaving] = useState(false);
  const [planUpdating, setPlanUpdating] = useState<string | null>(null);
  const [planChecks, setPlanChecks] = useState<Record<string, boolean>>({});
  const tasks = homeTasks(data);
  const requiredTasks = tasks.filter((task) => task.source === 'lesson' && task.required);
  const additionalTasks = tasks.filter((task) => task.source === 'extra');
  const progress = taskSummary(requiredTasks);
  const plan = data.todayPlan;
  const courses = data.courses;
  const level = COURSE_LEVELS.find((l) => l.id === courses.level)?.label || data.group?.level;
  const skill = HOME_SKILLS.find((s) => s.id === sheet?.skill);
  const skillTasks = requiredTasks.filter((t) => t.kind === sheet?.skill);
  const practice = courses.releases.flatMap((r) =>
    r.materials
      .filter((m) => m.kind === sheet?.skill)
      .map((m) => ({
        id: `${r.id}-${m.id}`,
        title: m.title,
        lesson: `${r.position}-dars · ${r.title}`,
        path: `/lessons/${r.id}#material-${m.id}`,
      })),
  );
  const live = courses.releases.filter((r) => r.liveQuiz);
  const giftReady = Math.floor(courses.points / 100) > courses.gifts;
  const nextMilestone = (Math.floor(courses.points / 100) + 1) * 100;
  function openTask(task: HomeTask) {
    setSheet(null);
    if (task.path) go(task.path);
    else if (
      task.assignment &&
      (task.assignment.kind === 'grammar' || task.assignment.kind === 'vocabulary')
    )
      start(task.assignment.kind, 'practice', undefined, task.assignment.id);
  }
  function editPlan() {
    setPlanDraft(plan.items);
    setPlanOpen(true);
  }
  function addPlanItem() {
    if (planDraft.length >= 12) {
      notify('Checklistda ko‘pi bilan 12 ta band bo‘lishi mumkin.');
      return;
    }
    const activity = PLAN_ACTIVITIES.find((item) => item.kind === planKind)!;
    const title =
      planKind === 'other'
        ? planCustomTitle.trim()
        : `${activity.ko ? `${activity.ko} · ` : ''}${activity.label}`;
    if (!title) {
      notify('Rejangiz nomini yozing.');
      return;
    }
    setPlanDraft((current) => [
      ...current,
      { id: crypto.randomUUID(), kind: planKind, title, minutes: planMinutes, complete: false },
    ]);
    setPlanCustomTitle('');
  }
  async function savePlan(event: React.FormEvent) {
    event.preventDefault();
    if (planSaving) return;
    setPlanSaving(true);
    try {
      await api('study/today-plan', {
        method: 'POST',
        body: JSON.stringify({ items: planDraft }),
      });
      setPlanOpen(false);
      notify('Bugungi rejangiz saqlandi.');
      refresh();
    } catch (error) {
      notify(errorText(error));
    } finally {
      setPlanSaving(false);
    }
  }
  async function togglePlanItem(itemId: string, complete: boolean) {
    if (planUpdating) return;
    const currentItems = plan.items.map((item) => ({
      ...item,
      complete: planChecks[item.id] ?? item.complete,
    }));
    const previous = currentItems.find((item) => item.id === itemId)?.complete ?? false;
    setPlanChecks((current) => ({ ...current, [itemId]: complete }));
    setPlanUpdating(itemId);
    try {
      await api('study/today-plan', {
        method: 'POST',
        body: JSON.stringify({
          items: currentItems.map((item) => (item.id === itemId ? { ...item, complete } : item)),
        }),
      });
      await Promise.resolve(refresh());
    } catch (error) {
      setPlanChecks((current) => ({ ...current, [itemId]: previous }));
      notify(errorText(error));
    } finally {
      setPlanUpdating(null);
    }
  }
  return (
    <div className="student-home">
      <header className="home-welcome">
        <div className="home-welcome-copy">
          <div className="home-group-label">
            <span />
            {courses.groupName || 'Mening o‘rganish makonim'}
            {level && <b>{level}</b>}
          </div>
          <h1>
            <span lang="ko">안녕하세요,</span> <br />
            {user.name.split(' ')[0]} <span className="home-greeting-dot">:)</span>
          </h1>
          <p>Bugun ham bir qadam oldinga.</p>
        </div>
        <HangangScene />
      </header>

      <div className="home-focus-layout">
        <section className="home-homework" aria-labelledby="homework-title">
          <div className="home-section-heading">
            <div>
              <span className="home-overline" lang="ko">
                나의 학습
              </span>
              <h2 id="homework-title">Vazifalarim</h2>
            </div>
            <span
              className="home-progress-count"
              aria-label={`${progress.done} ta vazifa bajarilgan, jami ${progress.total} ta`}
            >
              <b>{progress.done}</b> / {progress.total}
            </span>
          </div>
          <p className="home-section-note">Ustoz ochgan darslar bo‘yicha</p>
          <div
            className="home-progress-track"
            role="progressbar"
            aria-label="Vazifalar bajarilishi"
            aria-valuenow={progress.total ? Math.round((progress.done / progress.total) * 100) : 0}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <span
              style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }}
            />
          </div>
          <div className="home-skills">
            {HOME_SKILLS.map((s) => {
              const summary = taskSummary(requiredTasks.filter((t) => t.kind === s.id));
              const Icon = skillIcons[s.id];
              const StatusIcon = statusIcons[summary.status];
              const content = (
                <>
                  <div className="home-skill-top">
                    <span className={`home-skill-icon ${s.id}`}>
                      <Icon size={22} strokeWidth={1.7} />
                    </span>
                    <div className="home-skill-name">
                      <h3 lang="ko">{s.ko}</h3>
                      <span className="home-skill-uz">{s.label}</span>
                    </div>
                  </div>
                  <div className="home-skill-status">
                    <StatusIcon size={14} />
                    <strong>{summary.label}</strong>
                  </div>
                  <span className="home-skill-detail">
                    {!summary.total
                      ? 'Ustoz hali bermagan'
                      : summary.todo
                        ? `${summary.todo} ta qoldi · ${summary.done}/${summary.total} bajarildi`
                        : summary.submitted
                          ? `${summary.submitted} ta ustoz tekshiruvida`
                          : `${summary.total} ta vazifa · barakalla!`}
                  </span>
                </>
              );
              return summary.total ? (
                <button
                  key={s.id}
                  className={`home-skill-card ${summary.status}`}
                  data-skill={s.id}
                  onClick={() => setSheet({ type: 'tasks', skill: s.id })}
                  aria-label={`${s.ko} · ${s.label}: ${summary.label}`}
                >
                  {content}
                </button>
              ) : (
                <article
                  key={s.id}
                  className="home-skill-card empty"
                  data-skill={s.id}
                  aria-label={`${s.ko} · ${s.label}: Vazifa yo‘q`}
                >
                  {content}
                </article>
              );
            })}
          </div>
          {progress.todo > 0 ? (
            <p className="home-hero-foot">
              <span className="home-todo-dot" />
              {progress.todo} ta vazifa sizni kutyapti. Boshlaymizmi?
            </p>
          ) : progress.submitted > 0 ? (
            <p className="home-hero-foot">
              <Clock3 size={15} />
              Topshiriqlaringiz ustoz tekshiruvida.
            </p>
          ) : progress.total > 0 ? (
            <p className="home-hero-foot">
              <Check size={15} />
              Hammasi bajarildi. <span lang="ko">잘했어요!</span>
            </p>
          ) : (
            <p className="home-hero-foot">
              <CircleDashed size={15} />
              Yangi vazifalar shu yerda ko‘rinadi.
            </p>
          )}
        </section>

        <section
          className={`home-today-plan ${plan.complete ? 'complete' : ''}`}
          aria-labelledby="today-plan-title"
        >
          <div className="home-section-heading">
            <div>
              <span className="home-overline" lang="ko">
                오늘의 계획
              </span>
              <h2 id="today-plan-title">Bugungi rejam</h2>
            </div>
            <span className="home-plan-time">
              {plan.complete ? <Check size={15} /> : <Clock3 size={14} />}
              {!plan.configured
                ? 'Belgilanmagan'
                : plan.complete
                  ? 'Bajarildi'
                  : `${plan.estimatedMinutes} daqiqa qoldi`}
            </span>
          </div>
          <p className="home-plan-question">O‘zingiz uchun bugungi checklist</p>
          <strong className="home-plan-answer">{plan.headline}</strong>
          {!plan.configured ? (
            <div className="home-plan-build">
              <span>
                <Check size={21} />
              </span>
              <div>
                <strong>Bugungi rejangizni yozing</strong>
                <small>Masalan: 읽기 · O‘qish — 20 daqiqa.</small>
              </div>
              <button className="button primary" onClick={editPlan}>
                Reja tuzish
              </button>
            </div>
          ) : plan.items.length ? (
            <div className="home-plan-list">
              {plan.items.map((item) => {
                const Icon = planIcons[item.kind];
                return (
                  <label
                    key={item.id}
                    className={`home-plan-item ${item.complete ? 'completed' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={planChecks[item.id] ?? item.complete}
                      disabled={!!planUpdating}
                      onChange={(event) => togglePlanItem(item.id, event.target.checked)}
                      aria-label={`${item.title} bajarildi`}
                    />
                    <span className={`home-plan-icon ${item.kind}`}>
                      <Icon size={18} strokeWidth={1.8} />
                    </span>
                    <span className="home-plan-copy">
                      <strong>{item.title}</strong>
                      <small>{item.minutes} daqiqa</small>
                    </span>
                    {planUpdating === item.id && (
                      <Clock3 className="home-plan-updating" size={16} />
                    )}
                  </label>
                );
              })}
            </div>
          ) : (
            <div className="home-plan-done">
              <span>
                <Check size={23} />
              </span>
              <div>
                <strong>Bugungi checklist bajarildi</strong>
                <small>Ertaga yangi reja tuzishingiz mumkin.</small>
              </div>
            </div>
          )}
          <div className="home-plan-footer">
            <p className="home-plan-rule">
              <Check size={14} />
              Bu shaxsiy rejangiz, vazifalardan alohida.
            </p>
            {plan.configured && <button onClick={editPlan}>O‘zgartirish</button>}
          </div>
        </section>
      </div>

      <section className="home-extra home-secondary-section" aria-labelledby="practice-title">
        <div className="home-section-heading">
          <div>
            <span className="home-overline" lang="ko">
              조금씩, 매일
            </span>
            <h2 id="practice-title">Qo‘shimcha mashqlar</h2>
          </div>
          <Sparkles size={22} />
        </div>
        <p className="home-section-note">O‘z sur’atingizda, o‘zingiz uchun.</p>
        <div className="home-practice-grid">
          {HOME_SKILLS.map((s) => {
            const Icon = skillIcons[s.id];
            return (
              <button
                key={s.id}
                className={`home-practice-link ${s.id}`}
                onClick={() => setSheet({ type: 'practice', skill: s.id })}
                aria-label={`${s.ko} · ${s.label} uchun qo‘shimcha mashqlar`}
              >
                <Icon size={21} strokeWidth={1.7} />
                <span>
                  <strong lang="ko">{s.ko}</strong>
                  <small>{s.label}</small>
                </span>
                <ArrowUpRight size={16} />
              </button>
            );
          })}
        </div>
        <button
          className="home-word-quiz"
          onClick={() => (data.words.length >= 2 ? start('vocabulary') : go('/vocabulary'))}
        >
          <span className="home-word-art" aria-hidden="true">
            <span lang="ko">가</span>
            <span>A</span>
          </span>
          <span className="home-word-copy">
            <small>단어 QUIZ</small>
            <strong>So‘z yodlaymiz</strong>
            <span>Quiz bilan eslab qoling</span>
          </span>
          <span className="home-word-arrow">
            <ArrowRight size={20} />
          </span>
        </button>
        <div className="home-small-links">
          <button onClick={() => go('/grammar')}>
            <BookOpen size={17} />
            Grammatika
            <ChevronRight size={15} />
          </button>
          <button onClick={() => go('/notebook')}>
            <NotebookPen size={17} />
            Daftarim
            <ChevronRight size={15} />
          </button>
        </div>
        {data.access.topik && (
          <button className="home-daily-link" onClick={() => go('/daily')}>
            <RotateCcw size={18} />
            <span>
              <strong>Kunlik takrorlash</strong>
              <small>10, 20 yoki 30 daqiqalik reja</small>
            </span>
            <ChevronRight size={16} />
          </button>
        )}
      </section>

      {live.map((r) => (
        <button className="home-live" key={r.id} onClick={() => go(`/lessons/${r.id}`)}>
          <span className="home-live-icon">
            <Radio size={22} />
          </span>
          <span>
            <small>HOZIR OCHIQ</small>
            <strong>Dars oldi quizi</strong>
            <span>{r.title}</span>
          </span>
          <ArrowRight size={20} />
        </button>
      ))}

      {additionalTasks.length > 0 && (
        <section className="home-secondary-section">
          <div className="home-section-heading">
            <h2>Qo‘shimcha vazifalar</h2>
            <span className="home-muted-count">
              {additionalTasks.filter((t) => t.status === 'done').length}/{additionalTasks.length}
            </span>
          </div>
          <div className="home-additional-groups">
            {HOME_SKILLS.map((item) => {
              const grouped = additionalTasks.filter((task) => task.kind === item.id);
              if (!grouped.length) return null;
              return (
                <div className="home-task-group" key={item.id}>
                  <div className="home-task-group-title">
                    <strong lang="ko">{item.ko}</strong>
                    <span>{item.label}</span>
                    <small>{grouped.length} ta</small>
                  </div>
                  <div className="home-task-list">
                    {grouped.map((task) => (
                      <TaskRow key={task.id} task={task} onClick={() => openTask(task)} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {courses.managed && (
        <section className="home-secondary-section" aria-labelledby="recent-lessons-title">
          <div className="home-section-heading">
            <h2 id="recent-lessons-title">Darslarim</h2>
            <button className="home-text-link" onClick={() => go('/lessons')}>
              Barchasi
              <ArrowRight size={16} />
            </button>
          </div>
          {courses.releases.length ? (
            <div className="home-lesson-list">
              {courses.releases.slice(0, 2).map((r) => {
                const summary = taskSummary(r.tasks);
                return (
                  <button
                    key={r.id}
                    className="home-lesson-link"
                    onClick={() => go(`/lessons/${r.id}`)}
                  >
                    <span className="home-lesson-number">
                      {String(r.position).padStart(2, '0')}
                    </span>
                    <span>
                      <strong>{r.title}</strong>
                      <small>
                        {r.lesson_date} ·{' '}
                        {summary.total
                          ? `${summary.done}/${summary.total} bajarilgan`
                          : 'Materiallarni ko‘rish'}
                      </small>
                    </span>
                    <ChevronRight size={18} />
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="home-calm-empty">
              <BookOpen size={24} />
              <p>
                Ustoz darslarni tayyorlamoqda.
                <br />
                Dars ochilgach, materiallar shu yerda bo‘ladi.
              </p>
            </div>
          )}
        </section>
      )}

      <div className="home-support-grid">
        {courses.managed && (
          <button className="home-gift-card" onClick={() => go('/my-group')}>
            <span className="home-gift-icon">
              <Gift size={25} strokeWidth={1.6} />
            </span>
            <span className="home-gift-copy">
              <span className="home-gift-title">
                <strong>{courses.points} ball</strong>
                <span>
                  <Trophy size={13} />
                  Kitob sari
                </span>
              </span>
              <span className="home-gift-track">
                <span style={{ width: `${giftReady ? 100 : courses.points % 100}%` }} />
              </span>
              <small>
                {giftReady
                  ? '100 ball yig‘ildi! Sovg‘angizni ustozdan so‘rang.'
                  : `Kitob sovg‘asigacha ${nextMilestone - courses.points} ball qoldi.`}
              </small>
            </span>
            <ChevronRight size={17} />
          </button>
        )}
        <section className="home-week" aria-label="Oxirgi 7 kundagi faollik">
          <div className="home-section-heading">
            <h2>Haftalik quiz faolligi</h2>
            <span>{data.stats.weekDays}/7 kun</span>
          </div>
          <div className="home-week-days">
            {data.week.map((day, i) => (
              <div
                key={day.date}
                className={`${day.completed ? 'done' : ''} ${i === 6 ? 'today' : ''}`}
              >
                <span>
                  {day.completed ? <Check size={17} /> : <span className="home-week-dot" />}
                </span>
                <small>{i === 6 ? 'Bugun' : day.day}</small>
              </div>
            ))}
          </div>
        </section>
      </div>

      {sheet && skill && (
        <Modal
          title={`${skill.ko} · ${skill.label}${sheet.type === 'practice' ? ' mashqlari' : ' vazifalari'}`}
          onClose={() => setSheet(null)}
        >
          <div className="home-sheet-content">
            {sheet.type === 'tasks' ? (
              <>
                <p>Bajarilmagan vazifalar avval ko‘rsatiladi.</p>
                <div className="home-task-list">
                  {skillTasks.map((task) => (
                    <TaskRow key={task.id} task={task} onClick={() => openTask(task)} />
                  ))}
                </div>
              </>
            ) : (
              <>
                <p>O‘tilgan darslardan mashq tanlang.</p>
                {practice.map((p) => (
                  <button
                    key={p.id}
                    className="home-sheet-link"
                    onClick={() => {
                      setSheet(null);
                      go(p.path);
                    }}
                  >
                    <span>
                      <small>{p.lesson}</small>
                      <strong>{p.title}</strong>
                    </span>
                    <ArrowUpRight size={19} />
                  </button>
                ))}
                {sheet.skill === 'reading' && data.access.topik && (
                  <button
                    className="home-sheet-link"
                    onClick={() => {
                      setSheet(null);
                      go('/topik');
                    }}
                  >
                    <span>
                      <small>Mustaqil mashq</small>
                      <strong>TOPIK II · 읽기</strong>
                    </span>
                    <ArrowUpRight size={19} />
                  </button>
                )}
                {!practice.length && !(sheet.skill === 'reading' && data.access.topik) && (
                  <div className="home-calm-empty">
                    <BookOpen size={28} />
                    <h3>Hozircha mashq yo‘q</h3>
                    <p>
                      Ustoz {skill.label.toLocaleLowerCase('uz')} uchun dars materiali ochgach, bu
                      yerda takrorlay olasiz.
                    </p>
                    <button
                      className="button secondary"
                      onClick={() => {
                        setSheet(null);
                        go('/vocabulary');
                      }}
                    >
                      <Languages size={17} />
                      Hozir lug‘atni takrorlash
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </Modal>
      )}

      {planOpen && (
        <Modal title="Bugungi rejamni tuzish" onClose={() => setPlanOpen(false)}>
          <form className="home-plan-editor" onSubmit={savePlan}>
            <div>
              <span className="home-overline" lang="ko">
                오늘의 체크리스트
              </span>
              <h3>O‘zingiz uchun oddiy checklist tuzing</h3>
              <p>Faoliyatni va unga ajratmoqchi bo‘lgan vaqtingizni tanlang.</p>
            </div>
            <div className="home-plan-composer">
              <label>
                <span>Faoliyat</span>
                <select
                  value={planKind}
                  onChange={(event) => setPlanKind(event.target.value as TodayPlanItem['kind'])}
                  aria-label="Reja faoliyati"
                >
                  {PLAN_ACTIVITIES.map((activity) => (
                    <option key={activity.kind} value={activity.kind}>
                      {activity.ko ? `${activity.ko} · ` : ''}
                      {activity.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Vaqt</span>
                <select
                  value={planMinutes}
                  onChange={(event) => setPlanMinutes(Number(event.target.value))}
                  aria-label="Reja davomiyligi"
                >
                  {PLAN_MINUTES.map((minutes) => (
                    <option key={minutes} value={minutes}>
                      {minutes} daqiqa
                    </option>
                  ))}
                </select>
              </label>
              {planKind === 'other' && (
                <label className="home-plan-custom-title">
                  <span>Reja nomi</span>
                  <input
                    value={planCustomTitle}
                    maxLength={80}
                    onChange={(event) => setPlanCustomTitle(event.target.value)}
                    placeholder="Masalan: Koreyscha film ko‘rish"
                    aria-label="Boshqa reja nomi"
                  />
                </label>
              )}
              <button
                type="button"
                className="button secondary home-plan-add"
                onClick={addPlanItem}
                disabled={
                  planDraft.length >= 12 || (planKind === 'other' && !planCustomTitle.trim())
                }
              >
                <Plus size={17} />
                Band qo‘shish
              </button>
            </div>
            {planDraft.length ? (
              <div className="home-plan-draft" aria-label="Tanlangan reja bandlari">
                {planDraft.map((item, index) => {
                  const Icon = planIcons[item.kind];
                  return (
                    <div key={item.id} className="home-plan-draft-row">
                      <span className={`home-plan-icon ${item.kind}`}>
                        <Icon size={18} />
                      </span>
                      <span className="home-plan-draft-copy">
                        <small>{index + 1}-band</small>
                        <strong>{item.title}</strong>
                      </span>
                      <label>
                        <select
                          value={item.minutes}
                          onChange={(event) =>
                            setPlanDraft((current) =>
                              current.map((candidate) =>
                                candidate.id === item.id
                                  ? { ...candidate, minutes: Number(event.target.value) }
                                  : candidate,
                              ),
                            )
                          }
                          aria-label={`${item.title} davomiyligi`}
                        >
                          {PLAN_MINUTES.map((minutes) => (
                            <option key={minutes} value={minutes}>
                              {minutes} daq
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        type="button"
                        onClick={() =>
                          setPlanDraft((current) =>
                            current.filter((candidate) => candidate.id !== item.id),
                          )
                        }
                        aria-label={`${item.title} bandini o‘chirish`}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="home-plan-empty-draft">
                <Check size={20} />
                <span>Checklist hali bo‘sh. Birinchi bandni qo‘shing.</span>
              </div>
            )}
            {!!planDraft.length && (
              <p className="home-plan-total">
                Jami:{' '}
                <strong>{planDraft.reduce((sum, item) => sum + item.minutes, 0)} daqiqa</strong>
              </p>
            )}
            <div className="home-plan-editor-actions">
              <button type="button" className="button secondary" onClick={() => setPlanOpen(false)}>
                Bekor qilish
              </button>
              <SubmitButton busy={planSaving} disabled={!planDraft.length}>
                Rejani saqlash
              </SubmitButton>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function TaskRow({ task, onClick }: { task: HomeTask; onClick: () => void }) {
  const summary = taskSummary([task]);
  const Icon = statusIcons[summary.status];
  const skill = HOME_SKILLS.find((item) => item.id === task.kind)!;
  return (
    <button className={`home-task-row ${task.status}`} onClick={onClick}>
      <span className="home-task-symbol">
        <Icon size={18} />
      </span>
      <span>
        <small>
          {task.lesson} · <span lang="ko">{skill.ko}</span> {skill.label}
        </small>
        <strong>{task.title}</strong>
        <span className="home-task-caption">
          {summary.label}
          {task.status === 'todo' && ` · ${dateLabel(task.dueAt)} gacha`}
        </span>
      </span>
      <ChevronRight size={18} />
    </button>
  );
}
