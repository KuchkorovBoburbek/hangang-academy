'use client';
import { useEffect, useState } from 'react';
import type { Group } from '@/lib/types';
import {
  SEOULTE_BOOKS,
  VOCABULARY_LEVELS,
  VOCABULARY_SECTIONS,
  sameScope,
  vocabularyLevel,
  vocabularyTopics,
  type VocabularyScope,
} from '@/lib/vocabulary-types';
import { api, Modal, errorText } from './ui';

export function ScopePicker({
  value,
  onChange,
}: {
  value: VocabularyScope;
  onChange: (scope: VocabularyScope) => void;
}) {
  return (
    <div className="vocab-form-columns">
      <label>
        Daraja
        <select
          aria-label="Lug‘at darajasi"
          value={value.level}
          onChange={(e) => {
            const level = e.target.value as VocabularyScope['level'];
            onChange({ level, book: level === 'hangul' ? '1A' : null, section: 'reading' });
          }}
        >
          {VOCABULARY_LEVELS.map((l) => (
            <option value={l.id} key={l.id}>
              {l.label}
            </option>
          ))}
        </select>
      </label>
      {value.level === 'hangul' ? (
        <label>
          Kitob
          <select
            aria-label="Seoulte kitobi"
            value={value.book || '1A'}
            onChange={(e) =>
              onChange({ ...value, book: e.target.value as VocabularyScope['book'] })
            }
          >
            {SEOULTE_BOOKS.map((b) => (
              <option key={b} value={b}>
                Seoulte {b}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <label>
          TOPIK bo‘limi
          <select
            aria-label="TOPIK bo‘limi"
            value={value.section}
            onChange={(e) =>
              onChange({ ...value, section: e.target.value as VocabularyScope['section'] })
            }
          >
            {VOCABULARY_SECTIONS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.ko} · {s.label}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}

export function VocabularyAccess({
  groups,
  initialScope,
  onClose,
  onSaved,
}: {
  groups: Group[];
  initialScope: VocabularyScope;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [groupId, setGroupId] = useState(
    groups.find((g) => vocabularyLevel(g.level) === initialScope.level)?.id || groups[0]?.id || '',
  );
  const [scope, setScope] = useState<VocabularyScope>(initialScope);
  const [grants, setGrants] = useState<(VocabularyScope & { categories: string[] })[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!groupId) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    setError('');
    api<{ grants: typeof grants }>(`teacher/vocabulary/access?groupId=${groupId}`)
      .then((d) => {
        if (active) setGrants(d.grants);
      })
      .catch((e) => {
        if (active) setError(errorText(e));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [groupId]);
  useEffect(() => {
    setSelected(grants.find((g) => sameScope(g, scope))?.categories || []);
  }, [grants, scope]);
  const topics = vocabularyTopics(scope);
  const group = groups.find((g) => g.id === groupId);
  const matches = group && vocabularyLevel(group.level) === scope.level;
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('teacher/vocabulary/access', {
        method: 'POST',
        body: JSON.stringify({ groupId, scope, categories: selected }),
      });
      onSaved();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Guruhga lug‘at ochish" onClose={onClose}>
      <form className="form-stack" onSubmit={save}>
        <label>
          Guruh
          <select
            aria-label="Guruh"
            value={groupId}
            onChange={(e) => {
              setGroupId(e.target.value);
              const level = vocabularyLevel(groups.find((g) => g.id === e.target.value)!.level);
              setScope({ level, book: level === 'hangul' ? '1A' : null, section: 'reading' });
            }}
          >
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </label>
        <ScopePicker value={scope} onChange={setScope} />
        <p className="vocab-form-note">
          Butun kitob/bo‘limni yoki alohida mavzularni oching. “Barchasi” tanlansa, keyin
          qo‘shiladigan so‘zlar ham ochiladi.
        </p>
        {loading ? (
          <p role="status">Ruxsatlar yuklanmoqda…</p>
        ) : (
          <fieldset className="vocab-bands-field" disabled={!!error || !matches}>
            <legend>O‘quvchilarga ochilgan mavzular</legend>
            <label>
              <input
                type="checkbox"
                checked={selected.includes('all')}
                onChange={(e) => setSelected(e.target.checked ? ['all'] : [])}
              />
              Barchasi
            </label>
            {topics.map((t) => (
              <label key={t.id}>
                <input
                  type="checkbox"
                  checked={selected.includes('all') || selected.includes(t.id)}
                  onChange={(e) => {
                    const current = selected.includes('all') ? topics.map((x) => x.id) : selected;
                    setSelected(
                      e.target.checked ? [...current, t.id] : current.filter((c) => c !== t.id),
                    );
                  }}
                />
                {t.label}
              </label>
            ))}
          </fieldset>
        )}
        {!matches && <p className="alert">Guruh darajasiga mos lug‘atni tanlang.</p>}
        {error && (
          <p className="alert error" role="alert">
            {error}
          </p>
        )}
        <button className="button primary" disabled={busy || loading || !matches || !!error}>
          {busy ? 'Saqlanmoqda…' : 'Ruxsatlarni saqlash'}
        </button>
      </form>
    </Modal>
  );
}
