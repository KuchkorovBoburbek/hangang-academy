'use client';
import { useEffect, useState, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  Trophy,
  LayoutDashboard,
  Languages,
  BookOpen,
  PenLine,
  NotebookPen,
  Settings,
  LogOut,
  Users,
  ClipboardCheck,
  LibraryBig,
  Bell,
  ChevronRight,
  ArrowUpRight,
  Check,
  Link2,
  LoaderCircle,
  Grid2X2,
  RotateCcw,
} from 'lucide-react';
import type { User, Submission } from '@/lib/types';
import { Brand, Loading, api, errorText, Badge, SubmitButton, Modal } from './ui';
import { PracticeLibrary, Writing, Notebook, type StudentData, type StartQuiz } from './student';
import StudentHome from './student-home';
import {
  TeacherHome,
  Groups,
  Reviews,
  ReviewDetail,
  ContentManager,
  type TeacherData,
} from './teacher';
import Quiz, { type SessionView } from './quiz';
import Topik from './topik';
import { CourseStudio, CourseHome, StudentLesson, GroupBoard, TeacherCourseBoard } from './courses';
import VocabularyHub from './vocabulary';
import DailyPractice from './daily-practice';
import SolutionEditor from './solution-editor';
import StudyAssignmentView from './study-assignment';
type State = {
  user: User;
  demo: boolean;
  integrations: { ai: boolean; telegram: boolean; model: string; provider: string };
} & (StudentData | TeacherData);
const studentNav = [
  { path: '/', label: 'Bugungi kun', icon: LayoutDashboard },
  { path: '/vocabulary', label: 'Lug‘at', icon: Languages },
  { path: '/grammar', label: 'Grammatika', icon: BookOpen },
  { path: '/topik', label: 'TOPIK 읽기', icon: ClipboardCheck },
  { path: '/writing', label: 'Yozma vazifalar', icon: PenLine },
  { path: '/notebook', label: 'Mening daftarim', icon: NotebookPen },
  { path: '/daily', label: 'Kunlik takrorlash', icon: RotateCcw },
];
const teacherNav = [
  { path: '/', label: 'Umumiy ko‘rinish', icon: LayoutDashboard },
  { path: '/courses', label: 'Dars dasturlari', icon: BookOpen },
  { path: '/groups', label: 'Guruhlar va vazifalar', icon: Users },
  { path: '/group-results', label: 'Guruh natijalari', icon: Trophy },
  { path: '/reviews', label: 'Tekshirish', icon: ClipboardCheck },
  { path: '/vocabulary', label: 'Lug‘at', icon: Languages },
  { path: '/content', label: 'Quiz bazasi', icon: LibraryBig },
];
export default function Academy() {
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    if (pathname === '/topik/vocabulary' || pathname === '/topik/idioms')
      router.replace(
        pathname.endsWith('idioms') ? '/vocabulary/reading/idioms' : '/vocabulary/reading',
      );
  }, [pathname, router]);
  const [state, setState] = useState<State | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [quiz, setQuiz] = useState<SessionView | null>(null);
  const [starting, setStarting] = useState(false);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const refresh = useCallback(async () => {
    try {
      const result = await api<State>('state');
      setState(result);
      setError('');
    } catch (e) {
      if (errorText(e).includes('Hisobingizga')) router.replace('/login');
      else setError(errorText(e));
    }
  }, [router]);
  useEffect(() => {
    refresh();
  }, [refresh, pathname]);
  useEffect(() => {
    if (notice) {
      const t = setTimeout(() => setNotice(''), 5000);
      return () => clearTimeout(t);
    }
  }, [notice]);
  const start: StartQuiz = async (kind, mode = 'practice', topicId, assignmentId) => {
    if (starting) return;
    setStarting(true);
    try {
      setQuiz(
        await api<SessionView>('quiz/start', {
          method: 'POST',
          body: JSON.stringify({ kind, mode, topicId, assignmentId }),
        }),
      );
    } catch (e) {
      setNotice(errorText(e));
    } finally {
      setStarting(false);
    }
  };
  async function logout() {
    await api('logout', { method: 'POST', body: '{}' });
    router.replace('/login');
  }
  const go = (p: string) => {
    setMenuOpen(false);
    router.push(p);
  };
  if (!state)
    return error ? (
      <div className="loading">
        <Brand />
        <div className="alert error">{error}</div>
        <button className="button primary" onClick={refresh}>
          Qayta urinish
        </button>
        <a href="/login">Kirish sahifasi</a>
      </div>
    ) : (
      <Loading />
    );
  const isTeacher = state.user.role === 'teacher';
  const nav = isTeacher
    ? [
        ...teacherNav,
        ...(state.user.content_editor
          ? [{ path: '/solutions', label: 'TOPIK yechimlari', icon: BookOpen }]
          : []),
      ]
    : (state as State & StudentData).courses?.managed
      ? [
          { path: '/', label: 'Bugungi kun', icon: LayoutDashboard },
          { path: '/lessons', label: 'Darslarim', icon: BookOpen },
          { path: '/my-group', label: 'Guruhim', icon: Users },
          ...studentNav.filter(
            (n) =>
              n.path !== '/' &&
              (!['/topik', '/daily'].includes(n.path) ||
                (state as State & StudentData).access.topik),
          ),
        ]
      : studentNav;
  const page = nav.find(
    (n) =>
      n.path === pathname ||
      ['topik', 'vocabulary', 'lessons'].some(
        (p) => n.path === '/' + p && pathname.startsWith('/' + p + '/'),
      ),
  );
  const title = pathname === '/settings' ? 'Sozlamalar' : page?.label || 'HangangAcademy';
  const student = state as State & StudentData;
  const teacher = state as State & TeacherData;
  const mobileNav = isTeacher
    ? nav
    : [
        { path: '/', label: 'Bosh sahifa', icon: LayoutDashboard },
        student.courses.managed
          ? { path: '/lessons', label: 'Darslar', icon: BookOpen }
          : { path: '/writing', label: 'Vazifalar', icon: PenLine },
        { path: '/vocabulary', label: 'Lug‘at', icon: Languages },
        student.courses.managed
          ? { path: '/my-group', label: 'Guruhim', icon: Users }
          : { path: '/grammar', label: 'Grammatika', icon: BookOpen },
      ];
  return (
    <div
      className={`app-shell ${!isTeacher ? 'student-shell' : ''} ${!isTeacher && pathname === '/' ? 'student-home-shell' : ''}`}
    >
      <aside className="sidebar">
        <Brand />
        <div className="workspace-label">{isTeacher ? 'O‘QITUVCHI PANELI' : 'O‘QUVCHI MAKONI'}</div>
        <nav aria-label="Asosiy menyu">
          {nav.map((n) => (
            <button
              key={n.path}
              className={`nav-item ${pathname === n.path || ['topik', 'vocabulary', 'lessons'].some((p) => n.path === '/' + p && pathname.startsWith('/' + p + '/')) ? 'active' : ''}`}
              onClick={() => go(n.path)}
            >
              <n.icon size={20} />
              <span>{n.label}</span>
              {n.path === '/reviews' && isTeacher && teacher.stats.pending > 0 && (
                <b>{teacher.stats.pending}</b>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-brand-note">
            <span>한강</span>
            <strong>Birga o‘rganamiz.</strong>
            <p>Har kuni, o‘z sur’atingizda.</p>
          </div>
          <button
            className={`nav-item ${pathname === '/settings' ? 'active' : ''}`}
            onClick={() => go('/settings')}
          >
            <Settings size={20} />
            Sozlamalar
          </button>
          <button className="account-button" onClick={() => go('/settings')}>
            <div className="avatar">{state.user.name[0]}</div>
            <div>
              <strong>{state.user.name}</strong>
              <small>{isTeacher ? 'O‘qituvchi' : student.group?.name || 'O‘quvchi'}</small>
            </div>
            <ChevronRight size={17} />
          </button>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            <span>O‘rganish makoni</span>
            <ChevronRight size={14} />
            <strong>{title}</strong>
          </div>
          <div className="mobile-brand">
            <Brand />
          </div>
          <div className="topbar-right">
            {state.demo && <Badge tone="neutral">Sinov muhiti</Badge>}
            <span className="topbar-korean">오늘도 화이팅!</span>
            <button
              className="icon-button notification-button"
              onClick={() => go('/settings')}
              aria-label="Eslatmalar sozlamalari"
            >
              <Bell size={20} />
            </button>
            <button
              className="avatar small avatar-button"
              onClick={() => go('/settings')}
              aria-label="Hisob sozlamalari"
            >
              {state.user.name[0]}
            </button>
          </div>
        </header>
        <main className="main-content" id="main-content">
          {error && (
            <div className="alert error">
              {error}
              <button onClick={refresh}>Yangilash</button>
            </div>
          )}
          {pathname === '/settings' ? (
            <SettingsPage
              user={state.user}
              integrations={state.integrations}
              refresh={refresh}
              notify={setNotice}
              logout={logout}
            />
          ) : pathname === '/vocabulary' || pathname.startsWith('/vocabulary/') ? (
            <VocabularyHub
              key={pathname}
              user={state.user}
              groups={isTeacher ? teacher.groups : []}
              initialSection={pathname.split('/')[2]}
              initialKind={pathname.split('/')[3]}
              go={go}
              notify={setNotice}
              refresh={refresh}
              aiEnabled={state.integrations.ai}
            />
          ) : isTeacher ? (
            <>
              {pathname === '/' ? (
                <TeacherHome data={teacher} go={go} openReview={setSubmission} />
              ) : pathname === '/courses' ? (
                <CourseStudio notify={setNotice} refresh={refresh} />
              ) : pathname === '/group-results' ? (
                <TeacherCourseBoard groups={teacher.groups} notify={setNotice} />
              ) : pathname === '/groups' ? (
                <Groups data={teacher} refresh={refresh} notify={setNotice} />
              ) : pathname === '/reviews' ? (
                <Reviews data={teacher} openReview={setSubmission} />
              ) : pathname === '/solutions' && !!state.user.content_editor ? (
                <SolutionEditor />
              ) : pathname === '/content' ? (
                <ContentManager data={teacher} refresh={refresh} notify={setNotice} />
              ) : (
                <AccessFallback go={go} />
              )}
            </>
          ) : (
            <>
              {pathname === '/lessons' ? (
                <CourseHome data={student.courses} name={state.user.name} go={go} />
              ) : pathname.startsWith('/lessons/') ? (
                <StudentLesson
                  key={pathname}
                  releaseId={pathname.split('/')[2]}
                  notify={setNotice}
                />
              ) : pathname === '/my-group' && state.user.group_id ? (
                <GroupBoard groupId={state.user.group_id} teacher={false} notify={setNotice} />
              ) : pathname === '/' ? (
                <StudentHome data={student} user={state.user} start={start} go={go} />
              ) : pathname.startsWith('/assignment/') ? (
                <StudyAssignmentView
                  assignmentId={pathname.split('/')[2]}
                  notify={setNotice}
                  refresh={refresh}
                />
              ) : pathname === '/daily' ? (
                <DailyPractice notify={setNotice} onRefresh={refresh} />
              ) : pathname === '/grammar' ? (
                <PracticeLibrary
                  key={pathname}
                  kind="grammar"
                  data={student}
                  start={start}
                  refresh={refresh}
                  notify={setNotice}
                  go={go}
                />
              ) : pathname === '/topik' || pathname.startsWith('/topik/') ? (
                student.access.topik ? (
                  <Topik initialTab={pathname.split('/')[2]} notify={setNotice} />
                ) : (
                  <AccessFallback go={go} />
                )
              ) : pathname === '/writing' ? (
                <Writing data={student} refresh={refresh} notify={setNotice} />
              ) : pathname === '/notebook' ? (
                <Notebook data={student} refresh={refresh} notify={setNotice} />
              ) : (
                <AccessFallback go={go} />
              )}
            </>
          )}
          <footer className="app-footer">
            <span>© {new Date().getFullYear()} HangangAcademy</span>
            <span>배움이 이어지는 곳 · O‘rganish davom etadi</span>
          </footer>
        </main>
      </div>
      <nav className="mobile-nav topik-student-nav" aria-label="Telefon menyusi">
        {mobileNav.map((n) => (
          <button
            key={n.path}
            className={
              pathname === n.path ||
              ['topik', 'vocabulary', 'lessons'].some(
                (p) => n.path === '/' + p && pathname.startsWith('/' + p + '/'),
              )
                ? 'active'
                : ''
            }
            onClick={() => go(n.path)}
          >
            <n.icon size={21} />
            <span>
              {n.path === '/topik'
                ? 'TOPIK'
                : n.label === 'Yozma vazifalar'
                  ? 'Yozuv'
                  : n.label === 'Mening daftarim'
                    ? 'Daftarim'
                    : n.label === 'Guruhlar va vazifalar'
                      ? 'Guruhlar'
                      : n.label === 'Umumiy ko‘rinish'
                        ? 'Asosiy'
                        : n.label}
            </span>
          </button>
        ))}
        {!isTeacher && (
          <button
            className={
              menuOpen ||
              !mobileNav.some(
                (n) => n.path === pathname || (n.path !== '/' && pathname.startsWith(n.path + '/')),
              )
                ? 'active'
                : ''
            }
            aria-expanded={menuOpen}
            aria-haspopup="dialog"
            onClick={() => setMenuOpen(true)}
          >
            <Grid2X2 size={21} />
            <span>Yana</span>
          </button>
        )}
      </nav>
      {menuOpen && !isTeacher && (
        <Modal title="Barcha bo‘limlar" onClose={() => setMenuOpen(false)}>
          <div className="student-menu-links">
            {[...nav, { path: '/settings', label: 'Sozlamalar', icon: Settings }].map((n) => (
              <button
                key={n.path}
                className={pathname === n.path ? 'active' : ''}
                onClick={() => go(n.path)}
              >
                <n.icon size={21} />
                <span>{n.label}</span>
                <ChevronRight size={18} />
              </button>
            ))}
          </div>
        </Modal>
      )}
      {notice && (
        <div className="toast" role="status">
          <Check size={18} />
          {notice}
          <button onClick={() => setNotice('')} aria-label="Xabarni yopish">
            ×
          </button>
        </div>
      )}
      {starting && (
        <div className="toast">
          <LoaderCircle size={18} className="spin" />
          Mashq tayyorlanmoqda…
        </div>
      )}
      {quiz && (
        <Quiz
          initial={quiz}
          onClose={() => {
            setQuiz(null);
            refresh();
          }}
          onComplete={refresh}
        />
      )}
      {submission && (
        <ReviewDetail
          submission={submission}
          aiEnabled={state.integrations.ai}
          model={state.integrations.model}
          onClose={() => setSubmission(null)}
          refresh={refresh}
          notify={setNotice}
        />
      )}
    </div>
  );
}
function AccessFallback({ go }: { go: (p: string) => void }) {
  return (
    <div className="empty">
      <h1>Bu bo‘lim hisobingiz uchun mavjud emas.</h1>
      <button className="button primary" onClick={() => go('/')}>
        Bosh sahifaga qaytish
      </button>
    </div>
  );
}
function SettingsPage({
  user,
  integrations,
  refresh,
  notify,
  logout,
}: {
  user: User;
  integrations: State['integrations'];
  refresh: () => void;
  notify: (s: string) => void;
  logout: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [reminders, setReminders] = useState(!!user.reminder_enabled);
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    try {
      await api('settings', {
        method: 'POST',
        body: JSON.stringify({
          name: fd.get('name'),
          timezone: fd.get('timezone'),
          reminder_time: fd.get('reminder_time'),
          reminder_enabled: reminders,
        }),
      });
      notify('Sozlamalar saqlandi.');
      refresh();
    } catch (e) {
      notify(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function linkTelegram() {
    try {
      const r = await api<{ url: string }>('telegram/link', { method: 'POST', body: '{}' });
      window.open(r.url, '_blank', 'noopener,noreferrer');
    } catch (e) {
      notify(errorText(e));
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">설정 · O‘ZINGIZGA MOSLANG</span>
          <h1>Hisob va eslatmalar</h1>
          <p>Qachon va qanday o‘rganishni o‘zingiz tanlang.</p>
        </div>
      </div>
      <div className="settings-grid">
        <section className="panel settings-panel">
          <h2>Shaxsiy ma’lumotlar</h2>
          <form className="form-stack" onSubmit={save}>
            <label>
              Ismingiz
              <input name="name" defaultValue={user.name} required minLength={2} maxLength={80} />
            </label>
            <label>
              Email
              <input value={user.email} readOnly />
            </label>
            <label>
              Vaqt mintaqasi
              <select name="timezone" defaultValue={user.timezone}>
                <option value="Asia/Tashkent">Toshkent (UTC+5)</option>
                <option value="Asia/Seoul">Seul (UTC+9)</option>
                <option value="Europe/Moscow">Moskva (UTC+3)</option>
                <option value="UTC">UTC</option>
              </select>
            </label>
            <div className="settings-divider" />
            <div className="toggle-row">
              <div>
                <h3>Kundalik eslatma</h3>
                <p>Faqat bugungi mashq bajarilmagan bo‘lsa.</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={reminders}
                aria-label="Kundalik eslatma"
                className={`toggle ${reminders ? 'on' : ''}`}
                onClick={() => setReminders(!reminders)}
              >
                <span />
              </button>
            </div>
            <label>
              Eslatma vaqti
              <input name="reminder_time" type="time" defaultValue={user.reminder_time} required />
            </label>
            <SubmitButton busy={busy}>
              O‘zgarishlarni saqlash
              <Check size={18} />
            </SubmitButton>
          </form>
        </section>
        <aside>
          <section className="panel settings-panel">
            <div className="section-title">
              <h2>Telegram</h2>
              <Badge tone={user.telegram_id ? 'green' : 'neutral'}>
                {user.telegram_id ? 'Ulangan' : 'Ulanmagan'}
              </Badge>
            </div>
            <p>Shaxsiy eslatmalar va topshiriq xabarlari bot orqali keladi.</p>
            {user.telegram_id ? (
              <button className="button secondary" onClick={refresh}>
                <Check size={18} />
                Holatni yangilash
              </button>
            ) : (
              <button
                className="button secondary"
                disabled={!integrations.telegram}
                onClick={linkTelegram}
              >
                <Link2 size={18} />
                Telegramni ulash
              </button>
            )}
            {!integrations.telegram && (
              <p className="muted">
                Telegram bot ulanmaguncha email bilan foydalanishingiz mumkin.
              </p>
            )}
          </section>
          {user.role === 'teacher' && (
            <section className="panel settings-panel">
              <div className="section-title">
                <h2>AI ustoz</h2>
                <Badge tone={integrations.ai ? 'green' : 'neutral'}>
                  {integrations.ai ? 'Tayyor' : 'Ulanmagan'}
                </Badge>
              </div>
              <p>
                {integrations.provider} · {integrations.model}
              </p>
              <p>
                Faqat siz yuborgan yozma ishlarni tekshiradi. Natijani o‘quvchiga yuborish sizning
                nazoratingizda.
              </p>
              {!integrations.ai && (
                <p className="muted">API kaliti server sozlamalariga kiritilgach ishga tushadi.</p>
              )}
            </section>
          )}
          <button className="button logout-button" onClick={logout}>
            <LogOut size={18} />
            Hisobdan chiqish
          </button>
        </aside>
      </div>
    </>
  );
}
