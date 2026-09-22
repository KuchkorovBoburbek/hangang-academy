# HangangAcademy — darslar va guruh dasturlari

Bu imkoniyatlar lokal loyihaga qo‘shilgan. Serverga joylash alohida bosqich; ushbu ish davomida deploy qilinmagan.

## Ustoz uchun

1. **Dars dasturlari** bo‘limini oching. 한글, TOPIK 3/4 yoki TOPIK 5/6 ni tanlang.
2. **Dars qo‘shish** tugmasini bosing. Nom, tartib va qisqa izohni kiriting.
3. Kerakli material kartalarini qo‘shing: lug‘at, grammatika, 읽기, 듣기, 쓰기, 말하기, qo‘shimcha fayl.
4. Matn yozing, mavjud bazadan so‘z/grammatikani tanlang yoki fayl yuklang. Rasm/PDF 5 MB, audio 20 MB gacha. Video uchun havola ishlatiladi.
5. Lug‘atni qo‘lda yozish yoki AI yordamida matn/rasmdan tayyorlash mumkin. AI natijasini tahrirlab **Darsga qo‘shish** bilan tasdiqlang. Darsga xos yangi so‘zlar umumiy bazaga avtomatik tarqalmaydi.
6. Material uchun javob usulini tanlang: faqat o‘rganish, o‘quvchining “Bajardim” tasdig‘i, quiz, matn, rasm/PDF yoki audio. Majburiy va ixtiyoriy vazifalar ajratiladi.
7. Quizni qo‘lda yozing yoki dars so‘zlari / bazadagi grammatika savollaridan yarating. To‘g‘ri javobni tekshiring. So‘zlar quiz uchun kamida ikki xil tarjimaga ega bo‘lishi kerak.
8. Dars boshidagi takrorlash quiziga oldingi darsdan savollarni tanlang yoki o‘zingiz yozing.
9. **O‘quvchi ko‘rinishi** orqali tekshiring va **Saqlash** tugmasini bosing.
10. **Guruhga ochish** orqali shu darajadagi guruh, dars sanasi va vazifa muddatini tanlang.

Dastur har bir ustoz va daraja uchun bir marta yaratiladi. Bir ustozning bir nechta guruhi shu dasturdan foydalanadi. Har bir guruh darslarni alohida tezlikda ochadi.

### Mavjud guruhlarni ulash

Eski guruhlar, materiallar va natijalar o‘chirilmagan. Eski guruhni yangi tartibga o‘tkazish uchun **Guruhlar va vazifalar → guruhni sozlash → darajani tanlash → saqlash** kerak. Shundan keyin darslar dasturi biriktiriladi. Daraja hali belgilanmagan eski guruhlar avvalgi tartibda ishlaydi.

Yangi guruhlar faqat uchta belgilangan darajadan tanlanadi. Darslari ochilgan guruhning darajasini almashtirish bloklangan: boshqa daraja uchun yangi guruh yaratiladi.

### Qoralama va ochilgan dars

Ochish paytida guruh uchun darsning mustaqil nusxasi olinadi. Keyingi qoralama tahriri ochilgan darsni yoki topshirilgan javoblarni o‘zgartirmaydi. Bir darsni bir guruhga takror ochish yangi vazifa yoki ball hosil qilmaydi. Keyingi guruhga ochilganda esa eng so‘nggi saqlangan qoralama olinadi. Oldingi ochilgan darslar o‘quvchi uchun qoladi.

## Telegram orqali dars lug‘ati

Botga **/dars** yuboring → daraja → dars → koreyscha so‘z yoki rasm.

AI tugagach ustozga natija va darsga havola keladi. Saytdagi dars muharririda **Telegramdan kelgan lug‘at → Ko‘rish va darsga qo‘shish** orqali tekshiriladi. Tasdiqlash qoralamani saqlaydi; o‘quvchilarga hali ochmaydi. Qoralamada saqlanmagan boshqa o‘zgarishlar bo‘lsa, avval ularni saqlang. `/bekor` so‘z kiritish holatini tugatadi, navbatdagi so‘rovni bekor qilmaydi.

Mavjud **/lugat** buyrug‘i guruhlarga qo‘shimcha so‘z kiritish uchun saqlangan. Uning muvaffaqiyatli import xabarlari avvalgidek ishlaydi. `/dars` va `/lugat` bir-birining faol kiritish holatini almashtiradi.

Darsga AI so‘zlari uchun Telegramda bir paytda 2 ta, 24 soatda 30 ta so‘rov; veb yordamchida soatiga 20 ta so‘rov. AI kaliti va bot ulanishi avvalgi sozlamalardan olinadi. Bot uchun worker ishlashi kerak. Yangi kod deploy qilinmaguncha real Telegram botda `/dars` mavjud emas.

## O‘quvchi uchun

Bosh sahifa ochilgan darslarni, vazifa holatlarini va jami ballni ko‘rsatadi. Faqat guruhiga ochilgan materiallar va ustoz aynan shu guruhga qo‘shgan qo‘shimcha lug‘atlar mavjud. Yopiq yoki boshqa guruh darsi hamda fayliga bevosita havola orqali ham kirib bo‘lmaydi.

Dars lug‘ati: tarjimali ro‘yxat, kartochka, mini quiz va juftlik topish. Bu takrorlash o‘yinlari sovg‘a ballini oshirmaydi. Dars vazifasi sifatida berilgan quizning birinchi natijasi saqlanadi; takror topshirish ballni ko‘paytirmaydi.

Matn/rasm/PDF/ovozli javob ustozning mavjud **Tekshirish** bo‘limiga tushadi. Ovoz yozish mikrofon ruxsati va mos brauzer talab qiladi; audio fayl yuklash ham bor. AI tekshiruvi mavjud matn, rasm va PDF uchun saqlangan. Ovozli javobni ustoz tinglab baholaydi.

한글 guruhiga TOPIK bo‘limi berilmaydi. TOPIK 3/4 va 5/6 guruhlari uchun mavjud TOPIK II mashqlari o‘z ishlash tartibida saqlanadi; dastur darslari daraja va ochilgan guruh bo‘yicha ajratiladi.

## Guruh jadvali, quiz va sovg‘a

**Guruhim**da faqat guruh a’zolari ismlari, dars sanalari, bajarilgan vazifalar va ballar ko‘rinadi. Javob matni, fayllar, email, Telegram ID yoki shaxsiy ustoz izohi boshqalarga chiqarilmaydi.

Kun/dars belgisi barcha majburiy vazifalar bajarilganda tasdiqlanadi. Ustoz tekshiradigan ishlar e’lon qilingan fikr-mulohazadan keyin bajarilgan hisoblanadi. “Bajardim” vazifasi esa o‘quvchi tasdig‘i bilan yakunlanadi.

**Guruh natijalari**da ustoz har dars uchun 0–10 ball qo‘yadi. Yozma ishning 0–100 bahosi bu motivatsiya ballidan alohida. Umumiy reyting avval ball, teng bo‘lsa bajarilgan darslar, keyin jonli quizlardagi to‘g‘ri javoblar bo‘yicha tartiblanadi.

Dars quizini ustoz guruh natijalaridan boshlaydi va yakunlaydi. Bir o‘quvchiga bir urinish, vaqt serverda “Boshlash”dan hisoblanadi. Quiz davomida o‘quvchi faqat o‘z natijasini oladi; ustoz yakunlagach umumiy natijalar ochiladi. O‘rin avval to‘g‘ri javoblar, teng bo‘lsa vaqt bo‘yicha belgilanadi. Tugagan quiz qayta ochilmaydi.

100 ballga yetganda kitob sovg‘asini **Kitob berildi** tugmasi bilan qayd qilish mumkin. Bu tugma oldingi ballni o‘chirmaydi va bir marraga sovg‘ani takror qayd qilmaydi.

## Texnik saqlash

SQLite sxemasi 13: yangi kurs, dars, fayl, ochilgan nusxa, vazifa, quiz, ball va Telegram qoralama jadvallari qo‘shilgan. Eski jadvallardan ma’lumot o‘chirilmaydi. Dars fayllari mavjud yopiq uploads katalogida saqlanadi va zaxira nusxaga kiritiladi. Darsni saqlash revision orqali bir vaqtda tahrirlash ziddiyatini aniqlaydi.
