import type { Grammar } from './types';

export type GrammarTopicId =
  | 'time-sequence'
  | 'cause-result'
  | 'purpose-intention'
  | 'condition-obligation'
  | 'assumption-possibility'
  | 'comparison-contrast'
  | 'choice-addition'
  | 'state-experience';

export type GrammarTopic = {
  id: GrammarTopicId;
  ko: string;
  label: string;
  description: string;
};

export const GRAMMAR_TOPICS: readonly GrammarTopic[] = [
  {
    id: 'time-sequence',
    ko: '시간과 순서',
    label: 'Vaqt va ketma-ketlik',
    description: 'Harakatning vaqti, davomiyligi va ishlarning ketma-ketligi',
  },
  {
    id: 'cause-result',
    ko: '원인과 결과',
    label: 'Sabab va natija',
    description: 'Sabab, oqibat va vaziyatdan kelib chiqqan natijalar',
  },
  {
    id: 'purpose-intention',
    ko: '목적과 의도',
    label: 'Maqsad va niyat',
    description: 'Reja, niyat, istak va bir ishni qilishdan ko‘zlangan maqsad',
  },
  {
    id: 'condition-obligation',
    ko: '조건과 의무',
    label: 'Shart va majburiyat',
    description: 'Shart, zarurat, ruxsat va bajarilishi kerak bo‘lgan harakatlar',
  },
  {
    id: 'assumption-possibility',
    ko: '추측과 가능성',
    label: 'Taxmin va ehtimol',
    description: 'Taxmin, ehtimol, xavotir va ma’lumotni aniqlash',
  },
  {
    id: 'comparison-contrast',
    ko: '비교와 대조',
    label: 'Taqqoslash va qarama-qarshilik',
    description: 'Farq, o‘xshashlik, zid holat va darajani taqqoslash',
  },
  {
    id: 'choice-addition',
    ko: '선택과 추가',
    label: 'Tanlov va qo‘shimcha',
    description: 'Variant tanlash, ma’noni qo‘shish yoki cheklash',
  },
  {
    id: 'state-experience',
    ko: '상태와 경험',
    label: 'Holat va tajriba',
    description: 'Holatning saqlanishi, o‘zgarishi, tajriba va bajarish usuli',
  },
] as const;

const TOPIC_MEMBERS: Record<GrammarTopicId, readonly string[]> = {
  'time-sequence': [
    'A01',
    'A02',
    'A10',
    'A16',
    'A23',
    'A30',
    'B08',
    'B10',
    'C08',
    'C12',
    'C24',
    'C31',
    'D02',
    'D11',
    'D12',
    'D14',
  ],
  'cause-result': [
    'A06',
    'A12',
    'A13',
    'A14',
    'A17',
    'A24',
    'A26',
    'A28',
    'B04',
    'B05',
    'B13',
    'C03',
    'C06',
    'C19',
    'C32',
    'C40',
    'D18',
  ],
  'purpose-intention': [
    'A04',
    'A27',
    'B02',
    'B19',
    'C11',
    'C16',
    'C17',
    'D08',
    'D09',
    'D15',
    'D17',
  ],
  'condition-obligation': [
    'A05',
    'A07',
    'A18',
    'B03',
    'C04',
    'C15',
    'C21',
    'C33',
    'D03',
    'D04',
    'D05',
    'D10',
  ],
  'assumption-possibility': [
    'A08',
    'A15',
    'B11',
    'B12',
    'B14',
    'B16',
    'B18',
    'B20',
    'C01',
    'C07',
    'C20',
    'C34',
    'C35',
    'C39',
    'D01',
    'D13',
    'D16',
  ],
  'comparison-contrast': [
    'A03',
    'A11',
    'A21',
    'A22',
    'A29',
    'B09',
    'C02',
    'C09',
    'C10',
    'C13',
    'C22',
    'C25',
    'C26',
    'C27',
    'C28',
    'C29',
    'C38',
    'D06',
    'D07',
    'D19',
    'D20',
    'D21',
  ],
  'choice-addition': ['A09', 'A19', 'A20', 'C05', 'C14', 'C30', 'C36'],
  'state-experience': ['A25', 'B01', 'B06', 'B07', 'B15', 'B17', 'C18', 'C23', 'C37'],
};

const TOPIC_BY_GRAMMAR_ID = new Map<string, GrammarTopicId>(
  Object.entries(TOPIC_MEMBERS).flatMap(([topicId, ids]) =>
    ids.map((id) => [id, topicId as GrammarTopicId] as const),
  ),
);

export function grammarTopicFor(grammar: Grammar | string) {
  const id = typeof grammar === 'string' ? grammar : grammar.id;
  const topicId = TOPIC_BY_GRAMMAR_ID.get(id) || 'state-experience';
  return GRAMMAR_TOPICS.find((topic) => topic.id === topicId)!;
}

export function groupGrammarsByTopic(grammars: Grammar[]) {
  return GRAMMAR_TOPICS.map((topic) => ({
    ...topic,
    grammars: grammars.filter((grammar) => grammarTopicFor(grammar).id === topic.id),
  })).filter((topic) => topic.grammars.length > 0);
}

export function explicitlyCategorizedGrammarIds() {
  return new Set(TOPIC_BY_GRAMMAR_ID.keys());
}
