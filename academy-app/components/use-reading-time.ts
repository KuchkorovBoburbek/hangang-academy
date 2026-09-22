'use client';
import { useCallback, useEffect, useRef } from 'react';
import { api } from './ui';
export function useReadingTime(sessionId: string, questionId: string, active: boolean) {
  const pending = useRef<{ questionId: string; eventId: string; seconds: number }[]>([]);
  const current = useRef({ questionId, milliseconds: 0 });
  const sending = useRef<Promise<void>>(Promise.resolve());
  const flush = useCallback(async () => {
    const seconds = Math.floor(current.current.milliseconds / 1000);
    if (seconds && current.current.questionId) {
      pending.current.push({
        questionId: current.current.questionId,
        seconds: Math.min(seconds, 60),
        eventId: crypto.randomUUID(),
      });
      current.current.milliseconds -= Math.min(seconds, 60) * 1000;
    }
    const send = async () => {
      while (pending.current.length) {
        const item = pending.current[0];
        try {
          await api('topik/time', {
            method: 'POST',
            body: JSON.stringify({ sessionId, ...item }),
            keepalive: true,
          });
          pending.current.shift();
        } catch {
          break;
        }
      }
    };
    sending.current = sending.current.then(send);
    await sending.current;
  }, [sessionId]);
  useEffect(() => {
    void flush();
    current.current = { questionId, milliseconds: 0 };
    if (!active) return;
    let last = performance.now(),
      ticks = 0;
    const timer = setInterval(() => {
      const now = performance.now(),
        delta = Math.min(now - last, 1500);
      last = now;
      if (document.visibilityState === 'visible' && document.hasFocus())
        current.current.milliseconds += delta;
      if (++ticks % 10 === 0) void flush();
    }, 1000);
    const hidden = () => {
      last = performance.now();
      if (document.visibilityState !== 'visible') void flush();
    };
    document.addEventListener('visibilitychange', hidden);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', hidden);
      void flush();
    };
  }, [questionId, active, flush]);
  return flush;
}
