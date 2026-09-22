'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, GraduationCap, ShieldCheck, BookOpen, ArrowUpRight } from 'lucide-react';
import { api, Brand, SubmitButton, errorText } from './ui';
declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        initData: string;
        ready: () => void;
        expand: () => void;
        openTelegramLink: (url: string) => void;
      };
    };
  }
}
export default function AuthPage({ register = false }: { register?: boolean }) {
  const router = useRouter();
  const [demo, setDemo] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [tg, setTg] = useState('');
  const [needsInvite, setNeedsInvite] = useState(false);
  useEffect(() => {
    api<{ demo: boolean }>('config')
      .then((d) => setDemo(d.demo))
      .catch(() => {});
    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-web-app.js';
    script.async = true;
    script.onload = () => {
      const web = window.Telegram?.WebApp;
      if (web?.initData) {
        web.ready();
        web.expand();
        setTg(web.initData);
        api<{ needsInvite?: boolean }>('telegram/auth', {
          method: 'POST',
          body: JSON.stringify({ initData: web.initData }),
        })
          .then((d) => {
            if (d.needsInvite) setNeedsInvite(true);
            else router.replace('/');
          })
          .catch((e) => setError(errorText(e)));
      }
    };
    document.head.appendChild(script);
    return () => script.remove();
  }, [router]);
  async function login(email: string, password: string) {
    setBusy(true);
    setError('');
    try {
      await api('login', { method: 'POST', body: JSON.stringify({ email, password }) });
      router.replace('/');
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    if (!register && !needsInvite)
      return login(String(fd.get('email')), String(fd.get('password')));
    setBusy(true);
    setError('');
    try {
      await api(needsInvite ? 'telegram/auth' : 'register', {
        method: 'POST',
        body: JSON.stringify(
          needsInvite ? { initData: tg, invite: fd.get('invite') } : Object.fromEntries(fd),
        ),
      });
      router.replace('/');
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-layout">
      <aside className="auth-story">
        <Brand light />
        <div className="auth-story-inner">
          <span className="eyebrow light">HANGANG LEARNING SPACE</span>
          <p className="auth-korean" lang="ko">
            매일 조금씩,
            <br />더 멀리.
          </p>
          <h1>
            Har kuni bir qadam.
            <br />
            Katta maqsadlar sari.
          </h1>
          <p>Koreys tilini o‘rganish uchun o‘zingizga tegishli makon.</p>
          <div className="auth-pill">
            <GraduationCap size={19} /> Lug‘at · Grammatika · Yozuv
          </div>
        </div>
        <div className="auth-bottom">
          <span>함께 배우고, 함께 성장해요.</span>
          <span>SEOUL ↔ TASHKENT</span>
        </div>
      </aside>
      <main className="auth-main">
        <div className="auth-mobile-brand">
          <Brand />
        </div>
        <div className="auth-form-wrap">
          <div className="auth-top-icon">
            <BookOpen size={24} />
          </div>
          <span className="eyebrow">XUSH KELIBSIZ</span>
          <h2>
            {needsInvite
              ? 'Guruhingizga qo‘shiling'
              : register
                ? 'O‘rganishni boshlaymiz'
                : 'Yana uchrashganimizdan xursandmiz.'}
          </h2>
          <p>
            {register || needsInvite
              ? 'Ustozingiz bergan guruh kodini kiriting.'
              : 'Hisobingizga kiring va o‘rganishni davom ettiring.'}
          </p>
          <form onSubmit={submit} className="form-stack">
            {register && !needsInvite && (
              <label>
                Ismingiz
                <input
                  name="name"
                  required
                  minLength={2}
                  autoComplete="name"
                  placeholder="Ism va familiya"
                />
              </label>
            )}
            {!needsInvite && (
              <>
                <label>
                  Email
                  <input
                    type="email"
                    name="email"
                    required
                    autoComplete="email"
                    placeholder="siz@email.com"
                  />
                </label>
                <label>
                  Parol
                  <input
                    type="password"
                    name="password"
                    required
                    minLength={register ? 10 : 1}
                    autoComplete={register ? 'new-password' : 'current-password'}
                    placeholder={register ? 'Kamida 10 belgi' : 'Parolingizni kiriting'}
                  />
                </label>
              </>
            )}
            {(register || needsInvite) && (
              <label>
                Guruh kodi
                <input
                  name="invite"
                  required
                  autoComplete="off"
                  placeholder="Ustozingiz bergan kod"
                />
              </label>
            )}
            {error && (
              <div className="alert error" role="alert">
                {error}
              </div>
            )}
            <SubmitButton busy={busy}>
              {register || needsInvite ? 'Hisob ochish' : 'Kirish'}
              <ArrowRight size={18} />
            </SubmitButton>
          </form>
          <p className="auth-switch">
            {register ? 'Hisobingiz bormi?' : 'Yangi o‘quvchimisiz?'}{' '}
            <Link href={register ? '/login' : '/register'}>
              {register ? 'Kirish' : 'Guruhga qo‘shilish'}
            </Link>
          </p>
          {demo && (
            <div className="demo-panel">
              <div>
                <ShieldCheck size={17} />
                <strong>Mahalliy sinov muhiti</strong>
              </div>
              <p>Namunaviy hisob bilan imkoniyatlarni ko‘rib chiqing.</p>
              <div className="demo-buttons">
                <button
                  disabled={busy}
                  onClick={() => login('student@hangang.local', 'HangangStudent2026!')}
                >
                  O‘quvchi
                  <ArrowUpRight size={16} />
                </button>
                <button
                  disabled={busy}
                  onClick={() => login('teacher@hangang.local', 'HangangTeacher2026!')}
                >
                  O‘qituvchi
                  <ArrowUpRight size={16} />
                </button>
              </div>
            </div>
          )}
          <p className="auth-footer">HangangAcademy · Koreys tiliga yaqinroq.</p>
        </div>
      </main>
    </div>
  );
}
