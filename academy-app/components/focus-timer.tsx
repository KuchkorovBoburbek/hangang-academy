'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Clock3, Pause, Play, RotateCcw, Timer, Volume2 } from 'lucide-react';
import '@/app/focus-timer.css';

type TimerStatus = 'idle' | 'running' | 'paused' | 'completed';
type StoredTimer = {
  duration: number;
  remaining: number;
  status: TimerStatus;
  endAt: number | null;
};

const QUICK_MINUTES = [15, 25, 45, 60];
const CIRCLE_LENGTH = 2 * Math.PI * 136;

function clampMinutes(value: number) {
  return Math.min(60, Math.max(1, Math.round(value || 1)));
}

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}

export default function FocusTimer({
  userId,
  notify,
}: {
  userId: string;
  notify: (message: string) => void;
}) {
  const [duration, setDuration] = useState(25);
  const [remaining, setRemaining] = useState(25 * 60);
  const [status, setStatus] = useState<TimerStatus>('idle');
  const [endAt, setEndAt] = useState<number | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const audioRef = useRef<AudioContext | null>(null);
  const storageKey = `hangang-focus-timer:${userId}`;

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        const saved = JSON.parse(raw) as Partial<StoredTimer>;
        const savedDuration = clampMinutes(Number(saved.duration));
        const savedStatus = saved.status;
        const savedEnd = typeof saved.endAt === 'number' ? saved.endAt : null;
        if (savedStatus === 'running' && savedEnd) {
          const next = Math.max(0, Math.ceil((savedEnd - Date.now()) / 1000));
          setDuration(savedDuration);
          setRemaining(next);
          setStatus(next > 0 ? 'running' : 'completed');
          setEndAt(next > 0 ? savedEnd : null);
        } else if (savedStatus === 'paused') {
          setDuration(savedDuration);
          setRemaining(
            Math.min(savedDuration * 60, Math.max(1, Math.round(Number(saved.remaining) || 1))),
          );
          setStatus('paused');
        } else if (savedStatus === 'completed') {
          setDuration(savedDuration);
          setRemaining(0);
          setStatus('completed');
        } else {
          setDuration(savedDuration);
          setRemaining(savedDuration * 60);
        }
      }
    } catch {
      window.localStorage.removeItem(storageKey);
    } finally {
      setHydrated(true);
    }
  }, [storageKey]);

  useEffect(() => {
    if (!hydrated) return;
    const saved: StoredTimer = { duration, remaining, status, endAt };
    window.localStorage.setItem(storageKey, JSON.stringify(saved));
  }, [duration, endAt, hydrated, remaining, status, storageKey]);

  useEffect(() => {
    if (status !== 'running' || !endAt) return;
    function tick() {
      const next = Math.max(0, Math.ceil((endAt! - Date.now()) / 1000));
      setRemaining(next);
      if (next > 0) return;
      setStatus('completed');
      setEndAt(null);
      notify('Pomodoro yakunlandi. Barakalla!');
      navigator.vibrate?.([180, 100, 180]);
      const context = audioRef.current;
      if (!context) return;
      for (const [index, frequency] of [523, 659, 784].entries()) {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0, context.currentTime + index * 0.16);
        gain.gain.linearRampToValueAtTime(0.12, context.currentTime + index * 0.16 + 0.02);
        gain.gain.linearRampToValueAtTime(0, context.currentTime + index * 0.16 + 0.14);
        oscillator.connect(gain).connect(context.destination);
        oscillator.start(context.currentTime + index * 0.16);
        oscillator.stop(context.currentTime + index * 0.16 + 0.16);
      }
    }
    tick();
    const interval = window.setInterval(tick, 250);
    return () => window.clearInterval(interval);
  }, [endAt, notify, status]);

  useEffect(() => {
    if (status !== 'running' && status !== 'paused') return;
    const previous = document.title;
    document.title = `${formatTime(remaining)} · Pomodoro`;
    return () => {
      document.title = previous;
    };
  }, [remaining, status]);

  function chooseDuration(value: number) {
    const next = clampMinutes(value);
    setDuration(next);
    setRemaining(next * 60);
    setStatus('idle');
    setEndAt(null);
  }

  function unlockAudio() {
    try {
      if (!audioRef.current) audioRef.current = new AudioContext();
      if (audioRef.current.state === 'suspended') void audioRef.current.resume();
    } catch {
      // The timer still works when the browser does not expose Web Audio.
    }
  }

  function start() {
    unlockAudio();
    const seconds = duration * 60;
    setRemaining(seconds);
    setEndAt(Date.now() + seconds * 1000);
    setStatus('running');
  }

  function pause() {
    if (!endAt) return;
    setRemaining(Math.max(1, Math.ceil((endAt - Date.now()) / 1000)));
    setEndAt(null);
    setStatus('paused');
  }

  function resume() {
    unlockAudio();
    setEndAt(Date.now() + remaining * 1000);
    setStatus('running');
  }

  function reset() {
    setRemaining(duration * 60);
    setEndAt(null);
    setStatus('idle');
  }

  const canChoose = status === 'idle' || status === 'completed';
  const elapsed = duration * 60 ? 1 - remaining / (duration * 60) : 0;
  const circleOffset = CIRCLE_LENGTH * (1 - Math.min(1, Math.max(0, elapsed)));
  const statusLabel =
    status === 'running'
      ? 'Diqqat vaqti'
      : status === 'paused'
        ? 'Pauza'
        : status === 'completed'
          ? 'Bajarildi'
          : 'Boshlashga tayyor';

  return (
    <div className="focus-page">
      <header className="focus-heading">
        <div>
          <span className="eyebrow">집중 시간 · DIQQAT BILAN O‘RGANISH</span>
          <h1>Pomodoro</h1>
          <p>
            Bir vazifani tanlang, vaqtni belgilang va shu vaqt davomida faqat unga e’tibor bering.
          </p>
        </div>
        <div className="focus-heading-mark" aria-hidden="true">
          <Timer size={29} />
        </div>
      </header>

      <div className="focus-layout">
        <section className={`focus-timer-card ${status}`} aria-labelledby="focus-timer-title">
          <div className="focus-status">
            <span className="focus-status-dot" />
            <strong id="focus-timer-title">{statusLabel}</strong>
          </div>

          <div
            className="focus-clock"
            role="progressbar"
            aria-label="Pomodoro vaqti"
            aria-valuemin={0}
            aria-valuemax={duration * 60}
            aria-valuenow={duration * 60 - remaining}
          >
            <svg viewBox="0 0 300 300" aria-hidden="true">
              <circle className="focus-clock-track" cx="150" cy="150" r="136" />
              <circle
                className="focus-clock-progress"
                cx="150"
                cy="150"
                r="136"
                strokeDasharray={CIRCLE_LENGTH}
                strokeDashoffset={circleOffset}
              />
            </svg>
            <div className="focus-clock-copy">
              {status === 'completed' ? <Check size={30} /> : <Clock3 size={22} />}
              <strong className="focus-clock-time">{formatTime(remaining)}</strong>
              <span>
                {status === 'completed' ? 'Ajoyib ishladingiz!' : `${duration} daqiqalik reja`}
              </span>
            </div>
          </div>

          {canChoose && (
            <div className="focus-duration">
              <div className="focus-duration-head">
                <label htmlFor="focus-minutes">Vaqtni tanlang</label>
                <div>
                  <input
                    id="focus-minutes"
                    type="number"
                    min="1"
                    max="60"
                    value={duration}
                    onChange={(event) => chooseDuration(Number(event.target.value))}
                    aria-label="Pomodoro daqiqasi"
                  />
                  <span>daqiqa</span>
                </div>
              </div>
              <input
                type="range"
                min="1"
                max="60"
                value={duration}
                onChange={(event) => chooseDuration(Number(event.target.value))}
                aria-label="Pomodoro vaqt oralig‘i"
              />
              <div className="focus-quick-times" aria-label="Tez vaqt tanlash">
                {QUICK_MINUTES.map((minutes) => (
                  <button
                    key={minutes}
                    type="button"
                    className={duration === minutes ? 'active' : ''}
                    onClick={() => chooseDuration(minutes)}
                  >
                    {minutes} daq
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="focus-controls">
            {(status === 'idle' || status === 'completed') && (
              <button className="button primary focus-main-action" onClick={start}>
                <Play size={19} fill="currentColor" />
                {status === 'completed' ? 'Yana boshlash' : 'Boshlash'}
              </button>
            )}
            {status === 'running' && (
              <button className="button primary focus-main-action" onClick={pause}>
                <Pause size={19} fill="currentColor" />
                Pauza
              </button>
            )}
            {status === 'paused' && (
              <button className="button primary focus-main-action" onClick={resume}>
                <Play size={19} fill="currentColor" />
                Davom ettirish
              </button>
            )}
            {status !== 'idle' && (
              <button className="button secondary" onClick={reset}>
                <RotateCcw size={18} />
                Qayta boshlash
              </button>
            )}
          </div>
        </section>

        <aside className="focus-guide">
          <span className="focus-guide-icon">
            <Volume2 size={23} />
          </span>
          <span className="eyebrow">POMODORO USULI</span>
          <h2>Diqqatni bitta ishga qarating</h2>
          <ol>
            <li>
              <span>1</span>
              <div>
                <strong>Bitta aniq vazifani tanlang</strong>
                <p>Masalan, matn o‘qish yoki yangi so‘zlarni takrorlash.</p>
              </div>
            </li>
            <li>
              <span>2</span>
              <div>
                <strong>Chalg‘itadigan narsalarni yoping</strong>
                <p>Timer tugaguncha faqat tanlangan vazifa bilan shug‘ullaning.</p>
              </div>
            </li>
            <li>
              <span>3</span>
              <div>
                <strong>Vaqt tugagach dam oling</strong>
                <p>Qisqa tanaffus qiling, keyin xohlasangiz yangi davrni boshlang.</p>
              </div>
            </li>
          </ol>
          <div className="focus-guide-note">
            <Check size={17} />
            Timer boshqa tabga o‘tsangiz ham aniq davom etadi.
          </div>
        </aside>
      </div>
    </div>
  );
}
