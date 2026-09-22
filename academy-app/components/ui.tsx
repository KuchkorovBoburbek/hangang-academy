'use client';
import { useEffect, useRef, useId } from 'react';
import { ArrowUpRight, X, LoaderCircle, BookOpen, Check } from 'lucide-react';
export async function api<T = Record<string, unknown>>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`/api/${path}`, {
    ...options,
    headers:
      options.body instanceof FormData
        ? options.headers
        : { 'Content-Type': 'application/json', ...options.headers },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'So‘rov bajarilmadi.');
  return data;
}
export function Brand({ light = false }: { light?: boolean }) {
  return (
    <div className={`brand ${light ? 'brand-light' : ''}`}>
      <div className="brand-mark">
        <img src="/hangang-logo.png" alt="" />
      </div>
      <div>
        <strong>
          Hangang<span>Academy</span>
        </strong>
        <small>한국어의 새로운 시작</small>
      </div>
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const headingId = useId();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
    const el = ref.current;
    return () => el?.close();
  }, []);
  return (
    <dialog
      aria-labelledby={headingId}
      ref={ref}
      className={`modal ${wide ? 'wide' : ''}`}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="modal-head">
        <h2 id={headingId}>{title}</h2>
        <button className="icon-button" onClick={onClose} aria-label="Yopish">
          <X size={21} />
        </button>
      </div>
      <div className="modal-body">{children}</div>
    </dialog>
  );
}
export function Empty({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <BookOpen size={26} />
      </div>
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
export function Loading() {
  return (
    <div className="loading">
      <Brand />
      <LoaderCircle className="spin" size={28} />
      <p>Darslaringiz tayyorlanmoqda…</p>
    </div>
  );
}
export function SubmitButton({
  busy,
  children,
  className = 'button primary',
}: {
  busy: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button type="submit" disabled={busy} className={className}>
      {busy ? <LoaderCircle className="spin" size={18} /> : null}
      {children}
    </button>
  );
}
export function SectionTitle({
  title,
  subtitle,
  action,
  onAction,
}: {
  title: string;
  subtitle?: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="section-title">
      <div>
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action && (
        <button className="text-button" onClick={onAction}>
          {action}
          <ArrowUpRight size={17} />
        </button>
      )}
    </div>
  );
}
export function Badge({ children, tone = 'blue' }: { children: React.ReactNode; tone?: string }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
export function CheckTag({ children }: { children: React.ReactNode }) {
  return (
    <span className="check-tag">
      <Check size={14} />
      {children}
    </span>
  );
}
export function dateLabel(s: string, timeZone?: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'numeric',
    ...(timeZone ? { timeZone } : {}),
  }).formatToParts(new Date(s));
  const values = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${values.day}-${['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'][Number(values.month) - 1]}`;
}
export function errorText(e: unknown) {
  return e instanceof Error ? e.message : 'Xatolik yuz berdi.';
}
