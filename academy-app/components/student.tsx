'use client';
import { useState } from 'react';
import { ReadingSession } from './topik';
import GrammarLesson from './grammar-lesson';
import type { TopikSession } from '@/lib/topik-types';
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Languages,
  PenLine,
  Search,
  Plus,
  Bookmark,
  Trash2,
  FileText,
  Paperclip,
  Send,
  Sparkles,
} from 'lucide-react';
import type { studentState } from '@/lib/learning';
import type { QuizKind, Grammar, Word, Assignment, Note, Submission } from '@/lib/types';
import { api, Badge, Modal, Empty, SubmitButton, dateLabel, errorText } from './ui';
export type StudentData = ReturnType<typeof studentState>;
export type StartQuiz = (
  kind: QuizKind,
  mode?: 'practice' | 'test',
  topicId?: string,
  assignmentId?: string,
) => void;
export function PracticeLibrary({
  kind,
  data,
  start,
  notify,
  refresh,
  go,
}: {
  kind: 'grammar' | 'vocabulary';
  data: StudentData;
  start: StartQuiz;
  notify: (text: string) => void;
  refresh: () => void;
  go: (path: string) => void;
}) {
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('all');
  const [selected, setSelected] = useState<Grammar | Word | null>(null);
  const [topikSession, setTopikSession] = useState<TopikSession | null>(null);
  const [starting, setStarting] = useState(false);
  async function practiceGrammar(grammarId: string) {
    if (starting) return;
    setStarting(true);
    try {
      setTopikSession(
        await api<TopikSession>('topik/start', {
          method: 'POST',
          body: JSON.stringify({ mode: 'practice', grammarId, count: 1 }),
        }),
      );
      setSelected(null);
    } catch (e) {
      notify(errorText(e));
    } finally {
      setStarting(false);
    }
  }
  const isGrammar = kind === 'grammar';
  const allowed: string[] = JSON.parse(
    isGrammar ? data.group?.grammar_ids || '[]' : data.group?.vocabulary_ids || '[]',
  );
  const grammars = data.grammars.filter(
    (g) =>
      `${g.form} ${g.meaning}`.toLowerCase().includes(search.toLowerCase()) &&
      (tab === 'all' || allowed.includes(g.id)),
  );
  const words = data.words.filter(
    (w) =>
      `${w.ko} ${w.uz}`.toLowerCase().includes(search.toLowerCase()) &&
      (tab === 'all' || allowed.includes(w.id)),
  );
  async function save() {
    if (!selected) return;
    try {
      await api('notes', {
        method: 'POST',
        body: JSON.stringify({
          title: 'form' in selected ? selected.form : selected.ko,
          body:
            'meaning' in selected
              ? `${selected.meaning}\n${selected.ko}\n${selected.uz}`
              : `${selected.uz}\n${selected.example}\n${selected.translation}`,
          topicId: selected.id,
        }),
      });
      notify('Daftaringizga saqlandi.');
      refresh();
    } catch (e) {
      notify(errorText(e));
    }
  }
  if (topikSession)
    return (
      <ReadingSession
        key={topikSession.id}
        initial={topikSession}
        notify={notify}
        onExit={() => {
          setTopikSession(null);
          refresh();
        }}
      />
    );
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            {isGrammar ? '문법 · QOIDA VA AMALIYOT' : '어휘 · SO‘ZLAR OLAMI'}
          </span>
          <h1>{isGrammar ? 'Grammatika' : 'Lug‘at'} mashqlari</h1>
          <p>
            {isGrammar
              ? 'Ma’noni tushuning. To‘g‘ri shaklni tanlang.'
              : 'Har bir yangi so‘z — yangi imkoniyat.'}
          </p>
        </div>
        <button className="button primary" onClick={() => start(kind)}>
          Quizni boshlash
          <ArrowRight size={18} />
        </button>
      </div>
      {!isGrammar && (
        <button className="topik-entry" onClick={() => go('/vocabulary/reading')}>
          <span className="square-icon pale-blue">
            <FileText size={24} />
          </span>
          <span>
            <strong>TOPIK savollaridagi muhim so‘zlar</strong>
            <small>읽기 1–4, 5–8, 9–12 va boshqa turlar bo‘yicha. Misollar bilan o‘rganing.</small>
          </span>
          <ArrowUpRight size={21} />
        </button>
      )}
      <div className={`library-banner ${isGrammar ? 'grammar-banner' : 'vocab-banner'}`}>
        <div>
          <Badge tone={isGrammar ? 'purple' : 'green'}>
            {isGrammar ? 'TOPIK II · 읽기 1–4' : 'KOREYSCHA ↔ O‘ZBEKCHA'}
          </Badge>
          <h2>
            {isGrammar ? 'O‘rganganingizni sinab ko‘ring.' : 'So‘zlarni gap ichida eslab qoling.'}
          </h2>
          <p>
            {isGrammar
              ? 'Qo‘llanma asosidagi mashqlar. Natija rasmiy TOPIK bahosi emas.'
              : 'Ma’no, koreyscha misol va o‘zbekcha tarjima.'}
          </p>
        </div>
        <button className="button secondary" onClick={() => start(kind, 'test')}>
          Kichik sinov
          <ArrowUpRight size={17} />
        </button>
      </div>
      <div className="library-toolbar">
        <div className="segmented">
          <button className={tab === 'all' ? 'active' : ''} onClick={() => setTab('all')}>
            Barchasi
          </button>
          <button className={tab === 'group' ? 'active' : ''} onClick={() => setTab('group')}>
            Guruhim mavzulari
          </button>
        </div>
        <label className="search-box">
          <Search size={18} />
          <input
            aria-label="Qidirish"
            placeholder={isGrammar ? 'Grammatikani qidirish…' : 'So‘zni qidirish…'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
      </div>
      <div className={isGrammar ? 'grammar-grid' : 'word-grid'}>
        {isGrammar
          ? grammars.map((g, i) => (
              <button className="grammar-card" key={g.id} onClick={() => setSelected(g)}>
                <div>
                  <span className="muted">{g.id}</span>
                  {allowed.includes(g.id) ? (
                    <Badge tone="blue">O‘tilmoqda</Badge>
                  ) : (
                    <BookOpen size={17} />
                  )}
                </div>
                <h3 lang="ko">{g.form}</h3>
                <p>{g.meaning}</p>
                <footer>
                  <span>
                    {data.grammarMastery[g.id]
                      ? `${data.grammarMastery[g.id]} kun to‘g‘ri javob`
                      : 'Mini-dars va mashq'}
                  </span>
                  <ArrowUpRight size={18} />
                </footer>
              </button>
            ))
          : words.map((w) => (
              <button className="word-card" key={w.id} onClick={() => setSelected(w)}>
                <span className="word-category">{w.category}</span>
                <h3 lang="ko">{w.ko}</h3>
                <p>{w.uz}</p>
                <div>
                  <span>Misolda ko‘rish</span>
                  <ArrowUpRight size={17} />
                </div>
              </button>
            ))}
      </div>
      {!(isGrammar ? grammars : words).length && (
        <Empty title="Hech narsa topilmadi">Boshqa so‘z bilan qidirib ko‘ring.</Empty>
      )}
      {selected && (
        <Modal
          title={isGrammar ? 'Grammatikani o‘rganamiz' : 'So‘zni o‘rganamiz'}
          onClose={() => setSelected(null)}
        >
          <div className="lesson-detail">
            <Badge>{selected.id}</Badge>
            <h2 lang="ko">{'form' in selected ? selected.form : selected.ko}</h2>
            {!('form' in selected) && <p className="lesson-meaning">{selected.uz}</p>}
            {'syntax' in selected && (
              <div className="syntax-box">
                <small>TUZILISHI</small>
                <p lang="ko">{selected.syntax}</p>
              </div>
            )}
            {!('form' in selected) && (
              <div className="example-box">
                <span>KOREYSCHA MISOL</span>
                <p lang="ko">{selected.example}</p>
                <p>{selected.translation}</p>
              </div>
            )}
            {'form' in selected && (
              <GrammarLesson
                key={selected.id}
                grammar={selected}
                grammars={data.grammars}
                correctDays={data.grammarMastery[selected.id] || 0}
              />
            )}
            <p className="muted">
              {data.coverage[selected.id] || data.topikCoverage[selected.id]
                ? `${(data.coverage[selected.id] || 0) + (data.topikCoverage[selected.id] || 0)} ta mashq savoli mavjud.`
                : 'Bu band uchun quiz savollari hali qo‘shilmagan.'}
            </p>
            <div className="button-row">
              <button className="button secondary" onClick={save}>
                <Bookmark size={18} />
                Daftarimga saqlash
              </button>
              {isGrammar && data.access.topik && !!data.topikCoverage[selected.id] && (
                <button
                  className="button primary"
                  disabled={starting}
                  onClick={() => practiceGrammar(selected.id)}
                >
                  TOPIK usulida mashq qilish <ArrowRight size={18} />
                </button>
              )}
              {allowed.includes(selected.id) && !!data.coverage[selected.id] && (
                <button
                  className="button primary"
                  onClick={() => {
                    const s = selected;
                    setSelected(null);
                    start(kind, 'practice', s.id);
                  }}
                >
                  Mashq qilish
                  <ArrowRight size={18} />
                </button>
              )}
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
export function Writing({
  data,
  refresh,
  notify,
}: {
  data: StudentData;
  refresh: () => void;
  notify: (s: string) => void;
}) {
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [result, setResult] = useState<Submission | null>(null);
  const [text, setText] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!assignment) return;
    setBusy(true);
    setError('');
    const fd = new FormData();
    fd.set('assignmentId', assignment.id);
    fd.set('body', text);
    files.forEach((f) => fd.append('files', f));
    try {
      await api('submissions', { method: 'POST', body: fd });
      setAssignment(null);
      setText('');
      setFiles([]);
      notify('Vazifangiz ustozga yuborildi.');
      refresh();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">쓰기 · FIKRINGIZNI YOZING</span>
          <h1>Yozma vazifalar</h1>
          <p>Yozing, topshiring va ustozingizdan izoh oling.</p>
        </div>
        <div className="heading-icon sand">
          <PenLine size={29} />
        </div>
      </div>
      <div className="writing-grid">
        {data.assignments
          .filter((a) => a.kind === 'writing')
          .map((a) => {
            const s = data.submissions.find((s) => s.assignment_id === a.id);
            return (
              <article className="writing-card" key={a.id}>
                <div className="writing-card-top">
                  <Badge tone={s?.published_at ? 'green' : s ? 'blue' : 'orange'}>
                    {s?.published_at
                      ? 'Tekshirildi'
                      : s
                        ? 'Ustoz tekshiruvida'
                        : 'Topshirish kerak'}
                  </Badge>
                  <span>{dateLabel(a.due_at)} gacha</span>
                </div>
                <h2>{a.title}</h2>
                <p>{a.prompt}</p>
                <div className="writing-bottom">
                  <span>
                    <Paperclip size={16} />
                    Matn · Rasm · PDF
                  </span>
                  {s ? (
                    <button className="button secondary" onClick={() => setResult(s)}>
                      Ishni ko‘rish
                      <ArrowUpRight size={17} />
                    </button>
                  ) : (
                    <button
                      className="button primary"
                      onClick={() => {
                        setAssignment(a);
                        setError('');
                      }}
                    >
                      Yozishni boshlash
                      <PenLine size={17} />
                    </button>
                  )}
                </div>
              </article>
            );
          })}
      </div>
      {!data.assignments.some((a) => a.kind === 'writing') && (
        <Empty title="Yangi vazifa hali berilmagan">
          Ustozingiz topshiriq bergach, shu yerda ko‘rinadi.
        </Empty>
      )}
      {assignment && (
        <Modal
          title="Yozma vazifani topshirish"
          onClose={() => {
            if (!busy) setAssignment(null);
          }}
          wide
        >
          <form className="form-stack" onSubmit={submit}>
            <div className="assignment-prompt">
              <h3>{assignment.title}</h3>
              <p>{assignment.prompt}</p>
            </div>
            <label>
              Javobingiz
              <textarea
                rows={8}
                maxLength={16000}
                lang="ko"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="여기에 한국어로 써 보세요…"
              />
            </label>
            <div className="field-meta">
              <span>Matn yozing yoki yozilgan ishingizni fayl qilib qo‘shing.</span>
              <span>{text.length} belgi</span>
            </div>
            <label className="upload-box">
              <Paperclip size={24} />
              <strong>Daftar rasmi yoki PDF qo‘shish</strong>
              <span>JPG, PNG, WebP yoki PDF · Har biri 5 MB · 3 tagacha</span>
              <input
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={(e) => {
                  const f = Array.from(e.target.files || []);
                  if (f.length > 3 || f.some((x) => x.size > 5 * 1024 * 1024)) {
                    setError('3 tagacha fayl, har biri 5 MB dan kichik bo‘lsin.');
                    e.target.value = '';
                    return;
                  }
                  setFiles(f);
                  setError('');
                }}
              />
            </label>
            {files.map((f, i) => (
              <div className="file-chip" key={i}>
                <FileText size={17} />
                <span>{f.name}</span>
                <button
                  type="button"
                  className="icon-button"
                  aria-label="Faylni olib tashlash"
                  onClick={() => setFiles(files.filter((_, idx) => idx !== i))}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            {error && <div className="alert error">{error}</div>}
            <div className="modal-actions">
              <p>Yuborilgach, ustozingiz tekshiradi.</p>
              <SubmitButton busy={busy}>
                <Send size={17} />
                Ustozga yuborish
              </SubmitButton>
            </div>
          </form>
        </Modal>
      )}
      {result && (
        <Modal
          title={result.assignment_title || 'Yozma ishingiz'}
          onClose={() => setResult(null)}
          wide
        >
          <Badge tone={result.published_at ? 'green' : 'orange'}>
            {result.published_at ? 'Ustoz izohi tayyor' : 'Tekshirish kutilmoqda'}
          </Badge>
          <div className="submitted-text" lang="ko">
            {result.body || 'Javob biriktirilgan faylda.'}
          </div>
          <div className="attachment-list">
            {result.attachments?.map((f) => (
              <a
                className="file-chip"
                href={`/api/files/${f.id}`}
                target="_blank"
                rel="noreferrer"
                key={f.id}
              >
                <FileText size={18} />
                {f.name}
                <ArrowUpRight size={16} />
              </a>
            ))}
          </div>
          {result.published_at && (
            <div className="feedback-box">
              <div>
                <h3>Ustozingizdan izoh</h3>
                <Badge tone="green">{result.score}/100</Badge>
              </div>
              <p>{result.feedback}</p>
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
export { default as Notebook } from './notebook';
