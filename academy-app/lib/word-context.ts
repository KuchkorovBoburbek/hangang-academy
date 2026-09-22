import FORMS from '../content/topik/vocabulary-forms.json';
import type { TopikVocabulary } from './topik-types';
const forms = FORMS as Record<string, string[]>;
export type WordMatch = { start: number; end: number; surface: string; word: TopikVocabulary };
export function matchWords(text: string, words: TopikVocabulary[]): WordMatch[] {
  const matches: WordMatch[] = [];
  for (const word of words)
    for (const form of [...(word.matchForms ?? forms[word.id] ?? []), word.ko].sort(
      (a, b) => b.length - a.length,
    )) {
      if (!form) continue;
      let from = 0;
      while (from < text.length) {
        const start = text.indexOf(form, from);
        if (start < 0) break;
        from = start + form.length;
        if (start && /[가-힣]/u.test(text[start - 1])) continue;
        if (word.ko === '즉' && /[가-힣]/u.test(text[start + form.length] || '')) continue;
        if (
          word.ko === '법' &&
          !/^(을|이|은|과|에|의|도|만|으로|적|\s|[.,!?]|$)/.test(text.slice(start + 1))
        )
          continue;
        if (word.ko === '법' && /[는은을]\s*$/.test(text.slice(Math.max(0, start - 8), start)))
          continue;
        let end = start + form.length;
        while (end < text.length && /[가-힣]/u.test(text[end])) end++;
        matches.push({ start, end, surface: text.slice(start, end), word });
      }
    }
  // Longest phrase wins when a noun and idiom overlap.
  matches.sort((a, b) => a.start - b.start || b.end - a.end);
  const result: WordMatch[] = [];
  for (const match of matches)
    if (!result.length || match.start >= result.at(-1)!.end) result.push(match);
  return result;
}
export function wordCloze(word: TopikVocabulary) {
  const match = matchWords(word.example, [word])[0];
  return match
    ? {
        prompt: word.example.slice(0, match.start) + '______' + word.example.slice(match.end),
        answer: match.surface,
      }
    : null;
}
