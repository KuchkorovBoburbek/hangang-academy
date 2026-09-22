# Initial content authoring helper. Do not rerun over reviewed content/questions.json.
import json,random
from pathlib import Path
root=Path(__file__).resolve().parents[1]/'content'
raw='''약속|va’da; uchrashuv kelishuvi|Kundalik hayot|내일 친구와 약속이 있어요.|Ertaga do‘stim bilan uchrashuvim bor.
준비하다|tayyorlamoq|O‘qish va ish|시험을 준비하고 있어요.|Imtihonga tayyorlanyapman.
복습하다|takrorlamoq|O‘qish va ish|수업 후에 꼭 복습해요.|Darsdan keyin albatta takrorlayman.
신청하다|ariza bermoq|O‘qish va ish|한국어 수업을 신청했어요.|Koreys tili darsiga yozildim.
기회|imkoniyat|O‘qish va ish|좋은 기회를 놓치지 마세요.|Yaxshi imkoniyatni qo‘ldan boy bermang.
경험|tajriba|O‘qish va ish|다양한 경험이 도움이 돼요.|Turli tajribalar yordam beradi.
습관|odat|Kundalik hayot|일찍 일어나는 습관이 있어요.|Erta turish odatim bor.
건강|salomatlik|Kundalik hayot|건강을 위해 운동해요.|Salomatlik uchun mashq qilaman.
노력하다|harakat qilmoq|O‘qish va ish|목표를 위해 노력해요.|Maqsadim uchun harakat qilaman.
결과|natija|O‘qish va ish|시험 결과가 나왔어요.|Imtihon natijasi chiqdi.
발음|talaffuz|O‘qish va ish|매일 발음을 연습해요.|Har kuni talaffuzni mashq qilaman.
실수|xato|O‘qish va ish|누구나 실수를 해요.|Hamma xato qiladi.
주문하다|buyurtma bermoq|Kundalik hayot|커피를 주문했어요.|Qahva buyurtma qildim.
예약하다|oldindan band qilmoq|Sayohat|호텔을 예약했어요.|Mehmonxonani band qildim.
도착하다|yetib kelmoq|Sayohat|기차가 역에 도착했어요.|Poyezd bekatga yetib keldi.
출발하다|yo‘lga chiqmoq|Sayohat|아침 일찍 출발해요.|Ertalab erta yo‘lga chiqamiz.
교통|transport qatnovi|Sayohat|이 동네는 교통이 편리해요.|Bu mahallada transport qatnovi qulay.
환승하다|boshqa transportga o‘tirmoq|Sayohat|다음 역에서 환승하세요.|Keyingi bekatda boshqa yo‘nalishga o‘ting.
문화|madaniyat|Jamiyat|한국 문화에 관심이 있어요.|Koreya madaniyatiga qiziqaman.
환경|atrof-muhit|Jamiyat|환경을 보호해야 해요.|Atrof-muhitni himoya qilish kerak.
정보|ma’lumot|Jamiyat|필요한 정보를 찾았어요.|Kerakli ma’lumotni topdim.
관계|munosabat; aloqa|Jamiyat|좋은 관계를 유지해요.|Yaxshi munosabatni saqlaymiz.
성공하다|muvaffaqiyatga erishmoq|O‘qish va ish|꾸준히 노력하면 성공할 수 있어요.|Muntazam harakat qilsangiz, muvaffaqiyatga erishishingiz mumkin.
실패하다|muvaffaqiyatsizlikka uchramoq|O‘qish va ish|실패해도 다시 도전해요.|Muvaffaqiyatsizlikdan keyin ham yana urinaman.
선택하다|tanlamoq|Kundalik hayot|원하는 색을 선택하세요.|Istagan rangingizni tanlang.
결정하다|qaror qilmoq|Kundalik hayot|아직 결정하지 못했어요.|Hali qaror qila olmadim.
이해하다|tushunmoq|O‘qish va ish|설명을 잘 이해했어요.|Tushuntirishni yaxshi tushundim.
설명하다|tushuntirmoq|O‘qish va ish|다시 설명해 주세요.|Qayta tushuntirib bering.
기억하다|eslamoq; yodda tutmoq|O‘qish va ish|이 단어를 기억하세요.|Bu so‘zni yodda tuting.
잊어버리다|unutib yubormoq|Kundalik hayot|우산을 잊어버렸어요.|Soyabonni unutib qoldirdim.
편리하다|qulay bo‘lmoq|Kundalik hayot|지하철이 편리해요.|Metro qulay.
불편하다|noqulay bo‘lmoq|Kundalik hayot|이 의자는 조금 불편해요.|Bu stul biroz noqulay.
중요하다|muhim bo‘lmoq|O‘qish va ish|시간을 지키는 것이 중요해요.|Vaqtga rioya qilish muhim.
필요하다|kerak bo‘lmoq|Kundalik hayot|도움이 필요해요.|Yordam kerak.
충분하다|yetarli bo‘lmoq|Kundalik hayot|시간이 충분해요.|Vaqt yetarli.
부족하다|yetishmaslik|Kundalik hayot|아직 경험이 부족해요.|Hali tajribam yetishmaydi.
장점|afzallik|Jamiyat|이 방법의 장점은 무엇이에요?|Bu usulning afzalligi nima?
단점|kamchilik|Jamiyat|누구에게나 단점이 있어요.|Har kimning kamchiligi bor.
의견|fikr; mulohaza|Jamiyat|여러분의 의견을 듣고 싶어요.|Fikringizni eshitmoqchiman.
관심|qiziqish; e’tibor|Jamiyat|한국어에 관심이 많아요.|Koreys tiliga qiziqishim katta.
목표|maqsad|O‘qish va ish|올해 목표는 합격이에요.|Bu yilgi maqsadim imtihondan o‘tish.
일정|jadval; reja|O‘qish va ish|다음 주 일정을 확인해요.|Kelasi haftaning jadvalini tekshiraman.
제출하다|topshirmoq|O‘qish va ish|내일까지 과제를 제출하세요.|Ertagacha vazifani topshiring.
참석하다|qatnashmoq|O‘qish va ish|회의에 참석했어요.|Majlisda qatnashdim.
지각하다|kech qolmoq|O‘qish va ish|수업에 지각하지 마세요.|Darsga kech qolmang.
연락하다|bog‘lanmoq; xabar bermoq|Kundalik hayot|도착하면 연락하세요.|Yetib borganingizda xabar bering.
계획|reja|Kundalik hayot|주말 계획이 있어요?|Dam olish kunlariga rejangiz bormi?
꾸준히|muntazam ravishda|O‘qish va ish|매일 꾸준히 연습해요.|Har kuni muntazam mashq qilaman.'''
words=[]; questions=[]
for i,line in enumerate(raw.splitlines(),1):
 ko,uz,category,example,translation=line.split('|')
 words.append(dict(id=f'V{i:02}',ko=ko,uz=uz,category=category,example=example,translation=translation))
for i,w in enumerate(words):
 others=[x for x in words if x['id']!=w['id']]
 rng=random.Random(i)
 opts=[w['uz']]+[x['uz'] for x in rng.sample(others,3)];rng.shuffle(opts)
 questions.append(dict(id=f"{w['id']}-1",kind='vocabulary',topic_id=w['id'],prompt=f"‘{w['ko']}’ so‘zining ma’nosini toping.",options=opts,answer=opts.index(w['uz']),explanation=f"{w['ko']} — {w['uz']}. Misol: {w['example']} {w['translation']}",translation='Koreyscha → o‘zbekcha'))
# Each line: topic, prompt, correct, three distinct distractors, explanation, translation.
grammar='''A01|길을 걷(   ) 친구를 우연히 만났어요.|다가|느라고|자마자|으려고|Yurish davomida kutilmaganda uchrashuv sodir bo‘lgan: -다가.|Yo‘lda ketayotib tasodifan do‘stimni uchratdim.
A01|책을 읽(   ) 잠이 들었어요.|다가|으려고|을수록|자마자|O‘qish davomida boshqa holatga, uyquga o‘tilgan.|Kitob o‘qiyotib uxlab qoldim.
A01|요리를 하(   ) 손을 다쳤어요.|다가|려고|거나|고 나서도|Ovqat qilish paytida kutilmagan jarohat yuz bergan.|Ovqat qilayotib qo‘limni jarohatladim.
A02|숙제를 모두 끝내(   ) 영화를 봤어요.|고 나서|느라고|려고|을까 봐|Birinchi ish tugagandan keyin ikkinchisi boshlangan.|Vazifani tugatib bo‘lgach kino ko‘rdim.
A02|손을 깨끗이 씻(   ) 밥을 먹으세요.|고 나서|느라고|으려고|을까 봐|Avval qo‘lni yuvib tugatish, keyin ovqatlanish kerak.|Qo‘lingizni yaxshilab yuvgach ovqatlaning.
A02|설명을 다 듣(   ) 질문해 주세요.|고 나서|느라고|으려고|을까 봐|Savol berishdan oldin tushuntirishni oxirigacha eshitish talab qilinyapti.|Tushuntirishni to‘liq tinglab bo‘lgach savol bering.
A03|이 가방은 예쁘(   ) 너무 비싸요.|ㄴ데|려고|자마자|느라고|예쁘다 sifatiga -ㄴ데 qo‘shiladi: 예쁜데. Ikki baho qarama-qarshi.|Bu sumka chiroyli, lekin juda qimmat.
A03|지금 비가 오(   ) 우산 있어요?|는데|느라고|려고|자마자|Yomg‘ir haqidagi vaziyat keyingi savolga fon bo‘lib turibdi.|Hozir yomg‘ir yog‘yapti, soyaboningiz bormi?
A03|저는 학생이(   ) 동생은 회사원이에요.|ㄴ데|느라고|자마자|려고|Ot + 인데: ikki kishining holati taqqoslanadi.|Men talabaman, ukam esa ofis xodimi.
A04|한국에서 공부하(   ) 한국어를 배워요.|려고|다가|느라고|자마자|Koreyada o‘qish — til o‘rganishdan ko‘zlangan maqsad.|Koreyada o‘qish uchun koreys tilini o‘rganyapman.
A04|친구에게 주(   ) 선물을 샀어요.|려고|느라고|거나|자마자|Sovg‘a olishning maqsadi uni do‘stga berish.|Do‘stimga berish uchun sovg‘a sotib oldim.
A04|일찍 일어나(   ) 알람을 맞췄어요.|려고|느라고|자마자|거나|Budilnikni sozlashdan maqsad — erta turish.|Erta turish uchun budilnikni sozladim.
A05|이 책을 빌리(   ) 회원 카드가 필요해요.|려면|느라고|거나|자마자|Kitobni olmoqchi bo‘lganda kerak bo‘ladigan shart aytilgan.|Bu kitobni olmoqchi bo‘lsangiz, a’zolik kartasi kerak.
A05|건강해지(   ) 운동을 꾸준히 해야 해요.|려면|느라고|다가|자마자|Maqsadga erishishning zarur sharti: -(으)려면.|Sog‘lom bo‘lish uchun muntazam mashq qilish kerak.
A05|늦지 않(   ) 지금 출발해야 해요.|으려면|느라고|다가|자마자|Kech qolmaslik maqsadi va buning sharti bog‘langan.|Kech qolmaslik uchun hozir yo‘lga chiqish kerak.
A06|보고서를 쓰(   ) 점심도 못 먹었어요.|느라고|려고|자마자|거나|Hisobot bilan bandlik sabab boshqa ish bajarilmagan.|Hisobot yozish bilan band bo‘lib, tushlik ham qila olmadim.
A06|전화를 하(   ) 설명을 못 들었어요.|느라고|려고|자마자|거나|Bir ish bilan band bo‘lish salbiy natijaga olib kelgan.|Telefonlashayotib tushuntirishni eshitmay qoldim.
A06|시험공부를 하(   ) 친구를 못 만났어요.|느라고|려고|자마자|거나|O‘qish bilan bandlik uchrashishga to‘sqinlik qilgan.|Imtihonga tayyorlanib, do‘stim bilan uchrasha olmadim.
A07|표가 있(   ) 입장할 수 있어요.|어야|으려고|느라고|자마자|Kirish imkoniyati uchun chiptaning borligi zarur shart.|Faqat chipta bo‘lsagina kirish mumkin.
A07|직접 해 봐(   ) 얼마나 어려운지 알 수 있어요.|야|느라고|려고|거나|Qiyinligini bilish uchun o‘zi qilib ko‘rish kerak.|O‘zingiz qilib ko‘rsangizgina qanchalik qiyinligini bilasiz.
A07|비밀번호를 알아(   ) 문을 열 수 있어요.|야|느라고|려고|자마자|Eshikni ochish uchun parolni bilish shart.|Parolni bilsangizgina eshikni ocha olasiz.
A08|기차를 놓칠(   ) 일찍 나왔어요.|까 봐|수록|뿐이라|때마다|Poyezdni o‘tkazib yuborishdan xavotir ehtiyot chorasiga sabab bo‘lgan.|Poyezdga ulgurmay qolishdan qo‘rqib erta chiqdim.
A08|주소를 잊어버릴(   ) 적어 두었어요.|까 봐|수록|때마다|뿐이라|Unutishdan xavotirlanib yozib qo‘ygan.|Manzilni unutib qo‘yishdan xavotirlanib yozib oldim.
A08|아이가 다칠(   ) 걱정돼요.|까 봐|수록|때마다|뿐이라|Xavotir qilinayotgan hodisa -(으)ㄹ까 봐 bilan ifodalanadi.|Bola jarohatlanishidan xavotirdaman.
A09|주말에는 영화를 보(   ) 책을 읽어요.|거나|느라고|려고|자마자|Ikki mashg‘ulotdan birini tanlash: yoki.|Dam olish kunlari kino ko‘raman yoki kitob o‘qiyman.
A09|모르는 단어는 사전을 찾(   ) 선생님께 물어보세요.|거나|느라고|으려고|을까 봐|So‘zni bilishning ikki muqobil usuli taklif qilinyapti.|Notanish so‘zni lug‘atdan toping yoki ustozdan so‘rang.
A09|신청서는 이메일로 보내(   ) 직접 내면 돼요.|거나|느라고|려고|자마자|Topshirishning ikki muqobil yo‘li bor.|Arizani elektron pochta orqali yoki shaxsan topshirish mumkin.
A10|문을 열(   ) 고양이가 뛰어나왔어요.|자마자|려고|느라고|을수록|Birinchi hodisadan darhol keyingi hodisa sodir bo‘lgan.|Eshik ochilishi bilanoq mushuk yugurib chiqdi.
A10|수업이 끝나(   ) 집으로 갔어요.|자마자|려고|느라고|거나도|Dars tugashi bilan darhol ketish ta’kidlangan.|Dars tugashi bilanoq uyga ketdim.
A10|집에 도착하(   ) 전화해 주세요.|자마자|려고|느라고|거나|Kelgandan keyin kechiktirmay telefon qilish so‘ralgan.|Uyga yetishingiz bilanoq telefon qiling.
A11|연습할(   ) 발음이 좋아져요.|수록|까 봐|뿐이라|뻔해서|Mashq ko‘paygani sari talaffuz ham yaxshilanadi.|Mashq qilgan sari talaffuz yaxshilanadi.
A11|생각할(   ) 더 궁금해져요.|수록|까 봐|뿐이라|뻔해서|O‘ylash darajasi ortgan sari qiziqish ham ortadi.|O‘ylagan sari yanada qiziqib boryapman.
A11|높이 올라갈(   ) 경치가 더 잘 보여요.|수록|까 봐|뿐이라|뻔해서|Ikki o‘zgarish bir-biriga mutanosib.|Yuqoriga ko‘tarilgan sari manzara yaxshiroq ko‘rinadi.
A12|배가 아파(   ) 병원에 갔어요.|서|도|야|보려고|Qorin og‘rig‘i shifoxonaga borish sababi.|Qornim og‘rigani uchun shifoxonaga bordim.
A12|날씨가 좋아(   ) 산책했어요.|서|야|보려고|놓고|Yaxshi ob-havo sayr qilishning sababi sifatida aytilgan.|Ob-havo yaxshi bo‘lgani uchun sayr qildim.
A12|늦게 일어나(   ) 지각했어요.|서|도|야|보려고|Kech turishning natijasi — kechikish.|Kech turganim uchun kech qoldim.
A13|많이 걸어서 (   ) 다리가 아파요.|그런지|되려고|놓아서|있다가|Sabab taxmin qilinyapti: ko‘p yurganim uchun bo‘lsa kerak.|Ko‘p yurganim uchun bo‘lsa kerak, oyoqlarim og‘riyapti.
A13|휴일이라서 (   ) 거리가 조용해요.|그런지|되려고|놓아서|있다가|Bayram kuni ekanligi sabab sifatida taxmin qilinyapti.|Dam olish kuni bo‘lgani uchun bo‘lsa kerak, ko‘cha tinch.
A13|긴장해서 (   ) 손이 떨려요.|그런지|되려고|놓아서|있다가|Qo‘l titrashining sababi taxmin bilan berilgan.|Hayajonlanganim uchun bo‘lsa kerak, qo‘lim titrayapti.
A14|아침에는 비가 오더니 지금은 맑아요. ‘-더니’의 의미는?|Oldingi kuzatuv va keyingi o‘zgarish|Kelajak uchun maqsad|Ikki erkin tanlov|Ruxsat so‘rash|Avval yomg‘ir kuzatilgan, keyin ob-havo o‘zgargan.|Ertalab yomg‘ir yog‘ayotgan edi, hozir havo ochiq.
A14|아이가 울(   ) 이제 웃어요.|더니|려고|느라고|을까 봐|Oldin kuzatilgan yig‘lash keyin kulishga o‘zgargan.|Bola yig‘layotgan edi, endi kulyapti.
A14|작년에는 작(   ) 많이 컸네요.|더니|으려고|느라고|자마자|Avvalgi kuzatuv bilan hozirgi o‘zgarish taqqoslangan.|O‘tgan yili kichkina edi, ancha katta bo‘libdi.
A15|무엇을 먹(   ) 아직 못 정했어요.|을지|느라고|자마자|으려고|Nima yeyishni tanlash bo‘yicha noaniqlik bor.|Nima yeyishni hali tanlamadim.
A15|어디로 가(   ) 함께 생각해 봅시다.|ㄹ지|느라고|자마자|려고|Birgalikda kelajakdagi yo‘nalishni tanlash muhokama qilinyapti.|Qayerga borishni birga o‘ylab ko‘raylik.
A15|어떤 옷을 입(   ) 고민 중이에요.|을지|느라고|자마자|으려고|Variantlar orasidagi tanlov va o‘ylanish -을지 bilan ifodalanadi.|Qaysi kiyimni kiyish haqida o‘ylayapman.'''
for i,line in enumerate(grammar.splitlines(),1):
 topic,prompt,correct,a,b,c,exp,uz=line.split('|');opts=[correct,a,b,c];random.Random(100+i).shuffle(opts)
 questions.append(dict(id=f'G{i:03}',kind='grammar',topic_id=topic,prompt=prompt,options=opts,answer=opts.index(correct),explanation=exp,translation=uz))
(root/'words.json').write_text(json.dumps(words,ensure_ascii=False,indent=2))
(root/'questions.json').write_text(json.dumps(questions,ensure_ascii=False,indent=2))
print(f'{len(words)} words; {len(questions)} questions')
