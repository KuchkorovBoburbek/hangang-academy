import fs from 'node:fs';
import path from 'node:path';
import { solutionSchema, solutionSourceHash } from '../lib/solution-schema';
import type { TopikGroup, TopikQuestion } from '../lib/topik-types';
import type { SolutionContent } from '../lib/solution-types';
const base = path.resolve('content/topik');
const groups: TopikGroup[] = JSON.parse(fs.readFileSync(path.join(base, 'groups.json'), 'utf8'));
const file = path.join(base, 'solutions.json');
const entries = new Map<
  string,
  { questionId: string; sourceHash: string; content: SolutionContent }
>(
  JSON.parse(fs.readFileSync(file, 'utf8')).map(
    (s: { questionId: string; sourceHash: string; content: SolutionContent }) => [s.questionId, s],
  ),
);
function tip(group: TopikGroup, question: TopikQuestion) {
  const n = question.number;
  const task = question.prompt || group.instruction;
  if (n < 5) return 'Avval gapdagi ma’no munosabatini, so‘ng grammatik shaklni tekshiring.';
  if (n < 9) return 'Kalit so‘zlarni birlashtirib, matnning maqsadi yoki xizmat turini toping.';
  if (n === 10)
    return 'Diagrammada birlik, yil va ulushlarni tekshiring; “eng ko‘p” va “yarmidan ko‘p”ni farqlang.';
  if (n < 13 || /내용과 같은/.test(task))
    return 'Variantdagi shaxs, vaqt, sabab va miqdorni matn bilan alohida solishtiring.';
  if (n < 16) return 'Avval mavzuni ochgan gapni, keyin olmosh va bog‘lovchilar zanjirini toping.';
  if (/태도|심정/.test(task))
    return 'So‘ralgan jumladagi hissiyot yoki bahoni aniqlang; uni voqeaning yakuniga almashtirmang.';
  if (/목적/.test(task))
    return 'Muallif nima qilmoqchi: tanishtirmoq, tanqid qilmoq yoki o‘zgarishga undamoq? Yakuniga qarang.';
  if (/주제|중심 생각/.test(task))
    return 'Asosiy fikr butun matnni qamrasin; bitta misolni mavzu deb olmang.';
  if (n === 19)
    return 'Bo‘shliqning ikki tomonini o‘qing: qo‘shish, zidlik yoki sabab munosabatini aniqlang.';
  if (n === 21) return 'Iborani so‘zma-so‘z emas, vaziyatdagi ko‘chma ma’nosi bilan talqin qiling.';
  if (n >= 25 && n <= 27)
    return 'Sarlavhadagi ko‘chma iborani oddiy gapga aylantiring; yangi ma’lumot qo‘shmang.';
  if ((n >= 39 && n <= 41) || n === 46)
    return 'Kiritiladigan gapning oldingi va keyingi jumla bilan aloqasini tekshiring.';
  return 'Bo‘shliqdan oldingi fikrni keyingi izoh va misollar bilan bog‘lang.';
}
const plain = (s: string) => s.replace(/<\/?u>/g, '').replace(/\s+/g, '');
const seen = new Set<string>();
for (const name of fs
  .readdirSync(path.join(base, 'solution-notes'))
  .filter((n) => n.endsWith('.txt'))
  .sort()) {
  for (const line of fs
    .readFileSync(path.join(base, 'solution-notes', name), 'utf8')
    .split('\n')
    .filter((l) => l.trim() && !l.startsWith('#'))) {
    const [key, answer, reason, elimination, evidence = '', customTip = ''] = line.split('|');
    const questionId =
      name === 'grammar.txt'
        ? `hangang-grammar-${key}`
        : `topik-${name.replace('.txt', '')}-r-${key.padStart(2, '0')}`;
    if (seen.has(questionId)) throw Error(`Duplicate authored note: ${questionId}`);
    seen.add(questionId);
    const group = groups.find((g) => g.questions.some((q) => q.id === questionId));
    const q = group?.questions.find((q) => q.id === questionId);
    if (!group || !q || q.withheld || !q.verified || q.answer === null)
      throw Error(`Unavailable question: ${questionId}`);
    if (Number(answer) !== q.answer + 1)
      throw Error(`Independent answer differs: ${questionId}: ${answer}/${q.answer + 1}`);
    if (
      evidence &&
      !plain(
        [
          group.passage,
          ...group.blocks.map((b) => b.text || b.alt || ''),
          q.prompt,
          ...q.options,
        ].join(' '),
      ).includes(plain(evidence))
    )
      throw Error(`Quote not in source: ${questionId}: ${evidence}`);
    const content = solutionSchema.parse({
      reason: `${['①', '②', '③', '④'][q.answer]} ${reason}`,
      elimination,
      evidence,
      tip: customTip || tip(group, q),
    });
    entries.set(questionId, { questionId, sourceHash: solutionSourceHash(group, q), content });
  }
}
const expected = groups.flatMap((g) =>
  g.questions.filter((q) => !q.withheld && q.verified && q.answer !== null).map((q) => ({ g, q })),
);
for (const { g, q } of expected) {
  const s = entries.get(q.id);
  if (s && s.sourceHash !== solutionSourceHash(g, q)) throw Error(`Stale source: ${q.id}`);
}
const output = expected.flatMap(({ q }) => (entries.has(q.id) ? [entries.get(q.id)!] : []));
fs.writeFileSync(file, JSON.stringify(output, null, 2) + '\n');
console.log(
  JSON.stringify(
    {
      ready: output.length,
      total: expected.length,
      remaining: expected.length - output.length,
      byExam: [...new Set(groups.map((g) => g.source.exam))].map((exam) => ({
        exam: exam ?? 'grammar',
        ready: expected.filter((x) => x.g.source.exam === exam && entries.has(x.q.id)).length,
      })),
    },
    null,
    2,
  ),
);
if (process.argv.includes('--complete') && output.length !== expected.length) process.exitCode = 1;
