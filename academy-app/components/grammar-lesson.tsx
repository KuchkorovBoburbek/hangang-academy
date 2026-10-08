'use client';
import { useMemo, useState } from 'react';
import type { Grammar } from '@/lib/types';
const PAIRS: Record<string, string> = {
  A01: 'A02',
  A02: 'A10',
  A04: 'C17',
  A05: 'A18',
  A06: 'A24',
  A07: 'A18',
  A08: 'B18',
  A09: 'A19',
  A10: 'A02',
  A12: 'A17',
  A16: 'A25',
  A17: 'A12',
  A18: 'A05',
  A19: 'A09',
  A21: 'C26',
  A22: 'C28',
  A23: 'C12',
  A24: 'A26',
  A25: 'A16',
  A26: 'A24',
  A29: 'A22',
  A30: 'C24',
  B01: 'B19',
  B04: 'B05',
  B05: 'B04',
  B07: 'D11',
  B08: 'B10',
  B10: 'B08',
  B12: 'B14',
  B14: 'C01',
  B16: 'C01',
  B18: 'B20',
  B19: 'B01',
  B20: 'B18',
  C03: 'D13',
  C04: 'C14',
  C05: 'A20',
  C08: 'C18',
  C12: 'A23',
  C17: 'A04',
  C18: 'A10',
  C24: 'A30',
  C26: 'A21',
  C28: 'A22',
  C33: 'A18',
  C34: 'C01',
  C35: 'B18',
  C37: 'A16',
  D01: 'A15',
  D02: 'A02',
  D03: 'D05',
  D05: 'D03',
  D08: 'D17',
  D10: 'A18',
  D11: 'B07',
  D12: 'D14',
  D13: 'D16',
  D14: 'D11',
  D16: 'D13',
  D17: 'D08',
  D19: 'C26',
  D20: 'B09',
};
export default function GrammarLesson({
  grammar,
  grammars,
  correctDays,
  showMastery = true,
}: {
  grammar: Grammar;
  grammars: Grammar[];
  correctDays: number;
  showMastery?: boolean;
}) {
  const [view, setView] = useState<'learn' | 'recall' | 'compare'>('learn');
  const [pairChoice, setPairChoice] = useState<string | null>(null);
  const [comparison, setComparison] = useState(PAIRS[grammar.id] || '');
  const [choice, setChoice] = useState<string | null>(null);
  const [showMeaning, setShowMeaning] = useState(false);
  const other = grammars.find((g) => g.id === comparison);
  const options = useMemo(() => {
    const candidates = [
      grammar,
      ...grammars.filter((g) => g.id !== grammar.id && g.meaning !== grammar.meaning).slice(0, 3),
    ];
    // Fixed rotation avoids treating the first option as the answer for every lesson.
    const shift = Number(grammar.id.slice(1)) % candidates.length;
    return [...candidates.slice(shift), ...candidates.slice(0, shift)];
  }, [grammar, grammars]);
  return (
    <div className="grammar-mini">
      <div className="segmented" aria-label="Mini-dars bosqichlari">
        {(
          [
            ['learn', 'Tushunish'],
            ['recall', 'Eslab ko‘rish'],
            ['compare', 'Taqqoslash'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            className={view === id ? 'active' : ''}
            aria-pressed={view === id}
            onClick={() => setView(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {view === 'learn' && (
        <>
          <section>
            <h3>1. Qaysi vaziyatda ishlatiladi?</h3>
            <p>{grammar.meaning}</p>
          </section>
          <section>
            <h3>2. Xatodan saqlanish</h3>
            <p>{grammar.note}</p>
            <p className="muted">
              Gapga qo‘shishdan oldin so‘z turini va <span lang="ko">{grammar.syntax}</span>{' '}
              tuzilishini tekshiring.
            </p>
          </section>
          <section>
            <h3>3. Misolni o‘zingiz tushuntiring</h3>
            <p lang="ko">{grammar.ko}</p>
            <button className="text-button" onClick={() => setShowMeaning(!showMeaning)}>
              {showMeaning ? 'Tarjimani yopish' : 'O‘ylab bo‘lgach, tarjimani ochish'}
            </button>
            {showMeaning && <p>{grammar.uz}</p>}
          </section>
        </>
      )}
      {view === 'recall' && (
        <section>
          <h3>Ma’noni eslab ko‘ring</h3>
          <p>
            <span lang="ko">{grammar.form}</span> nimani bildiradi?
          </p>
          <div className="grammar-recall">
            {options.map((g) => (
              <button
                className="button secondary"
                key={g.id}
                disabled={choice !== null}
                onClick={() => setChoice(g.id)}
                aria-pressed={choice === g.id}
              >
                {g.meaning}
              </button>
            ))}
          </div>
          {choice && (
            <p role="status">
              {choice === grammar.id ? 'To‘g‘ri.' : 'Yana eslang:'} {grammar.meaning}
            </p>
          )}
        </section>
      )}
      {view === 'compare' && (
        <section>
          <h3>Ikki shaklni taqqoslang</h3>
          <label>
            Taqqoslash uchun grammatika
            <select
              value={comparison}
              onChange={(e) => {
                setComparison(e.target.value);
                setPairChoice(null);
              }}
            >
              <option value="">Shaklni tanlang</option>
              {grammars
                .filter((g) => g.id !== grammar.id && g.form !== grammar.form)
                .map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.form}
                  </option>
                ))}
            </select>
          </label>
          {other && (
            <div className="grammar-compare">
              {[grammar, other].map((g) => (
                <article key={g.id}>
                  <h4 lang="ko">{g.form}</h4>
                  <p>{g.meaning}</p>
                  <p lang="ko">{g.ko}</p>
                  <p>{g.uz}</p>
                  <small>{g.note}</small>
                </article>
              ))}
            </div>
          )}
          {other && other.meaning !== grammar.meaning && (
            <section>
              <h3>Farqini sinab ko‘ring</h3>
              <p lang="ko">{other.ko}</p>
              <p>Bu gapda qaysi ma’no ifodalangan?</p>
              <div className="grammar-recall">
                {[grammar, other].map((g) => (
                  <button
                    className="button secondary"
                    key={g.id}
                    disabled={pairChoice !== null}
                    onClick={() => setPairChoice(g.id)}
                  >
                    {g.meaning}
                  </button>
                ))}
              </div>
              {pairChoice && (
                <p role="status">
                  {pairChoice === other.id ? 'To‘g‘ri.' : 'Bu gapdagi ma’no:'} {other.meaning}
                </p>
              )}
            </section>
          )}
        </section>
      )}
      {showMastery && (
        <section>
          <h3>O‘zlashtirish</h3>
          <p>
            {correctDays >= 3
              ? 'Mustahkamlanmoqda'
              : correctDays
                ? 'Mashq boshlandi'
                : 'Hali tekshirilmagan'}{' '}
            · {correctDays} alohida kunda to‘g‘ri javob.
          </p>
          <p className="muted">
            Sahifani ochish hisoblanmaydi. Quyidagi TOPIK mashqini turli kunlarda bajaring; xato
            yoki ikkilanishdan keyin hisob yangidan boshlanadi.
          </p>
        </section>
      )}
    </div>
  );
}
