export type GrammarPracticeExample = {
  sentence: string;
  translation: string;
  target: string;
  wrong: string;
};

export type GrammarPracticeSpec = {
  grammarId: string;
  markerGroups: string[][];
  examples: [
    GrammarPracticeExample,
    GrammarPracticeExample,
    GrammarPracticeExample,
    GrammarPracticeExample,
  ];
};

const spec = (
  grammarId: string,
  markerGroups: string[][],
  examples: GrammarPracticeSpec['examples'],
): GrammarPracticeSpec => ({ grammarId, markerGroups, examples });

const e = (
  sentence: string,
  translation: string,
  target: string,
  wrong: string,
): GrammarPracticeExample => ({ sentence, translation, target, wrong });

export const SEOULTE_1A_PRACTICE: Record<string, GrammarPracticeSpec> = Object.fromEntries(
  [
    spec(
      'S1A-01-01',
      [
        ['은', '는'],
        ['이에요', '예요'],
      ],
      [
        e('저는 학생이에요.', 'Men talabaman.', '학생이에요', '저는 학생이예요.'),
        e('제 친구는 의사예요.', 'Mening do‘stim shifokor.', '의사예요', '제 친구는 의사이에요.'),
        e('이것은 제 가방이에요.', 'Bu mening sumkam.', '제 가방이에요', '이것은 제 가방예요.'),
        e('유나는 회사원이에요.', 'Yuna kompaniya xodimi.', '회사원이에요', '유나는 회사원이예요.'),
      ],
    ),
    spec(
      'S1A-01-02',
      [['입니다', '입니까']],
      [
        e('저는 학생입니다.', 'Men talabaman.', '학생입니다', '저는 학생입니다요.'),
        e('선생님입니까?', 'O‘qituvchimisiz?', '선생님입니까', '선생님입니까요?'),
        e('제 이름은 민수입니다.', 'Mening ismim Minsu.', '민수입니다', '제 이름은 민수입나다.'),
        e('한국 사람입니까?', 'Koreyalikmisiz?', '사람입니까', '한국 사람이입니까?'),
      ],
    ),
    spec(
      'S1A-01-03',
      [['이 아닙니다', '가 아닙니다']],
      [
        e(
          '저는 의사가 아닙니다.',
          'Men shifokor emasman.',
          '의사가 아닙니다',
          '저는 의사를 아닙니다.',
        ),
        e(
          '민수 씨는 학생이 아닙니다.',
          'Minsu talaba emas.',
          '학생이 아닙니다',
          '민수 씨는 학생을 아닙니다.',
        ),
        e('이것은 책이 아닙니다.', 'Bu kitob emas.', '책이 아닙니다', '이것은 책을 아닙니다.'),
        e(
          '유나는 선생님이 아닙니다.',
          'Yuna o‘qituvchi emas.',
          '선생님이 아닙니다',
          '유나는 선생님을 아닙니다.',
        ),
      ],
    ),
    spec(
      'S1A-02-01',
      [['이 있어요', '가 있어요', '이 없어요', '가 없어요']],
      [
        e('교실에 책상이 있어요.', 'Sinfda parta bor.', '책상이 있어요', '교실에 책상을 있어요.'),
        e(
          '가방에 우산이 없어요.',
          'Sumkada soyabon yo‘q.',
          '우산이 없어요',
          '가방에 우산을 없어요.',
        ),
        e('집에 고양이가 있어요.', 'Uyda mushuk bor.', '고양이가 있어요', '집에 고양이를 있어요.'),
        e(
          '책상 위에 컴퓨터가 없어요.',
          'Stol ustida kompyuter yo‘q.',
          '컴퓨터가 없어요',
          '책상 위에 컴퓨터를 없어요.',
        ),
      ],
    ),
    spec(
      'S1A-02-02',
      [
        ['이거는', '그거는', '저거는'],
        ['이에요', '예요'],
      ],
      [
        e('이거는 제 공책이에요.', 'Bu mening daftarim.', '제 공책이에요', '이거는 제 공책예요.'),
        e('그거는 지우개예요.', 'U o‘chirg‘ich.', '지우개예요', '그거는 지우개이에요.'),
        e(
          '저거는 한국 지도예요.',
          'Anavi Koreya xaritasi.',
          '한국 지도예요',
          '저거는 한국 지도이에요.',
        ),
        e('이거는 연필이에요.', 'Bu qalam.', '연필이에요', '이거는 연필예요.'),
      ],
    ),
    spec(
      'S1A-02-03',
      [['주세요']],
      [
        e('물 한 병 주세요.', 'Bir shisha suv bering.', '한 병 주세요', '물 한 병 주새요.'),
        e('커피 두 잔 주세요.', 'Ikki piyola qahva bering.', '두 잔 주세요', '커피 두 잔 주서요.'),
        e('김밥 하나 주세요.', 'Bitta kimbap bering.', '하나 주세요', '김밥 하나 주새요.'),
        e('메뉴판 좀 주세요.', 'Menyuni bering, iltimos.', '좀 주세요', '메뉴판 좀 주서요.'),
      ],
    ),
    spec(
      'S1A-02-04',
      [['하고', '과', '와']],
      [
        e(
          '사과하고 바나나를 샀어요.',
          'Olma va banan sotib oldim.',
          '사과하고 바나나',
          '사과와 하고 바나나를 샀어요.',
        ),
        e('책과 공책이 있어요.', 'Kitob va daftar bor.', '책과 공책', '책와 공책이 있어요.'),
        e('언니와 동생이 왔어요.', 'Opa va uka keldi.', '언니와 동생', '언니과 동생이 왔어요.'),
        e(
          '빵하고 우유를 먹어요.',
          'Non va sut iste’mol qilaman.',
          '빵하고 우유',
          '빵과와 우유를 먹어요.',
        ),
      ],
    ),
    spec(
      'S1A-03-01',
      [['요']],
      [
        e('저는 아침을 먹어요.', 'Men nonushta qilaman.', '먹어요', '저는 아침을 먹아요.'),
        e(
          '오후에 친구를 만나요.',
          'Tushdan keyin do‘stim bilan uchrashaman.',
          '만나요',
          '오후에 친구를 만나어요.',
        ),
        e('매일 운동해요.', 'Har kuni mashq qilaman.', '운동해요', '매일 운동하아요.'),
        e('아침에 학교에 가요.', 'Ertalab maktabga boraman.', '가요', '아침에 학교에 가어요.'),
      ],
    ),
    spec(
      'S1A-03-02',
      [['을', '를']],
      [
        e('저는 음악을 들어요.', 'Men musiqa tinglayman.', '음악을', '저는 음악이 들어요.'),
        e('아침에 커피를 마셔요.', 'Ertalab qahva ichaman.', '커피를', '아침에 커피가 마셔요.'),
        e(
          '도서관에서 책을 읽어요.',
          'Kutubxonada kitob o‘qiyman.',
          '책을',
          '도서관에서 책이 읽어요.',
        ),
        e(
          '주말에 친구를 만나요.',
          'Dam olish kuni do‘stim bilan uchrashaman.',
          '친구를',
          '주말에 친구가 만나요.',
        ),
      ],
    ),
    spec(
      'S1A-03-03',
      [['에서']],
      [
        e('도서관에서 공부해요.', 'Kutubxonada o‘qiyman.', '도서관에서', '도서관에 공부해요.'),
        e('식당에서 밥을 먹어요.', 'Oshxonada ovqat yeyman.', '식당에서', '식당에 밥을 먹어요.'),
        e('집에서 쉬어요.', 'Uyda dam olaman.', '집에서', '집에 쉬어요.'),
        e('공원에서 운동해요.', 'Bog‘da mashq qilaman.', '공원에서', '공원에 운동해요.'),
      ],
    ),
    spec(
      'S1A-03-04',
      [['안 ']],
      [
        e('저는 커피를 안 마셔요.', 'Men qahva ichmayman.', '안 마셔요', '저는 커피를 마셔요 안.'),
        e('오늘 학교에 안 가요.', 'Bugun maktabga bormayman.', '안 가요', '오늘 학교에 가요 안.'),
        e('동생은 운동을 안 해요.', 'Ukam mashq qilmaydi.', '안 해요', '동생은 운동을 해요 안.'),
        e('저는 고기를 안 먹어요.', 'Men go‘sht yemayman.', '안 먹어요', '저는 고기를 먹어요 안.'),
      ],
    ),
    spec(
      'S1A-04-01',
      [['여기가'], ['이에요', '예요']],
      [
        e(
          '여기가 우리 교실이에요.',
          'Mana shu yer bizning sinfimiz.',
          '여기가',
          '여기를 우리 교실이에요.',
        ),
        e('여기가 도서관이에요.', 'Mana shu yer kutubxona.', '여기가', '여기를 도서관이에요.'),
        e('여기가 서울역이에요.', 'Mana shu yer Seul vokzali.', '여기가', '여기를 서울역이에요.'),
        e('여기가 제 집이에요.', 'Mana shu yer mening uyim.', '여기가', '여기를 제 집이에요.'),
      ],
    ),
    spec(
      'S1A-04-02',
      [['에 있어요', '에 없어요']],
      [
        e(
          '가방이 의자 위에 있어요.',
          'Sumka stul ustida.',
          '의자 위에',
          '가방이 의자 위에서 있어요.',
        ),
        e(
          '책이 책상 아래에 있어요.',
          'Kitob stol ostida.',
          '책상 아래에',
          '책이 책상 아래에서 있어요.',
        ),
        e(
          '고양이가 침대 옆에 있어요.',
          'Mushuk karavot yonida.',
          '침대 옆에',
          '고양이가 침대 옆에서 있어요.',
        ),
        e(
          '은행이 학교 앞에 없어요.',
          'Maktab oldida bank yo‘q.',
          '학교 앞에',
          '은행이 학교 앞에서 없어요.',
        ),
      ],
    ),
    spec(
      'S1A-04-03',
      [['에 가요', '에 와요']],
      [
        e(
          '친구가 학교에 와요.',
          'Do‘stim maktabga keladi.',
          '학교에 와요',
          '친구가 학교에서 와요.',
        ),
        e('저는 회사에 가요.', 'Men ishxonaga boraman.', '회사에 가요', '저는 회사에서 가요.'),
        e(
          '선생님이 교실에 와요.',
          'O‘qituvchi sinfga keladi.',
          '교실에 와요',
          '선생님이 교실에서 와요.',
        ),
        e(
          '주말에 시장에 가요.',
          'Dam olish kuni bozorga boraman.',
          '시장에 가요',
          '주말에 시장에서 가요.',
        ),
      ],
    ),
    spec(
      'S1A-04-04',
      [['앞에', '뒤에', '옆에', '위에', '아래에']],
      [
        e(
          '은행은 학교 옆에 있어요.',
          'Bank maktab yonida.',
          '학교 옆에',
          '은행은 옆 학교에 있어요.',
        ),
        e(
          '버스 정류장은 회사 앞에 있어요.',
          'Avtobus bekati ishxona oldida.',
          '회사 앞에',
          '버스 정류장은 앞 회사에 있어요.',
        ),
        e(
          '화장실은 교실 뒤에 있어요.',
          'Hojatxona sinf orqasida.',
          '교실 뒤에',
          '화장실은 뒤 교실에 있어요.',
        ),
        e(
          '가방은 의자 아래에 있어요.',
          'Sumka stul ostida.',
          '의자 아래에',
          '가방은 아래 의자에 있어요.',
        ),
      ],
    ),
    spec(
      'S1A-05-01',
      [['에']],
      [
        e(
          '월요일에 수업이 있어요.',
          'Dushanba kuni dars bor.',
          '월요일에',
          '월요일에서 수업이 있어요.',
        ),
        e(
          '아침 아홉 시에 학교에 가요.',
          'Ertalab soat to‘qqizda maktabga boraman.',
          '아홉 시에',
          '아침 아홉 시에서 학교에 가요.',
        ),
        e(
          '주말에 친구를 만나요.',
          'Dam olish kuni do‘stim bilan uchrashaman.',
          '주말에',
          '주말에서 친구를 만나요.',
        ),
        e(
          '금요일에 시험을 봐요.',
          'Juma kuni imtihon topshiraman.',
          '금요일에',
          '금요일에서 시험을 봐요.',
        ),
      ],
    ),
    spec(
      'S1A-05-02',
      [['았어요', '었어요', '했어요', '봤어요', '났어요', '셨어요', '웠어요']],
      [
        e(
          '어제 친구를 만났어요.',
          'Kecha do‘stim bilan uchrashdim.',
          '만났어요',
          '어제 친구를 만나요.',
        ),
        e('아침에 밥을 먹었어요.', 'Ertalab ovqat yedim.', '먹었어요', '아침에 밥을 먹어요.'),
        e(
          '지난주에 영화를 봤어요.',
          'O‘tgan hafta film ko‘rdim.',
          '봤어요',
          '지난주에 영화를 봐요.',
        ),
        e(
          '주말에 집에서 쉬었어요.',
          'Dam olish kuni uyda dam oldim.',
          '쉬었어요',
          '주말에 집에서 쉬어요.',
        ),
      ],
    ),
    spec(
      'S1A-05-03',
      [['고 ']],
      [
        e(
          '공원에 가고 사진을 찍었어요.',
          'Bog‘ga bordim va suratga oldim.',
          '가고',
          '공원에 가요고 사진을 찍었어요.',
        ),
        e(
          '밥을 먹고 커피를 마셨어요.',
          'Ovqat yedim va qahva ichdim.',
          '먹고',
          '밥을 먹으고 커피를 마셨어요.',
        ),
        e(
          '숙제를 하고 잤어요.',
          'Uy vazifasini qildim va uxladim.',
          '하고',
          '숙제를 하하고 잤어요.',
        ),
        e(
          '친구를 만나고 영화를 봤어요.',
          'Do‘stim bilan uchrashdim va film ko‘rdim.',
          '만나고',
          '친구를 만나으고 영화를 봤어요.',
        ),
      ],
    ),
    spec(
      'S1A-06-01',
      [['세요']],
      [
        e('여기에 앉으세요.', 'Shu yerga o‘tiring.', '앉으세요', '여기에 앉세요.'),
        e('문을 닫으세요.', 'Eshikni yoping.', '닫으세요', '문을 닫세요.'),
        e('천천히 읽으세요.', 'Sekin o‘qing.', '읽으세요', '천천히 읽세요.'),
        e('이쪽으로 오세요.', 'Bu tomonga keling.', '오세요', '이쪽으로 오으세요.'),
      ],
    ),
    spec(
      'S1A-06-02',
      [[' 개', ' 병', ' 잔', ' 그릇']],
      [
        e('사과 세 개 주세요.', 'Uchta olma bering.', '세 개', '사과 세 명 주세요.'),
        e('물 두 병 주세요.', 'Ikki shisha suv bering.', '두 병', '물 두 명 주세요.'),
        e('커피 한 잔 주세요.', 'Bir piyola qahva bering.', '한 잔', '커피 한 명 주세요.'),
        e(
          '비빔밥 두 그릇 주세요.',
          'Ikki kosa bibimbap bering.',
          '두 그릇',
          '비빔밥 두 명 주세요.',
        ),
      ],
    ),
    spec(
      'S1A-06-03',
      [
        ['이 ', '가 '],
        ['아요', '어요', '해요', '워요'],
      ],
      [
        e('비빔밥이 맛있어요.', 'Bibimbap mazali.', '비빔밥이 맛있어요', '비빔밥을 맛있어요.'),
        e('날씨가 더워요.', 'Havo issiq.', '날씨가 더워요', '날씨를 더워요.'),
        e('커피가 뜨거워요.', 'Qahva issiq.', '커피가 뜨거워요', '커피를 뜨거워요.'),
        e('김치가 매워요.', 'Kimchi achchiq.', '김치가 매워요', '김치를 매워요.'),
      ],
    ),
    spec(
      'S1A-06-04',
      [['도']],
      [
        e(
          '저도 김치를 좋아해요.',
          'Men ham kimchini yoqtiraman.',
          '저도',
          '저도를 김치를 좋아해요.',
        ),
        e(
          '친구도 한국어를 공부해요.',
          'Do‘stim ham koreys tilini o‘rganadi.',
          '친구도',
          '친구도를 한국어를 공부해요.',
        ),
        e('커피도 주세요.', 'Qahva ham bering.', '커피도', '커피도를 주세요.'),
        e('오늘도 비가 와요.', 'Bugun ham yomg‘ir yog‘moqda.', '오늘도', '오늘도를 비가 와요.'),
      ],
    ),
    spec(
      'S1A-07-01',
      [['지만']],
      [
        e('날씨가 춥지만 맑아요.', 'Havo sovuq, lekin ochiq.', '춥지만', '날씨가 춥으지만 맑아요.'),
        e(
          '김치는 맵지만 맛있어요.',
          'Kimchi achchiq, lekin mazali.',
          '맵지만',
          '김치는 맵으지만 맛있어요.',
        ),
        e(
          '피곤하지만 공부해요.',
          'Charchaganman, lekin o‘qiyman.',
          '피곤하지만',
          '피곤지만 공부해요.',
        ),
        e(
          '비가 오지만 따뜻해요.',
          'Yomg‘ir yog‘moqda, lekin iliq.',
          '오지만',
          '비가 오으지만 따뜻해요.',
        ),
      ],
    ),
    spec(
      'S1A-07-02',
      [['습니다', '합니다', '옵니다', '갑니다', '봅니다', '붑니다']],
      [
        e('오늘은 바람이 붑니다.', 'Bugun shamol esadi.', '붑니다', '오늘은 바람이 불습니다.'),
        e(
          '저는 매일 공부합니다.',
          'Men har kuni o‘qiyman.',
          '공부합니다',
          '저는 매일 공부해습니다.',
        ),
        e('오늘 날씨가 좋습니다.', 'Bugun havo yaxshi.', '좋습니다', '오늘 날씨가 좋읍니다.'),
        e('지금 비가 옵니다.', 'Hozir yomg‘ir yog‘moqda.', '옵니다', '지금 비가 오습니다.'),
      ],
    ),
    spec(
      'S1A-07-03',
      [['고 ']],
      [
        e(
          '비가 오고 날씨가 추워요.',
          'Yomg‘ir yog‘moqda va havo sovuq.',
          '오고',
          '비가 오으고 날씨가 추워요.',
        ),
        e('하늘이 맑고 따뜻해요.', 'Osmon ochiq va havo iliq.', '맑고', '하늘이 맑으고 따뜻해요.'),
        e(
          '바람이 불고 비가 와요.',
          'Shamol esmoqda va yomg‘ir yog‘moqda.',
          '불고',
          '바람이 불으고 비가 와요.',
        ),
        e(
          '눈이 오고 길이 미끄러워요.',
          'Qor yog‘moqda va yo‘l sirpanchiq.',
          '오고',
          '눈이 오으고 길이 미끄러워요.',
        ),
      ],
    ),
    spec(
      'S1A-08-01',
      [['까요']],
      [
        e('같이 영화를 볼까요?', 'Birga film ko‘ramizmi?', '볼까요', '같이 영화를 보을까요?'),
        e('점심을 먹을까요?', 'Tushlik qilamizmi?', '먹을까요', '점심을 먹을을까요?'),
        e('주말에 만날까요?', 'Dam olish kuni uchrashamizmi?', '만날까요', '주말에 만나을까요?'),
        e('사진을 찍을까요?', 'Suratga tushamizmi?', '찍을까요', '사진을 찍을을까요?'),
      ],
    ),
    spec(
      'S1A-08-02',
      [['이 ', '그 ', '저 ']],
      [
        e('이 영화는 재미있어요.', 'Bu film qiziqarli.', '이 영화', '영화 이는 재미있어요.'),
        e('그 식당은 유명해요.', 'U restoran mashhur.', '그 식당', '식당 그는 유명해요.'),
        e(
          '저 사람은 제 선생님이에요.',
          'Anavi kishi mening o‘qituvchim.',
          '저 사람',
          '사람 저는 제 선생님이에요.',
        ),
        e(
          '이 책은 한국어 책이에요.',
          'Bu kitob koreys tili kitobi.',
          '이 책',
          '책 이는 한국어 책이에요.',
        ),
      ],
    ),
    spec(
      'S1A-08-03',
      [['네요']],
      [
        e(
          '오늘 날씨가 정말 좋네요.',
          'Bugun havo juda yaxshi ekan.',
          '좋네요',
          '오늘 날씨가 정말 좋아네요.',
        ),
        e(
          '음식이 아주 맛있네요.',
          'Ovqat juda mazali ekan.',
          '맛있네요',
          '음식이 아주 맛있어요네요.',
        ),
        e(
          '한국어를 잘하시네요.',
          'Koreys tilida yaxshi gapirar ekansiz.',
          '잘하시네요',
          '한국어를 잘하세요네요.',
        ),
        e('사람이 정말 많네요.', 'Odam juda ko‘p ekan.', '많네요', '사람이 정말 많아요네요.'),
      ],
    ),
  ].map((item) => [item.grammarId, item]),
);
