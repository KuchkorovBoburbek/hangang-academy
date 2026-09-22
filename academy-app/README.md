# HangangAcademy

Lug‘at markazining yangi 읽기 / 쓰기 / 듣기 tablari, ustoz tahriri va sayt/Telegram orqali AI yordamchi: [ishlatish qo‘llanmasi](docs/VOCABULARY.md). Yangi imkoniyatlarning deploy holati shu hujjatda qayd etilgan.

Koreys tili darslari orasida muntazam mashq qilish uchun o‘quvchi va o‘qituvchi veb-ilovasi. Telefon brauzerida ishlaydi; Telegram bot va Mini App ulanishi tayyorlangan. Zoom darsi alohida davom etadi.

## Serverdagi nusxa

[HangangAcademy saytini ochish](https://hangang.3.37.181.144.sslip.io) · [Telegram bot](https://t.me/hangang_academy_bot)

Serverdagi admin kirish ma’lumoti kompyuteringizda `.deploy/ACCESS.txt` faylida saqlangan. Serverni boshqarish va keyin o‘z domeningizga o‘tish tartibi: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Mahalliy nusxani ochish

`http://localhost:3000` manziliga kiring. **O‘quvchi** yoki **O‘qituvchi** sinov tugmasini bosing.

Ilovani qayta ishga tushirish:

```bash
cd /Users/boburbek/Documents/ChatGPT/Hangang_Academy/academy-app
npm ci
npm run dev
```

AI navbati va eslatmalar uchun ikkinchi terminal:

```bash
cd /Users/boburbek/Documents/ChatGPT/Hangang_Academy/academy-app
npm run worker
```

Node.js 24 yoki yangiroq talab qilinadi. Mahalliy sozlamalar `.env.local` ichida. `APP_URL` brauzerda ochilgan manzilga aynan mos bo‘lishi kerak; mahalliy sinov uchun **localhost**, `127.0.0.1` emas.

Mahalliy hisoblar:

| Hisob | Email | Parol |
|---|---|---|
| O‘qituvchi | teacher@hangang.local | HangangTeacher2026! |
| O‘quvchi | student@hangang.local | HangangStudent2026! |
| Ikkinchi o‘quvchi | bekzod@hangang.local | HangangStudent2026! |

Bular faqat namoyish hisoblari. Serverga mahalliy `data` papkasini ko‘chirmang. Server alohida yangi baza va o‘zingiz belgilagan kuchli parol bilan boshlanadi.

## Tayyor imkoniyatlar

- **TOPIK 읽기**: 12 imtihondan 574 ochiq savol va qo‘llanmadagi barcha 111 grammatikaga yangi savollar; savol turi bo‘yicha tasodifiy mashq, yakuniy natija, xatolarni saqlash va qayta yechish. 291 faol so‘z va 43 ibora misol va tarjimalari bilan. 12 ta mock faqat haqiqiy savollardan tuziladi: har birida 48 baholanadigan savol, 42–43 o‘rnida tashlab o‘tish yozuvi bor. Manbalar, import va cheklovlar: [docs/TOPIK.md](docs/TOPIK.md).
- O‘quvchi va o‘qituvchi uchun alohida kirish hamda ekranlar.
- **Lug‘at**: 48 boshlang‘ich so‘z, tarjima, misollar, quiz. O‘qituvchi yangi so‘z va unga savollar qo‘sha oladi.
- **Grammatika**: avvalgi qo‘llanmaning 111 bandi, o‘zbekcha izohlar va koreyscha misollar. Hozir 15 asosiy mavzuda 51 grammatika savoli bor; qolgan bandlar uchun o‘qituvchi savol qo‘shadi. Kartalarda mavjud savollar soni ko‘rsatiladi.
- Jami **99 boshlang‘ich savol**: 48 lug‘at + 51 grammatika. Grammatikada bo‘sh joyni to‘ldirish hamda yaqin ma’noli ifodani tanlash mashqlari mavjud.
- Mashq rejimida har javobdan so‘ng izoh; kichik sinovda yakunda izoh. Yarim qolgan mashq saqlanadi.
- Takrorlash: xato savol ertasi kuni; to‘g‘ri javoblar 2, 4, 7, 14 va 30 kunlik oraliqda qaytadi. Kunlik savollar va oxirgi 7 kundagi faollik ko‘rinadi.
- Shaxsiy daftar: qo‘llanma bandini saqlash, o‘z qaydini yozish, tahrirlash va o‘chirish.
- Guruhlar, taklif kodlari, ochiladigan mavzular va topshirish muddati bilan vazifalar.
- Yozma vazifa: matn, **JPG/PNG/WebP rasmi va PDF**. Har biri 5 MB gacha, bir topshiriqqa 3 ta fayl.
- Ustoz panelida yozma ishlar, faollik, birinchi/oxirgi quiz natijasi va ko‘p xato qilingan mavzular.
- AI tavsiyasi faqat ustozga. Ustoz tavsiyani tahrirlab, baho va yakuniy izohni o‘quvchiga yuboradi.
- Telegram hisobini bog‘lash, Mini App orqali kirish, shaxsiy vaqt mintaqasi va ixtiyoriy eslatma vaqti.

Natijalar o‘quv mashqi uchun. Kichik sinov to‘liq rasmiy TOPIK imtihoni yoki rasmiy ballni bashorat qilish vositasi emas.

## O‘qituvchi uchun birinchi dars

1. **Guruhlar** bo‘limida guruh yarating yoki mavjudini tahrirlang. O‘tilgan grammatikalar va so‘zlarni belgilang.
2. Guruhning **taklif kodi**ni o‘quvchilarga bering. Ular kirish sahifasidagi **Guruhga qo‘shilish** orqali ro‘yxatdan o‘tadi.
3. **Quiz bazasi**da grammatika va lug‘at uchun alohida savollar kiriting. Har bir savolda 4 variant, to‘g‘ri javob va tushuntirish bo‘ladi.
4. Yangi so‘z kerak bo‘lsa, **Lug‘at quizlari → Yangi so‘z**. So‘ng uni guruh uchun ochib, quiz savoli qo‘shing.
5. **Vazifa berish** orqali yozma, grammatika yoki lug‘at vazifasini belgilang.
6. **Tekshirish** bo‘limida ishni oching. O‘zingiz izoh yozing yoki AI ulangan bo‘lsa yordam so‘rang. **Izohni o‘quvchiga yuborish** tugmasi yakuniy nashr qiladi.

## AI ustozni ulash

`.env.local` (mahalliy) yoki `.env` (Docker) faylida:

```dotenv
AI_PROVIDER=openrouter
OPENROUTER_API_KEY=YOUR_PRIVATE_KEY
OPENROUTER_MODEL=openai/gpt-6-astra
AI_REASONING_EFFORT=high
```

Kalitni suhbatga yuborish shart emas. Faylga kiriting, ilova va worker’ni qayta ishga tushiring. OpenRouter hisobida balans bo‘lishi kerak. To‘g‘ridan-to‘g‘ri OpenAI ishlatish uchun `AI_PROVIDER=openai`, `OPENAI_API_KEY` va `OPENAI_MODEL` belgilanadi. Kalitlar brauzerga chiqarilmaydi; OpenRouter kaliti OpenAI manziliga yuborilmaydi.

Matn, rasm va PDF bitta tekshirishga birga yuboriladi. OpenRouter’da PDF modelning o‘zida o‘qiladi; tanlangan model `file` kirishi va structured outputs’ni qo‘llashi kerak. So‘rov qat’iy JSON schema va `provider.data_collection=deny` bilan yuboriladi. Muqobil modelga yashirin o‘tish yoki pullik so‘rovni avtomatik qayta yuborish yo‘q. Navbatdagi ish o‘z provider va modelini saqlaydi.

Rasmiy manbalar: [OpenRouter model](https://openrouter.ai/openai/gpt-6-astra), [PDF kirishlari](https://openrouter.ai/docs/guides/overview/multimodal/pdfs), [Structured outputs](https://openrouter.ai/docs/guides/features/structured-outputs).

O‘qituvchi bosgandan keyingina shu topshiriq matni, ko‘rsatmasi va ilovalari tanlangan AI xizmatiga yuboriladi. Ism/email alohida yuborilmaydi, lekin fayl ichida yozilgan shaxsiy ma’lumotlar uning tarkibida qoladi. AI qaytargan baho mezonlar yig‘indisidan qayta hisoblanadi; o‘qib bo‘lmaydigan qo‘lyozma uchun noaniqlik ko‘rsatilishi talab etiladi. Natija faqat ustozga qoralama sifatida chiqadi.

2026-09-19 kuni haqiqiy OpenRouter so‘rovida ikkita sun’iy ish sinovdan o‘tdi: oddiy koreyscha matn hamda PNG/PDF ilovalari bilan matn. Model zamon xatosini topib, o‘zbekcha tushuntirdi va rasm/PDFdagi alohida belgilarni to‘g‘ri o‘qidi. Haqiqiy qo‘lyozmalar sifati hali sinovdan o‘tmagan. Ishlatish boshida 5–10 namunani ustoz bahosiga solishtirib kalibrlash kerak. Bitta ustozga soatiga 20 so‘rov chegarasi bor; OpenRouter kalitiga sarf limitini ham belgilang.

## Telegram ulanishi

1. BotFather orqali akademiya botini oling va HTTPS domenni tayyorlang.
2. Quyidagilarni `.env` ichida belgilang: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME` (`@` belgisisiz), `TELEGRAM_WEBHOOK_SECRET` (kamida 32 ta tasodifiy harf/raqam yoki `_`/`-`) va `APP_URL`.
3. Server ishga tushgach bir marta sozlang:

```bash
docker compose exec app node --import tsx scripts/setup-telegram.ts
```

4. Mavjud hisob uchun ilovada **Sozlamalar → Telegram’ni ulash**. O‘quvchi keyin eslatma va vaqtini tanlaydi. Yangi o‘quvchi botdagi ilovani ochib guruh kodi bilan qo‘shiladi.
5. O‘qituvchi o‘z Telegram hisobini ham bog‘lasa, yangi yozma ish haqida xabar oladi. O‘quvchiga izoh nashr qilinganda xabar keladi.

Bot tokeni va username mosligi Telegram getMe orqali tasdiqlangan. Haqiqiy xabar yetkazilishi va mobil Mini App kirishi domen/webhook ishga tushgach tekshiriladi. Oddiy veb-kirish ishlaydi. Telegram mobil ilovasida sinovdan o‘tkazing; veb-Telegram ichidagi uchinchi tomon cookie cheklovlari bo‘lsa ilovani brauzerda oching.

## Docker bilan serverda ishga tushirish

```bash
cp .env.example .env
# .env ichida haqiqiy domen, admin email va kamida 16 belgili yangi parolni belgilang.
docker compose up -d --build
```

- `app` — veb-ilova; `worker` — AI navbati va Telegram eslatmalari; `backup` — kunlik zaxira nusxa.
- `academy-data` volume SQLite bazasi va yopiq fayllarni saqlaydi. Container qayta yaratilganda saqlanadi.
- `academy-backups` volume zaxiralarni saqlaydi. Alohida backup xizmati har UTC kunida bitta to‘liq nusxa yaratadi va oxirgi 7 nusxani qoldiradi. Nusxa tugamaguncha tayyor deb belgilanmaydi; baza yaxlitligi, barcha biriktirilgan fayllar va SHA-256 nazorat qiymatlari tekshiriladi.
- Ilova serverning faqat `127.0.0.1:3000` manzilida ochiladi. Oldiga HTTPS reverse proxy qo‘yiladi; namunasi `docs/Caddyfile` ichida.
- `.env` Docker image ichiga ko‘chirilmaydi. `DEMO_MODE` serverda o‘chirilgan.
- `ADMIN_*` faqat birinchi bazani yaratishda ishlatiladi; keyin `.env`dagi parolni o‘zgartirish mavjud hisob parolini o‘zgartirmaydi.
- Bitta serverda **bitta app va bitta worker** ishlating. Ushbu SQLite varianti network filesystem yoki ko‘p serverli klaster uchun emas.

Tekshirish:

```bash
docker compose ps
docker compose logs --tail 30 app worker
```

Docker image mahalliy qurildi, app va worker birgalikda ishga tushirildi, healthcheck hamda zaxira yaratish tekshirildi. Ommaviy serverga hali chiqarilmagan.

## Zaxira va tiklash

```bash
docker compose exec app npm run backup
```

Bu `VACUUM INTO` orqali baza snapshotini va `uploads` nusxasini bitta sana papkasiga yozadi. `.env` zaxiraga kiritilmaydi: uni alohida xavfsiz saqlang. Zaxirani serverdan tashqariga ham ko‘chiring. Hozir avtomatik tashqi zaxira jadvali sozlanmagan.

Zaxirani chiqarib olish:

```bash
docker compose cp app:/app/backups ./exported-backups
```

Tiklashdan oldin app, worker va backup xizmatlarini to‘xtating. Zaxiradagi `academy.sqlite` va `uploads`ni volume ichiga qaytaring; eski SQLite `-wal`/`-shm` fayllarini **faqat to‘xtatilgan xizmatlarda va tekshirilgan zaxiradan tiklash vaqtida** olib tashlang. Volume egasi container ichidagi `node` (UID 1000) bo‘lishi kerak. Xizmatlarni ochib hisoblar, yozma ishlar va ilovalarni tekshiring. Restore jarayoni real serverda hali sinalmagan.

## Tekshiruvlar

```bash
npm run typecheck
npm test
npm run build
npm run test:e2e
```

HTTP sinovi 3100-portda alohida vaqtinchalik bazani ochadi, asosiy o‘quvchilar ma’lumotlariga tegmaydi. AI sinovlari haqiqiy API chaqirmaydi. Bir vaqtning o‘zida 100 ta faol foydalanuvchi bilan server yuklama sinovi hali bajarilmagan.

## Texnik asos va hozirgi chegara

Next.js 16 + React 19 + TypeScript; Node.js 24; SQLite WAL; Zod; mahalliy Manrope va Noto Sans KR shriftlari. Barcha javoblar serverda tekshiriladi; fayllar public papkada saqlanmaydi. Sessiyalar HttpOnly cookie bilan, parollar bcrypt bilan himoyalangan. Ustoz va o‘quvchi huquqlari har bir so‘rovda tekshiriladi.

Birinchi versiya matn/rasm/PDF yozma ishlar, kunlik mashq, guruh vazifalari va takrorlashga qaratilgan. To‘liq TOPIK imtihon banki, audio tinglash, to‘lovlar, davomat, Zoom avtomatik integratsiyasi, parolni email orqali tiklash va quiz savollarini ommaviy import qilish hali kiritilmagan. Keyingi ustuvor ish — o‘zingizning dars materiallaringiz bilan savollar bazasini kengaytirish va kichik guruhda pilot dars o‘tkazish.

Dars dasturlari va guruhlarni boshqarish: [Qo‘llanma](docs/COURSES.md).
