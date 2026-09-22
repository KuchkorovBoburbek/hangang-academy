"""Curate useful Korean lemmas; count ONLY their real official-source occurrences.

No proper names, place/animal names or one-off historical titles. Usage examples
are authored, not mislabelled source quotations. Frequencies are observations,
not predictions. A shared passage is counted once, not once per question.
"""
from pathlib import Path
import json,re,hashlib,collections
ROOT=Path(__file__).resolve().parents[1]

# Korean | Uzbek | part of speech | Korean usage | Uzbek usage | observed forms
WORDS='''
경험|tajriba|ot|다양한 경험이 도움이 된다.|Turli tajribalar foyda beradi.|
방법|usul; yo‘l|ot|문제를 해결할 방법을 찾고 있다.|Muammoni hal qilish yo‘lini izlayapman.|
문제|muammo; masala|ot|문제의 원인을 먼저 알아야 한다.|Avval muammoning sababini bilish kerak.|
원인|sabab|ot|사고의 원인을 조사했다.|Hodisaning sababini tekshirishdi.|
결과|natija|ot|노력한 결과 좋은 성적을 얻었다.|Mehnat natijasida yaxshi baho oldim.|
영향|ta’sir|ot|수면은 건강에 영향을 미친다.|Uyqu salomatlikka ta’sir qiladi.|
효과|samara; ta’sir|ot|이 방법은 효과가 크다.|Bu usulning samarasi katta.|
목적|maqsad|ot|이 행사의 목적은 환경 보호이다.|Bu tadbirning maqsadi atrof-muhitni muhofaza qilishdir.|
목표|erishiladigan maqsad|ot|올해 목표를 세웠다.|Bu yilgi maqsadni belgiladim.|
계획|reja|ot|여행 계획을 세우고 있다.|Sayohat rejasini tuzyapman.|
과정|jarayon|ot|결과보다 과정도 중요하다.|Natija bilan birga jarayon ham muhim.|
상황|vaziyat|ot|상황에 맞게 행동해야 한다.|Vaziyatga mos harakat qilish kerak.|
경우|holat; vaziyat|ot|비가 올 경우 행사를 취소한다.|Yomg‘ir yog‘sa, tadbir bekor qilinadi.|
조건|shart; sharoit|ot|지원 조건을 확인하세요.|Ariza topshirish shartlarini tekshiring.|
기회|imkoniyat|ot|배울 기회를 놓치지 마세요.|O‘rganish imkoniyatini qo‘ldan boy bermang.|
가능성|ehtimol; imkon|ot|성공할 가능성이 높다.|Muvaffaqiyatga erishish ehtimoli yuqori.|
필요|ehtiyoj; zarurat|ot|변화가 필요하다.|O‘zgarish kerak.|
관심|qiziqish; e’tibor|ot|환경 문제에 관심이 많다.|Atrof-muhit muammolariga qiziqishim katta.|
관계|munosabat; aloqa|ot|친구와 좋은 관계를 유지한다.|Do‘stim bilan yaxshi munosabatni saqlayman.|
이유|sabab|ot|신청한 이유를 적어 주세요.|Ariza berganingiz sababini yozing.|
차이|farq|ot|두 제품에는 차이가 있다.|Ikki mahsulot o‘rtasida farq bor.|
변화|o‘zgarish|ot|작은 변화부터 시작해 보자.|Kichik o‘zgarishdan boshlaylik.|
발전|rivojlanish|ot|기술의 발전은 생활을 바꾼다.|Texnologiya rivoji hayotni o‘zgartiradi.|
사회|jamiyat|ot|사회의 변화에 관심을 가지자.|Jamiyatdagi o‘zgarishlarga e’tibor beraylik.|
경제|iqtisodiyot|ot|지역 경제가 발전하고 있다.|Hudud iqtisodiyoti rivojlanyapti.|
문화|madaniyat|ot|다른 문화를 이해하는 것이 중요하다.|Boshqa madaniyatni tushunish muhim.|
환경|atrof-muhit; muhit|ot|환경을 보호하기 위해 노력한다.|Atrof-muhitni himoya qilishga harakat qilamiz.|
건강|salomatlik|ot|건강을 위해 매일 걷는다.|Salomatlik uchun har kuni piyoda yuraman.|
안전|xavfsizlik|ot|안전이 가장 중요하다.|Xavfsizlik eng muhimdir.|
위험|xavf|ot|위험을 미리 막아야 한다.|Xavfning oldini olish kerak.|
피해|zarar; talafot|ot|큰 피해를 입었다.|Katta zarar ko‘rildi.|
부담|yuk; og‘irlik|ot|비용에 대한 부담이 크다.|Xarajatlarning yuki katta.|
책임|mas’uliyat|ot|자신의 행동에 책임을 져야 한다.|O‘z harakati uchun mas’uliyatni olish kerak.|
노력|harakat; mehnat|ot|꾸준한 노력이 필요하다.|Muntazam mehnat kerak.|
능력|qobiliyat|ot|자신의 능력을 키워야 한다.|O‘z qobiliyatini rivojlantirish kerak.|
역할|vazifa; rol|ot|학교는 중요한 역할을 한다.|Maktab muhim vazifa bajaradi.|
기능|funksiya; vazifa|ot|이 기계에는 여러 기능이 있다.|Bu uskunada bir necha funksiya bor.|
가치|qadr; qiymat|ot|경험의 가치를 깨달았다.|Tajribaning qadrini angladim.|
의미|ma’no|ot|이 말의 의미를 설명해 주세요.|Bu gapning ma’nosini tushuntiring.|
특징|xususiyat|ot|제품의 특징을 비교했다.|Mahsulot xususiyatlarini solishtirdim.|
장점|afzallik|ot|이 방법의 장점을 알아보자.|Bu usulning afzalliklarini ko‘raylik.|
단점|kamchilik|ot|단점을 보완할 필요가 있다.|Kamchiliklarni tuzatish zarur.|
기준|mezon|ot|선택 기준을 정했다.|Tanlash mezonini belgiladim.|
방향|yo‘nalish|ot|앞으로의 방향을 정해야 한다.|Keyingi yo‘nalishni belgilash kerak.|
정도|daraja; miqdor|ot|어느 정도 이해할 수 있다.|Ma’lum darajada tushuna olaman.|
수준|daraja; saviya|ot|교육 수준이 높아졌다.|Ta’lim darajasi oshdi.|
상태|holat|ot|제품의 상태를 확인했다.|Mahsulot holatini tekshirdim.|
태도|munosabat; tutum|ot|긍정적인 태도가 중요하다.|Ijobiy munosabat muhim.|
습관|odat|ot|좋은 습관을 길러야 한다.|Yaxshi odatlarni shakllantirish kerak.|
행동|xatti-harakat|ot|말보다 행동이 중요하다.|Gapdan ko‘ra harakat muhim.|
생활|turmush; kundalik hayot|ot|규칙적인 생활을 하려고 한다.|Tartibli yashashga harakat qilaman.|
활동|faoliyat|ot|다양한 활동에 참여했다.|Turli faoliyatlarda qatnashdim.|
정보|ma’lumot|ot|정확한 정보를 찾아야 한다.|Aniq ma’lumot topish kerak.|
자료|material; ma’lumotlar|ot|발표에 필요한 자료를 모았다.|Taqdimot uchun zarur materiallarni yig‘dim.|
연구|tadqiqot|ot|새로운 연구 결과가 발표되었다.|Yangi tadqiqot natijalari e’lon qilindi.|
조사|tekshiruv; so‘rov|ot|설문 조사에 참여했다.|So‘rovnomada qatnashdim.|
분석|tahlil|ot|자료를 분석해서 원인을 찾았다.|Ma’lumotlarni tahlil qilib sababni topdim.|
기술|texnologiya; mahorat|ot|새로운 기술을 개발했다.|Yangi texnologiya yaratildi.|
교육|ta’lim|ot|교육의 기회를 넓혀야 한다.|Ta’lim imkoniyatlarini kengaytirish kerak.|
지식|bilim|ot|책을 통해 지식을 얻는다.|Kitob orqali bilim olinadi.|
이해|tushunish|ot|서로에 대한 이해가 필요하다.|Bir-birini tushunish zarur.|
의견|fikr; mulohaza|ot|다른 사람의 의견도 들어 보자.|Boshqalarning fikrini ham eshitaylik.|
생각|fikr; o‘y|ot|자신의 생각을 분명히 말했다.|O‘z fikrini aniq aytdi.|
판단|xulosa; hukm|ot|성급한 판단을 피해야 한다.|Shoshma-shosharlik bilan xulosa qilishdan saqlanish kerak.|
선택|tanlov|ot|신중한 선택이 필요하다.|Puxta o‘ylangan tanlov kerak.|
결정|qaror|ot|중요한 결정을 내렸다.|Muhim qaror qabul qildim.|
주장|fikrni ilgari surish; da’vo|ot|주장을 뒷받침할 근거가 필요하다.|Fikrni tasdiqlaydigan dalil kerak.|
근거|asos; dalil|ot|이 의견에는 분명한 근거가 있다.|Bu fikrning aniq asosi bor.|
증거|isbot; dalil|ot|주장을 증명할 증거를 찾았다.|Da’voni isbotlaydigan dalil topildi.|
정책|siyosat; chora-tadbir|ot|새로운 정책이 시행된다.|Yangi siyosat amalga oshiriladi.|
제도|tizim; tartib|ot|이 제도는 학생들을 지원한다.|Bu tizim o‘quvchilarni qo‘llab-quvvatlaydi.|
규칙|qoida|ot|모두가 규칙을 지켜야 한다.|Hamma qoidalarga rioya qilishi kerak.|
법|qonun|ot|법을 지키는 것은 중요하다.|Qonunga rioya qilish muhim.|
권리|huquq|ot|개인의 권리를 존중해야 한다.|Shaxs huquqlarini hurmat qilish kerak.|
의무|majburiyat|ot|권리에는 의무가 따른다.|Huquq bilan birga majburiyat ham keladi.|
자유|erkinlik|ot|표현의 자유를 존중한다.|Fikr bildirish erkinligini hurmat qilamiz.|
공동|birgalikdagi; umumiy|ot|공동의 목표를 위해 노력한다.|Umumiy maqsad uchun harakat qilamiz.|
개인|shaxs; yakka inson|ot|개인의 취향은 서로 다르다.|Odamlarning didi bir-biridan farq qiladi.|
기업|korxona|ot|기업은 새로운 제품을 만들었다.|Korxona yangi mahsulot ishlab chiqardi.|
정부|hukumat|ot|정부가 지원 방안을 발표했다.|Hukumat yordam choralarini e’lon qildi.|
지역|hudud|ot|지역 주민의 의견을 들었다.|Hudud aholisi fikri tinglandi.|
주민|yashovchi; aholi|ot|주민들이 행사에 참여했다.|Aholi tadbirda qatnashdi.|
소비자|iste’molchi|ot|소비자의 권리를 보호해야 한다.|Iste’molchi huquqlarini himoya qilish kerak.|
생산|ishlab chiqarish|ot|제품 생산이 늘었다.|Mahsulot ishlab chiqarish oshdi.|
소비|iste’mol; sarf|ot|불필요한 소비를 줄였다.|Keraksiz xarajatlarni kamaytirdim.|
시장|bozor|ot|시장의 변화를 살펴보았다.|Bozordagi o‘zgarishlarni kuzatdim.|
가격|narx|ot|가격이 작년보다 올랐다.|Narx o‘tgan yilga nisbatan oshdi.|
비용|xarajat|ot|비용을 줄일 방법을 찾았다.|Xarajatni kamaytirish yo‘li topildi.|
요금|xizmat haqi|ot|이용 요금을 확인하세요.|Foydalanish haqini tekshiring.|
무료|bepul|ot|입장료는 무료입니다.|Kirish bepul.|
할인|chegirma|ot|학생은 할인을 받을 수 있다.|O‘quvchilar chegirma olishi mumkin.|
구입|sotib olish|ot|표를 미리 구입했다.|Chiptani oldindan sotib oldim.|
구매|xarid|ot|온라인 구매가 늘고 있다.|Onlayn xaridlar ko‘paymoqda.|
판매|sotuv|ot|판매 시간이 정해져 있다.|Sotuv vaqti belgilangan.|
신청|ariza; buyurtma|ot|참가 신청은 오늘까지입니다.|Qatnashish uchun ariza bugungacha qabul qilinadi.|
예약|oldindan band qilish|ot|예약 없이 방문할 수 없다.|Oldindan band qilmay kelish mumkin emas.|
문의|so‘rov; murojaat|ot|궁금한 점은 전화로 문의하세요.|Savolingiz bo‘lsa, telefon orqali murojaat qiling.|
안내|yo‘l-yo‘riq; ma’lumot|ot|자세한 안내를 읽어 보세요.|Batafsil ma’lumotni o‘qing.|
이용|foydalanish|ot|이용 시간을 꼭 확인하세요.|Foydalanish vaqtini albatta tekshiring.|
참여|ishtirok|ot|누구나 참여할 수 있다.|Istagan odam qatnashishi mumkin.|
참가|qatnashish|ot|대회 참가를 신청했다.|Tanlovda qatnashish uchun ariza berdim.|
지원|qo‘llab-quvvatlash; ariza berish|ot|학생에게 학비를 지원한다.|Talabalarga o‘qish xarajati uchun yordam beriladi.|
대상|mo‘ljallangan guruh; obyekt|ot|이 강좌는 초보자를 대상으로 한다.|Bu kurs boshlovchilar uchun mo‘ljallangan.|
기간|muddat; davr|ot|신청 기간이 일주일 남았다.|Ariza muddati tugashiga bir hafta qoldi.|
시간|vaqt|ot|시간을 효율적으로 사용한다.|Vaqtdan unumli foydalanaman.|
장소|joy|ot|행사 장소가 변경되었다.|Tadbir joyi o‘zgartirildi.|
행사|tadbir|ot|주말에 문화 행사가 열린다.|Dam olish kuni madaniy tadbir bo‘ladi.|
상품|sotiladigan tovar|ot|상품을 비교한 후 구입했다.|Tovarlarni solishtirgach sotib oldim.|
제품|mahsulot|ot|새 제품의 기능을 소개했다.|Yangi mahsulot funksiyalari tanishtirildi.|
재료|xomashyo; masalliq|ot|필요한 재료를 준비했다.|Kerakli masalliqlarni tayyorladim.|
시설|inshoot; jihozlangan joy|ot|공공 시설을 깨끗하게 이용하자.|Jamoat inshootlaridan ozoda foydalanaylik.|
공간|makon; joy|ot|쉴 수 있는 공간이 필요하다.|Dam olish uchun joy kerak.|
서비스|xizmat|ot|서비스의 질이 좋아졌다.|Xizmat sifati yaxshilandi.|
교통|transport; qatnov|ot|교통이 편리한 곳에 산다.|Transporti qulay joyda yashayman.|
안내문|e’lon; yo‘riqnoma matni|ot|입구에 있는 안내문을 읽었다.|Kirishdagi yo‘riqnomani o‘qidim.|
주의|diqqat; ehtiyot|ot|사용할 때 주의가 필요하다.|Foydalanishda ehtiyot bo‘lish kerak.|
기억|xotira|ot|그날의 기억이 아직 생생하다.|O‘sha kun xotirasi hali ham yorqin.|
감정|hissiyot|ot|자신의 감정을 솔직하게 표현했다.|O‘z hissiyotini ochiq ifodaladi.|
마음|ko‘ngil; dil|ot|상대방의 마음을 이해하려고 한다.|Boshqa odamning ko‘nglini tushunishga harakat qilaman.|
기대|umid; kutish|ot|새로운 변화에 대한 기대가 크다.|Yangi o‘zgarishdan umid katta.|
걱정|tashvish|ot|걱정하지 말고 도전해 보세요.|Xavotir olmay urinib ko‘ring.|
만족|qoniqish|ot|결과에 만족한다.|Natijadan mamnunman.|
갈등|ziddiyat; kelishmovchilik|ot|대화를 통해 갈등을 해결했다.|Suhbat orqali kelishmovchilik hal qilindi.|
협력|hamkorlik|ot|문제를 해결하려면 협력이 필요하다.|Muammoni hal qilish uchun hamkorlik kerak.|
경쟁|raqobat|ot|기업 간 경쟁이 치열하다.|Korxonalar o‘rtasidagi raqobat kuchli.|
소통|muloqot|ot|서로 소통하는 시간이 필요하다.|Bir-biri bilan muloqot qilish uchun vaqt kerak.|
도움|yordam|ot|작은 도움이 큰 힘이 된다.|Kichik yordam katta kuch beradi.|
관찰|kuzatish|ot|변화를 자세히 관찰했다.|O‘zgarishni diqqat bilan kuzatdim.|
실험|tajriba; sinov|ot|실험을 통해 확인했다.|Tajriba orqali tasdiqlandi.|
통계|statistika|ot|통계 자료를 비교했다.|Statistik ma’lumotlar solishtirildi.|
비율|nisbat; ulush|ot|참가자의 비율이 증가했다.|Qatnashchilar ulushi oshdi.|
수요|talab|ot|친환경 제품의 수요가 늘었다.|Ekologik mahsulotlarga talab oshdi.|
공급|ta’minot; taklif|ot|수요에 비해 공급이 부족하다.|Talabga nisbatan taklif kam.|
자원|resurs; boylik|ot|한정된 자원을 아껴야 한다.|Cheklangan resurslarni tejash kerak.|
에너지|energiya|ot|에너지를 절약하는 습관이 중요하다.|Energiyani tejash odati muhim.|
오염|ifloslanish|ot|환경 오염을 줄여야 한다.|Atrof-muhit ifloslanishini kamaytirish kerak.|
보호|muhofaza; himoya|ot|개인 정보를 보호해야 한다.|Shaxsiy ma’lumotlarni himoya qilish kerak.|
보존|asrab saqlash|ot|옛 건물을 보존하고 있다.|Eski bino asrab saqlanmoqda.|
예방|oldini olish|ot|사고 예방을 위한 교육을 받았다.|Hodisalarning oldini olish bo‘yicha ta’lim oldim.|
대책|chora; yechim|ot|문제를 막을 대책이 필요하다.|Muammoni to‘xtatadigan chora kerak.|
한계|chegara; cheklangan imkon|ot|이 방법에도 한계가 있다.|Bu usulning ham imkoniyati cheklangan.|
규제|tartibga soluvchi cheklov|ot|안전을 위해 규제를 강화했다.|Xavfsizlik uchun cheklovlar kuchaytirildi.|
갈수록|borgan sari|ravish|갈수록 관심이 높아지고 있다.|Qiziqish borgan sari oshmoqda.|
점점|asta-sekin; tobora|ravish|날씨가 점점 추워진다.|Havo tobora soviyapti.|
꾸준히|muntazam; izchil|ravish|매일 꾸준히 연습한다.|Har kuni muntazam mashq qilaman.|
직접|bevosita; o‘zi|ravish|직접 확인해 보세요.|O‘zingiz tekshirib ko‘ring.|
스스로|o‘zi; mustaqil|ravish|스스로 문제를 해결했다.|Muammoni mustaqil hal qildim.|
오히려|aksincha|ravish|서두르면 오히려 실수가 늘어난다.|Shoshilsangiz, aksincha xatolar ko‘payadi.|
특히|ayniqsa|ravish|특히 이 점에 주의해야 한다.|Ayniqsa shu jihatga e’tibor berish kerak.|
일반적으로|odatda; umuman olganda|ravish|일반적으로 이런 방법을 사용한다.|Odatda bunday usuldan foydalaniladi.|
상대적으로|nisbatan|ravish|가격이 상대적으로 저렴하다.|Narxi nisbatan arzon.|
결국|oxir-oqibat|ravish|결국 노력한 만큼 결과를 얻었다.|Oxir-oqibat mehnatimga yarasha natija oldim.|
따라서|shuning uchun; demak|bog‘lovchi|비가 온다. 따라서 행사를 연기한다.|Yomg‘ir yog‘moqda. Shuning uchun tadbir kechiktiriladi.|
그러나|ammo; biroq|bog‘lovchi|방법은 쉽다. 그러나 시간이 걸린다.|Usul oson. Ammo vaqt ketadi.|
하지만|lekin|bog‘lovchi|가격은 비싸다. 하지만 품질이 좋다.|Narxi qimmat. Lekin sifati yaxshi.|
또한|shuningdek|bog‘lovchi|값이 싸다. 또한 사용하기 편하다.|Narxi arzon. Shuningdek, foydalanish qulay.|
그러므로|shu sababli|bog‘lovchi|자원은 한정되어 있다. 그러므로 아껴야 한다.|Resurslar cheklangan. Shu sababli ularni tejash kerak.|
반면|aksincha; boshqa tomondan|bog‘lovchi|가격은 낮다. 반면 품질은 높다.|Narxi past. Sifati esa yuqori.|
즉|ya’ni|bog‘lovchi|이번 주말, 즉 토요일과 일요일에 쉰다.|Bu hafta oxirida, ya’ni shanba va yakshanbada dam olamiz.|
게다가|ustiga-ustak|bog‘lovchi|맛도 좋고 게다가 가격도 싸다.|Mazasi yaxshi, ustiga-ustak narxi ham arzon.|
대신|o‘rniga|ravish|자동차 대신 버스를 이용했다.|Mashina o‘rniga avtobusdan foydalandim.|
중요하다|muhim bo‘lmoq|sifat|건강을 지키는 것이 중요하다.|Salomatlikni asrash muhim.|중요
필요하다|kerak bo‘lmoq|sifat|충분한 휴식이 필요하다.|Yetarli dam olish kerak.|필요하,필요한,필요해
다양하다|turli-tuman bo‘lmoq|sifat|다양한 의견을 들었다.|Turli fikrlarni eshitdim.|다양
적절하다|mos; o‘rinli bo‘lmoq|sifat|상황에 적절한 방법을 선택했다.|Vaziyatga mos usulni tanladim.|적절
긍정적|ijobiy|sifat|긍정적인 변화가 나타났다.|Ijobiy o‘zgarish yuz berdi.|
부정적|salbiy|sifat|부정적인 영향을 줄일 필요가 있다.|Salbiy ta’sirni kamaytirish zarur.|
효율적|samarali; unumli|sifat|시간을 효율적으로 활용했다.|Vaqtdan unumli foydalandim.|
합리적|oqilona; asosli|sifat|합리적인 결정을 내려야 한다.|Oqilona qaror qabul qilish kerak.|
구체적|aniq; konkret|sifat|구체적인 계획을 세웠다.|Aniq reja tuzdim.|
복잡하다|murakkab bo‘lmoq|sifat|절차가 너무 복잡하다.|Tartibi juda murakkab.|복잡
간단하다|sodda; oddiy bo‘lmoq|sifat|신청 방법은 간단하다.|Ariza berish usuli oddiy.|간단
정확하다|aniq; to‘g‘ri bo‘lmoq|sifat|정확한 정보를 전달해야 한다.|Aniq ma’lumot yetkazish kerak.|정확
분명하다|aniq; ravshan bo‘lmoq|sifat|목표가 분명해야 한다.|Maqsad aniq bo‘lishi kerak.|분명
충분하다|yetarli bo‘lmoq|sifat|생각할 시간이 충분하다.|O‘ylash uchun vaqt yetarli.|충분
부족하다|yetishmaslik|sifat|연습 시간이 부족하다.|Mashq uchun vaqt yetishmaydi.|부족
불편하다|noqulay bo‘lmoq|sifat|교통이 불편해서 이사했다.|Qatnov noqulayligi sabab ko‘chdim.|불편
편리하다|qulay bo‘lmoq|sifat|인터넷으로 신청하면 편리하다.|Internet orqali ariza berish qulay.|편리
저렴하다|arzon bo‘lmoq|sifat|가격이 저렴해서 인기가 많다.|Narxi arzonligi uchun ommabop.|저렴
심각하다|jiddiy; og‘ir bo‘lmoq|sifat|환경 문제가 심각하다.|Atrof-muhit muammosi jiddiy.|심각
자연스럽다|tabiiy bo‘lmoq|sifat|연습하면 자연스럽게 말할 수 있다.|Mashq qilsangiz tabiiy gapira olasiz.|자연스러,자연스럽
해결하다|hal qilmoq|fe’l|대화로 문제를 해결했다.|Muammoni suhbat orqali hal qildim.|해결
확인하다|tekshirmoq; tasdiqlamoq|fe’l|신청 내용을 확인했다.|Ariza mazmunini tekshirdim.|확인
비교하다|solishtirmoq|fe’l|두 자료를 비교했다.|Ikki ma’lumotni solishtirdim.|비교
설명하다|tushuntirmoq|fe’l|이유를 자세히 설명했다.|Sababini batafsil tushuntirdim.|설명
표현하다|ifodalamoq|fe’l|생각을 글로 표현했다.|Fikrimni yozma ifodaladim.|표현
전달하다|yetkazmoq|fe’l|중요한 정보를 전달했다.|Muhim ma’lumotni yetkazdim.|전달
제공하다|taqdim etmoq|fe’l|필요한 자료를 제공한다.|Kerakli materiallar taqdim etiladi.|제공
발생하다|yuz bermoq|fe’l|예상하지 못한 문제가 발생했다.|Kutilmagan muammo yuz berdi.|발생
증가하다|ortmoq; ko‘paymoq|fe’l|이용자 수가 증가했다.|Foydalanuvchilar soni oshdi.|증가
감소하다|kamaymoq|fe’l|사고 발생률이 감소했다.|Hodisalar soni kamaydi.|감소
유지하다|saqlab turmoq|fe’l|좋은 관계를 유지하고 있다.|Yaxshi munosabat saqlanmoqda.|유지
개선하다|yaxshilamoq|fe’l|근무 환경을 개선했다.|Ish sharoitini yaxshiladilar.|개선
개발하다|ishlab chiqmoq; yaratmoq|fe’l|새로운 기술을 개발했다.|Yangi texnologiya ishlab chiqildi.|개발
활용하다|foydalanmoq; qo‘llamoq|fe’l|배운 지식을 활용했다.|O‘rgangan bilimimni qo‘lladim.|활용
도입하다|joriy qilmoq|fe’l|새로운 제도를 도입했다.|Yangi tizim joriy qilindi.|도입
시행하다|amalga oshirmoq|fe’l|다음 달부터 정책을 시행한다.|Kelasi oydan siyosat amalga oshiriladi.|시행
실시하다|o‘tkazmoq; bajarmoq|fe’l|설문 조사를 실시했다.|So‘rov o‘tkazildi.|실시
운영하다|boshqarmoq; yuritmoq|fe’l|작은 가게를 운영한다.|Kichik do‘kon yuritaman.|운영
방지하다|oldini olmoq|fe’l|사고를 방지하기 위해 점검한다.|Hodisalarning oldini olish uchun tekshiriladi.|방지
극복하다|yengib o‘tmoq|fe’l|어려움을 극복했다.|Qiyinchilikni yengib o‘tdim.|극복
강조하다|ta’kidlamoq|fe’l|안전의 중요성을 강조했다.|Xavfsizlikning muhimligi ta’kidlandi.|강조
요구하다|talab qilmoq|fe’l|소비자들이 개선을 요구했다.|Iste’molchilar yaxshilashni talab qildi.|요구
제한하다|cheklamoq|fe’l|이용 시간을 제한한다.|Foydalanish vaqtini cheklashadi.|제한
절약하다|tejamoq|fe’l|물을 절약해야 한다.|Suvni tejash kerak.|절약
모집하다|qabul qilmoq; to‘plamoq|fe’l|참가자를 모집하고 있다.|Qatnashchilar qabul qilinmoqda.|모집
제출하다|topshirmoq|fe’l|서류를 기한 안에 제출했다.|Hujjatlarni muddatida topshirdim.|제출
구성하다|tuzmoq; tashkil etmoq|fe’l|세 부분으로 구성되어 있다.|Uch qismdan tashkil topgan.|구성
집중하다|diqqatni jamlamoq|fe’l|공부에 집중하기 어렵다.|O‘qishga diqqatni jamlash qiyin.|집중
발견하다|topmoq; kashf etmoq|fe’l|새로운 사실을 발견했다.|Yangi fakt aniqlandi.|발견
인식하다|anglamoq; tanimoq|fe’l|문제의 심각성을 인식했다.|Muammoning jiddiyligini angladim.|인식
보완하다|to‘ldirmoq; kamchilikni tuzatmoq|fe’l|부족한 부분을 보완했다.|Yetishmagan qismlarni to‘ldirdim.|보완
적용하다|tatbiq qilmoq|fe’l|같은 기준을 적용한다.|Bir xil mezon qo‘llanadi.|적용
형성하다|shakllantirmoq|fe’l|좋은 습관을 형성해야 한다.|Yaxshi odat shakllantirish kerak.|형성
촉진하다|jadallashtirmoq; rag‘batlantirmoq|fe’l|경제 발전을 촉진한다.|Iqtisodiy rivojlanishni jadallashtiradi.|촉진
존중하다|hurmat qilmoq|fe’l|서로의 의견을 존중한다.|Bir-birimizning fikrimizni hurmat qilamiz.|존중
인정하다|tan olmoq|fe’l|자신의 실수를 인정했다.|O‘z xatosini tan oldim.|인정
우려하다|xavotir bildirmoq|fe’l|부작용을 우려하는 목소리가 있다.|Nojo‘ya ta’sirdan xavotir bildirayotganlar bor.|우려
설득하다|ishontirmoq|fe’l|자료를 보여 주며 상대를 설득했다.|Ma’lumot ko‘rsatib suhbatdoshimni ishontirdim.|설득
기여하다|hissa qo‘shmoq|fe’l|지역 발전에 기여하고 있다.|Hudud rivojiga hissa qo‘shmoqda.|기여
나타나다|paydo bo‘lmoq; ko‘rinmoq|fe’l|연습의 효과가 나타났다.|Mashq samarasi ko‘rindi.|나타나,나타났,나타날,나타난
늘어나다|ko‘paymoq|fe’l|참가자가 계속 늘어나고 있다.|Qatnashchilar ko‘payib bormoqda.|늘어나,늘어났,늘어난,늘어날
줄이다|kamaytirmoq|fe’l|불필요한 지출을 줄였다.|Keraksiz xarajatlarni kamaytirdim.|줄이,줄여,줄였,줄일,줄인
줄어들다|kamayib bormoq|fe’l|사고가 점점 줄어들고 있다.|Hodisalar tobora kamaymoqda.|줄어들,줄어든,줄어드
높이다|oshirmoq; ko‘tarmoq|fe’l|서비스의 질을 높였다.|Xizmat sifatini oshirdilar.|높이,높여,높였,높일,높인
낮추다|pasaytirmoq|fe’l|비용을 낮출 방법을 찾았다.|Xarajatni pasaytirish yo‘lini topdim.|낮추,낮춰,낮췄,낮출,낮춘
막다|to‘smoq; oldini olmoq|fe’l|사고를 막기 위해 노력한다.|Hodisalarning oldini olishga harakat qilamiz.|막기,막는,막을,막아
지키다|rioya qilmoq; asramoq|fe’l|약속을 지켜야 한다.|Va’daga rioya qilish kerak.|지키,지켜,지켰,지킬,지킨
얻다|olmoq; erishmoq|fe’l|새로운 지식을 얻었다.|Yangi bilim oldim.|얻는,얻을,얻었,얻어,얻기
잃다|yo‘qotmoq|fe’l|중요한 기회를 잃었다.|Muhim imkoniyatni yo‘qotdim.|잃는,잃을,잃었,잃어,잃기
깨닫다|anglab yetmoq|fe’l|연습의 중요성을 깨달았다.|Mashqning muhimligini angladim.|깨닫,깨달
바꾸다|o‘zgartirmoq; almashtirmoq|fe’l|생각을 바꾸게 되었다.|Fikrimni o‘zgartirdim.|바꾸,바꿔,바꿨,바꿀,바꾼
달라지다|o‘zgarmoq; farqlanmoq|fe’l|조건에 따라 결과가 달라진다.|Sharoitga qarab natija o‘zgaradi.|달라지,달라진,달라졌,달라질
살펴보다|ko‘rib chiqmoq; sinchiklab qaramoq|fe’l|내용을 자세히 살펴보았다.|Mazmunni batafsil ko‘rib chiqdim.|살펴보,살펴봤,살펴볼,살펴본
알아보다|aniqlamoq; bilib olmoq|fe’l|자세한 내용을 알아보았다.|Batafsil ma’lumotni bilib oldim.|알아보,알아봤,알아볼,알아본
받아들이다|qabul qilmoq|fe’l|다른 의견을 받아들였다.|Boshqa fikrni qabul qildim.|받아들이,받아들여,받아들였,받아들일,받아들인
이어지다|davom etmoq; olib kelmoq|fe’l|작은 변화가 큰 발전으로 이어졌다.|Kichik o‘zgarish katta rivojlanishga olib keldi.|이어지,이어진,이어졌,이어질
어울리다|mos kelmoq; yarashmoq|fe’l|이 색은 방에 잘 어울린다.|Bu rang xonaga yaxshi mos keladi.|어울리,어울려,어울린,어울릴
''' 

CORE_WORDS='''
약속|va’da; kelishilgan uchrashuv|ot|친구와 약속이 있어서 일찍 나왔다.|Do‘stim bilan uchrashuvim borligi uchun erta chiqdim.|
실력|mahorat; bilim darajasi|ot|매일 연습해서 실력이 늘었다.|Har kuni mashq qilib mahoratim oshdi.|
연습|mashq|ot|발음 연습을 꾸준히 한다.|Talaffuzni muntazam mashq qilaman.|
도서관|kutubxona|ot|도서관에서 책을 빌렸다.|Kutubxonadan kitob oldim.|
방학|ta’til|ot|방학 동안 새로운 것을 배웠다.|Ta’tilda yangi narsa o‘rgandim.|
공연|tomosha; sahna chiqishi|ot|공연을 보고 감동을 받았다.|Tomoshani ko‘rib ta’sirlandim.|
동료|hamkasb|ot|동료와 함께 문제를 해결했다.|Hamkasbim bilan muammoni hal qildim.|
직장|ish joyi|ot|직장과 집이 가깝다.|Ish joyim uyimga yaqin.|
가족|oila|ot|주말에는 가족과 시간을 보낸다.|Dam olish kunlari oilam bilan vaqt o‘tkazaman.|
이웃|qo‘shni; yon-atrofdagi odam|ot|어려운 이웃을 돕고 있다.|Qiynalgan qo‘shnilarga yordam beryapmiz.|
후배|kichik kursdagi yoki keyin kelgan hamkasb|ot|후배에게 공부 방법을 알려 주었다.|Kichik kursdagi tanishimga o‘qish usulini aytdim.|
분위기|muhit; kayfiyat|ot|방의 분위기가 밝아졌다.|Xonaning muhiti yorishdi.|
회의|yig‘ilish|ot|회의가 예상보다 길어졌다.|Yig‘ilish kutilgandan cho‘zildi.|
수업|dars|ot|수업에 늦지 않으려고 서둘렀다.|Darsga kech qolmaslik uchun shoshildim.|
시험|imtihon|ot|시험을 앞두고 복습했다.|Imtihon oldidan takrorladim.|
졸업하다|bitirmoq|fe’l|대학교를 졸업하고 취직했다.|Universitetni bitirib ishga kirdim.|졸업
취직하다|ishga joylashmoq|fe’l|원하던 회사에 취직했다.|Istagan korxonamga ishga kirdim.|취직
이사하다|ko‘chib o‘tmoq|fe’l|학교 근처로 이사했다.|Maktab yaqiniga ko‘chdim.|이사
출발하다|yo‘lga chiqmoq|fe’l|늦지 않게 일찍 출발했다.|Kech qolmaslik uchun erta yo‘lga chiqdim.|출발
도착하다|yetib kelmoq|fe’l|약속 장소에 먼저 도착했다.|Uchrashuv joyiga avval yetib keldim.|도착
예상하다|oldindan taxmin qilmoq|fe’l|예상한 것보다 사람이 많았다.|Kutilgandan ko‘proq odam bor edi.|예상
준비하다|tayyorlamoq|fe’l|필요한 서류를 미리 준비했다.|Kerakli hujjatlarni oldindan tayyorladim.|준비
수리하다|ta’mirlamoq|fe’l|고장 난 컴퓨터를 수리했다.|Buzilgan kompyuterni ta’mirladim.|수리
감동적이다|ta’sirli bo‘lmoq|sifat|그의 이야기는 감동적이었다.|Uning hikoyasi ta’sirli edi.|감동
조용하다|tinch; jim bo‘lmoq|sifat|도서관에서는 조용히 해야 한다.|Kutubxonada jim bo‘lish kerak.|조용
따뜻하다|iliq; samimiy bo‘lmoq|sifat|따뜻한 말 한마디가 힘이 되었다.|Bir og‘iz iliq so‘z kuch berdi.|따뜻
비슷하다|o‘xshash bo‘lmoq|sifat|두 제품의 가격이 비슷하다.|Ikki mahsulot narxi o‘xshash.|비슷
그립다|sog‘inmoq|sifat|멀리 사는 가족이 그립다.|Uzoqda yashaydigan oilamni sog‘indim.|그립,그리워,그리운
바쁘다|band bo‘lmoq|sifat|요즘 일이 많아서 바쁘다.|Bu kunlarda ishim ko‘p, bandman.|바쁘,바빴,바빠,바쁜
일찍|erta|ravish|오늘은 평소보다 일찍 일어났다.|Bugun odatdagidan erta turdim.|
미리|oldindan|ravish|표를 미리 예매했다.|Chiptani oldindan band qildim.|
잘못|xato; noto‘g‘ri|ravish|버스를 잘못 타서 돌아왔다.|Noto‘g‘ri avtobusga chiqib qaytib keldim.|
자주|tez-tez|ravish|모르는 단어를 자주 복습한다.|Bilmagan so‘zlarimni tez-tez takrorlayman.|
열심히|astoydil|ravish|매일 열심히 공부한다.|Har kuni astoydil o‘qiyman.|
오랫동안|uzoq vaqt|ravish|오랫동안 기다린 소식이 왔다.|Uzoq kutilgan xabar keldi.|
서두르다|shoshilmoq|fe’l|늦을까 봐 서둘렀다.|Kech qolishdan xavotirlanib shoshildim.|서두르,서둘러,서둘렀
일어나다|turmoq; yuz bermoq|fe’l|아침에 일찍 일어났다.|Ertalab erta turdim.|일어나,일어났,일어난,일어날
지나치다|o‘tib ketmoq; haddan oshmoq|fe’l|내려야 할 역을 지나쳤다.|Tushishim kerak bo‘lgan bekatdan o‘tib ketdim.|지나치,지나쳐,지나쳤,지나친
놓치다|o‘tkazib yubormoq; boy bermoq|fe’l|늦게 일어나서 기차를 놓쳤다.|Kech turib poyezdga ulgurmadim.|놓치,놓쳐,놓쳤,놓친,놓칠
미루다|keyinga surmoq|fe’l|회의 시간을 다음 날로 미뤘다.|Yig‘ilish vaqtini keyingi kunga surdim.|미루,미뤄,미뤘,미룰,미룬
꾸미다|bezamoq|fe’l|방을 밝은 색으로 꾸몄다.|Xonani yorqin rangda bezadim.|꾸미,꾸며,꾸몄,꾸밀,꾸민
쌓다|to‘plamoq; taxlamoq|fe’l|책을 읽으면서 지식을 쌓는다.|Kitob o‘qib bilim to‘playman.|쌓는,쌓을,쌓아,쌓았,쌓기
돕다|yordam bermoq|fe’l|어려운 이웃을 돕고 싶다.|Qiynalgan odamlarga yordam bermoqchiman.|돕고,돕는,돕기,돕지,도와,도울
늘리다|oshirmoq; kengaytirmoq|fe’l|독서 시간을 조금씩 늘렸다.|Kitob o‘qish vaqtini asta oshirdim.|늘리,늘려,늘렸,늘릴,늘린
따르다|ergashmoq; rioya qilmoq|fe’l|안내에 따라 신청서를 작성했다.|Yo‘riqnomaga ko‘ra arizani to‘ldirdim.|따르,따라,따른,따를
늦다|kech qolmoq; kech bo‘lmoq|fe’l|길이 막혀서 수업에 늦었다.|Tirbandlik sabab darsga kech qoldim.|늦어,늦었,늦지,늦을,늦게
바라다|istamoq; umid qilmoq|fe’l|좋은 결과가 있기를 바란다.|Yaxshi natija bo‘lishini umid qilaman.|바라,바란,바랄
맡다|zimmasiga olmoq|fe’l|이번 행사의 진행을 맡았다.|Bu safar tadbirni olib borishni zimmamga oldim.|맡아,맡았,맡은,맡는,맡을
불리하다|noqulay; manfaatga zid bo‘lmoq|sifat|경험이 없으면 불리할 수 있다.|Tajribasizlik noqulaylik tug‘dirishi mumkin.|불리
유리하다|qulay; foydali bo‘lmoq|sifat|미리 준비하면 유리하다.|Oldindan tayyorlanish foydali.|유리하,유리한,유리할
필수|majburiy; zarur|ot|안전 교육은 필수이다.|Xavfsizlik bo‘yicha ta’lim majburiy.|
관점|nuqtayi nazar|ot|다른 관점에서 생각해 보자.|Boshqa nuqtayi nazardan o‘ylab ko‘raylik.|
측면|jihat; tomon|ot|긍정적인 측면도 있다.|Ijobiy jihati ham bor.|
부작용|nojo‘ya ta’sir|ot|예상하지 못한 부작용이 나타났다.|Kutilmagan nojo‘ya ta’sir yuz berdi.|
취향|did; yoqtirish|ot|사람마다 취향이 다르다.|Har kimning didi har xil.|
수고|mehnat; zahmat|ot|여러분의 수고 덕분에 성공했다.|Sizlarning mehnatingiz bilan muvaffaqiyatga erishdik.|
'''

IDIOMS='''
골치가 아프다|bosh qotmoq; tashvishga tushmoq|관용표현|해결할 일이 많아서 골치가 아프다.|Hal qiladigan ishlar ko‘pligidan boshim qotgan.|골치
콧대가 높다|dimog‘i baland bo‘lmoq|관용표현|그는 칭찬을 받으면 콧대가 높아진다.|Maqtov eshitsa, uning dimog‘i ko‘tariladi.|콧대
눈치가 빠르다|vaziyatni tez ilg‘amoq|관용표현|눈치가 빨라서 분위기를 금방 알아챘다.|Ziyrakligi sabab muhitni darrov ilg‘adi.|눈치만 빨,눈치가 빨
비행기를 태우다|ortiqcha maqtamoq|관용표현|너무 비행기를 태우지 마세요.|Meni haddan tashqari maqtamang.|비행기만 태,비행기를 태
입 밖에 내다|tilga olmoq; aytib yubormoq|관용표현|그 비밀은 입 밖에 내지 마세요.|U sirni tilga olmang.|입 밖
눈감아 주다|bilib turib kechirmoq|관용표현|이번 실수는 눈감아 주세요.|Bu safargi xatoni kechiring.|눈 감아 주,눈감아 주
한술 더 뜨다|undan ham oshirib yubormoq|관용표현|동생은 한술 더 떠서 더 비싼 것을 골랐다.|Ukam bundan ham o‘tib, yanada qimmatini tanladi.|한 술 더,한술 더
귓등으로 듣다|gapni e’tiborsiz tinglamoq|관용표현|충고를 귓등으로 듣지 마세요.|Maslahatga beparvo bo‘lmang.|귓등
담을 쌓다|aloqani uzmoq; chetlashmoq|관용표현|시험이 끝나고 책과 담을 쌓았다.|Imtihondan so‘ng kitobdan butunlay uzoqlashdim.|담을 쌓
못을 박다|qat’iy aytmoq|관용표현|다시는 하지 않겠다고 못을 박았다.|Boshqa bunday qilmasligini qat’iy aytdi.|못을 박
머리를 맞대다|birgalashib o‘ylamoq|관용표현|문제를 풀려고 모두 머리를 맞댔다.|Muammoni hal qilish uchun hamma birga bosh qotirdi.|머리를 맞대,머리를 맞댔
고개를 숙이다|bosh egmoq; uzr bildirmoq|관용표현|실수를 인정하고 고개를 숙였다.|Xatosini tan olib bosh egdi.|고개를 숙
앞뒤를 재다|har tomonini o‘ylab ko‘rmoq|관용표현|큰 결정을 내리기 전에 앞뒤를 재야 한다.|Muhim qarordan oldin har tomonini o‘ylash kerak.|앞뒤를 재
발을 빼다|o‘zini chetga olmoq|관용표현|어려워졌다고 일에서 발을 빼면 안 된다.|Qiyinlashdi deb ishdan o‘zini chetga olish mumkin emas.|발을 빼
발걸음을 맞추다|hamqadam bo‘lmoq; moslashmoq|관용표현|시대의 변화에 발걸음을 맞추어야 한다.|Zamon o‘zgarishi bilan hamqadam bo‘lish kerak.|발걸음을 맞
앞뒤를 가리지 않다|oqibatini o‘ylamaslik|관용표현|앞뒤를 가리지 않고 행동하면 위험하다.|Oqibatini o‘ylamay harakat qilish xavfli.|앞뒤를 가리지
손을 떼다|ishni tashlamoq; qo‘lini uzmoq|관용표현|그는 그 사업에서 손을 뗐다.|U o‘sha biznesdan chiqdi.|손을 뗀,손을 떼,손을 뗐
이를 갈다|ichida qattiq g‘azablanmoq|관용표현|억울한 일을 당한 그는 이를 갈았다.|Nohaqlikka uchragan u ichida qattiq g‘azablandi.|이를 간,이를 갈
열을 올리다|jon-jahdi bilan kirishmoq|관용표현|모두가 신제품 개발에 열을 올리고 있다.|Hamma yangi mahsulot yaratishga jon-jahdi bilan kirishgan.|열을 올
진땀을 흘리다|qiyin vaziyatda terga tushmoq|관용표현|어려운 질문에 답하느라 진땀을 흘렸다.|Qiyin savolga javob berib terga tushdim.|진땀
발목을 잡다|to‘sqinlik qilmoq|관용표현|자금 부족이 사업의 발목을 잡았다.|Mablag‘ yetishmasligi biznesga to‘sqinlik qildi.|발목
귀를 기울이다|diqqat bilan quloq solmoq|관용표현|상대방의 말에 귀를 기울여야 한다.|Suhbatdoshning gapiga diqqat bilan quloq solish kerak.|귀를 기울
등을 떠밀다|majburlamoq; undamoq|관용표현|친구들이 등을 떠밀어 대회에 나갔다.|Do‘stlarimning undashi bilan tanlovda qatnashdim.|등 떠밀,등을 떠밀
눈을 맞추다|ko‘zlariga qaramoq|관용표현|아이와 눈을 맞추고 이야기했다.|Bolaning ko‘ziga qarab gaplashdim.|눈을 맞
발 벗고 나서다|yeng shimarib yordamga kirishmoq|관용표현|이웃들이 발 벗고 나서서 도왔다.|Qo‘shnilar yeng shimarib yordamga kirishdi.|발 벗고
손에 땀을 쥐다|hayajon bilan kuzatmoq|관용표현|손에 땀을 쥐고 경기를 보았다.|O‘yinni hayajon bilan kuzatdim.|손에 땀
입맛에 맞다|didiga mos kelmoq|관용표현|모든 사람의 입맛에 맞는 작품은 드물다.|Hammaning didiga mos asar kam.|입맛에 맞
가슴을 울리다|qalbini larzaga solmoq|관용표현|그 이야기는 많은 사람의 가슴을 울렸다.|O‘sha hikoya ko‘plarning qalbini larzaga soldi.|가슴을 울
손을 맞잡다|hamkorlik qilmoq; qo‘lni qo‘lga bermoq|관용표현|두 회사가 손을 맞잡고 연구를 시작했다.|Ikki korxona hamkorlik qilib tadqiqotni boshladi.|손을 맞잡
눈을 딱 감다|ikkilanishni yig‘ishtirib tavakkal qilmoq|관용표현|눈을 딱 감고 새로운 일에 도전했다.|Ikkilanishni yig‘ishtirib, yangi ishga qo‘l urdim.|눈을 딱 감
목에 힘을 주다|o‘zini katta tutmoq|관용표현|승진했다고 목에 힘을 주면 안 된다.|Lavozimingiz oshdi deb o‘zingizni katta tutmang.|목에 힘
목이 빠지게 기다리다|intizor bo‘lib kutmoq|관용표현|친구의 소식을 목이 빠지게 기다렸다.|Do‘stimdan xabarni intizor kutdim.|목이 빠지
한숨을 돌리다|bir nafas rostlamoq|관용표현|일을 마치고 한숨을 돌렸다.|Ishni tugatib bir nafas rostladim.|한숨을 돌
눈살을 찌푸리다|qoshini chimirmoq; norozilik bildirmoq|관용표현|무례한 행동에 사람들이 눈살을 찌푸렸다.|Odobsiz harakatdan odamlar qoshini chimirdi.|눈살
코가 납작해지다|shashti qaytmoq; mulzam bo‘lmoq|관용표현|실력을 자랑하다가 패해서 코가 납작해졌다.|Mahoratini maqtadi-yu, yutqazib mulzam bo‘ldi.|코가 납작
하나를 보면 열을 안다|bir xatti-harakatidan qolganini bilsa bo‘ladi|속담|작은 약속도 잘 지키니 하나를 보면 열을 안다.|Kichik va’daga ham rioya qiladi: bir ishidan qolganini bilsa bo‘ladi.|하나를 보면
천 리 길도 한 걸음부터|katta ish ham kichik qadamdan boshlanadi|속담|천 리 길도 한 걸음부터이니 오늘 시작하자.|Katta ish ham bir qadamdan boshlanadi, bugun boshlaylik.|천리 길,천 리 길
소 잃고 외양간 고친다|zarar ko‘rgandan keyin chora ko‘rmoq|속담|미리 대비하지 않으면 소 잃고 외양간 고치는 셈이다.|Oldindan tayyorlanmasak, zarar ko‘rgandan keyin chora ko‘rgan bo‘lamiz.|소 잃고
윗물이 맑아야 아랫물이 맑다|rahbar yaxshi bo‘lsa, ergashuvchilar ham yaxshi bo‘ladi|속담|윗물이 맑아야 아랫물이 맑으니 어른이 모범을 보여야 한다.|Kattalar yaxshi o‘rnak ko‘rsatishi kerak.|윗물이 맑
제 눈의 안경|har kimning o‘z didi bor|속담|제 눈의 안경이라더니 친구는 그 그림을 좋아한다.|Har kimning didi har xil: do‘stim o‘sha rasmni yoqtiradi.|제 눈의 안경
엎질러진 물|ortga qaytarib bo‘lmaydigan ish|관용표현|이미 엎질러진 물이니 해결책을 찾자.|Ishni ortga qaytarib bo‘lmaydi, endi yechim izlaylik.|엎질러진 물
싼 게 비지떡|arzonning sifati ham shunga yarasha|속담|금방 고장 나니 싼 게 비지떡이다.|Tez buzildi: arzonning sifati ham shunga yarasha ekan.|싼게 비지떡,싼 게 비지떡
티끌 모아 태산|oz-ozdan yig‘ilsa, ko‘p bo‘ladi|속담|티끌 모아 태산이니 매달 조금씩 저축한다.|Oz-ozdan ko‘p bo‘ladi deb har oy biroz tejayman.|티끌 모아
'''

def build():
 groups=json.loads((ROOT/'content/topik/official-groups.json').read_text())
 documents=[]
 for g in groups:
  if any(q.get('withheld') for q in g['questions']):continue
  # Use passage once. Image alt is the same OCR text, not a second occurrence.
  text=g['passage']+' '+ ' '.join(q['prompt']+' '+' '.join(q['options']) for q in g['questions'])
  text=re.sub('<[^>]+>','',text)
  documents.append((g,re.sub(r'\s+',' ',text)))
 entries=[]
 for kind,tsv in [('word',WORDS+CORE_WORDS),('idiom',IDIOMS)]:
  for line in tsv.strip().splitlines():
   if not line.strip():continue
   ko,uz,pos,example,translation,aliases=line.split('|')
   forms=[x.strip() for x in (aliases or ko).split(',') if x.strip()]
   # Longest alternatives first avoids overlapping inflection double-counting.
   pattern=re.compile('|'.join(re.escape(f) for f in sorted(forms,key=len,reverse=True)))
   if ko=='법':
    # Count the noun meaning "law", never the unrelated 방법/문법 or ~는 법.
    pattern=re.compile(r'(?<![가-힣])법(?=을|이|은|과|에|의|도|만|으로|적|\s|[.,!?]|$)')
   counts=collections.Counter();source_ids=set();bycat={}
   for g,text in documents:
    if ko=='법':text=re.sub(r'[는은을] 법(?=\s|이|을|은|에|도|이다)', '', text)
    frequency=len(pattern.findall(text))
    if not frequency:continue
    counts[g['category']]+=frequency
    ids=[q['id'] for q in g['questions']]
    source_ids.update(ids);bycat.setdefault(g['category'],[]).extend(ids)
   if not counts:continue
   entries.append({'id':'topik-'+kind+'-'+hashlib.sha256(ko.encode()).hexdigest()[:12],
     'ko':ko,'uz':uz,'pos':pos,'example':example,'translation':translation,
     'categories':sorted(counts,key=lambda c:int(c.split('-')[0])),
     'sourceQuestionIds':sorted(source_ids),'frequency':sum(counts.values()),
     'categoryFrequencies':dict(counts),'categoryQuestionIds':bycat,'kind':kind})
 entries.sort(key=lambda e:(e['kind'],-e['frequency'],e['ko']))
 (ROOT/'content/topik/vocabulary.json').write_text(json.dumps(entries,ensure_ascii=False,indent=2)+'\n')
 coverage=collections.Counter(c for e in entries if e['kind']=='word' for c in e['categories'])
 print(json.dumps({'entries':len(entries),'kinds':dict(collections.Counter(e['kind'] for e in entries)),'categoryCoverage':dict(coverage)},ensure_ascii=False,indent=2))

if __name__=='__main__':build()
