# TOPIK 읽기 — manbalar va ishlatish

2026-09-22 holati. Ushbu bo‘lim mahalliy loyiha va jonli serverga chiqarilgan. 쓰기, 듣기 va audio fayllar bu TOPIK bo‘limiga kiritilmagan.

## Mazmun

Manba papkasi: `/Users/boburbek/Desktop/TOPIK_2`. Imtihonlar: 35, 36, 37, 41, 47, 52, 60, 64, 83, 91, 96, 102.

- 600 asl savol joyi hisobga olingan; 574 tasi o‘quvchiga beriladi.
- Barcha imtihonlarning 42–43-savollarida matn copyright sabab berilmagan. 102회 da 23–24 ham shunday. Ushbu 26 savol mashq va mock tanlovidan chiqarilgan.
- Qo‘llanmadagi barcha 111 grammatika uchun alohida yangi savol tuzilgan. Ular `origin: generated` bilan belgilanib, 1–4 mashqlariga qo‘shilgan. 1–2 bo‘sh joy, 3–4 yaqin ma’noli ifoda turini saqlaydi.
- Jami ishlatiladigan savollar: **685**. Savol matni, to‘rt variant, javob, manba imtihon va PDF sahifasi SQLite’da alohida saqlanadi.
- 5–10-savollardagi 72 rasm/diagramma asl sahifadan kesib olingan. Qolgan matnlar HTML matni sifatida, asl tagiga chizilgan qismlar va umumiy matn guruhlari bilan ko‘rsatiladi.
- 291 faol so‘z va 43 ibora: o‘zbekcha ma’no, koreyscha misol va misol tarjimasi. Chastota asl ochiq savollar matni va variantlaridagi qaydlardan hisoblanadi; umumiy matn bir marta sanaladi. Bu lug‘at to‘liq morfologik tahlil yoki kelajak imtihon ehtimoli reytingi emas. Atoqli otlar va matnni yechish uchun ikkinchi darajali maxsus nomlar tanlovga kiritilmagan.

## Mashq va natija

O‘quvchi savol turi va 10/15 savolni tanlaydi. Umumiy matnli juftlik yoki uchlik ajratilmaydi; masalan 15 so‘ralganda 16 berilsa, sabab oldindan ko‘rsatiladi. Javoblar serverda saqlanadi, mashqni davom ettirish mumkin. To‘g‘ri javob yakunlanguncha yashiriladi. Natijada o‘quvchi tanlovi, to‘g‘ri variant va manba ko‘rsatiladi; xato savolni saqlash hamda umumiy matni bilan qayta yechish mumkin.

Lug‘at va ibora bo‘limlarida savol diapazoni, tasodifiy kartalar, misol/tarjimani ochish, o‘zini tekshirish va jadval bor. Diapazon tanlanganda chastota ham shu diapazonga tegishli bo‘ladi.

## Mock imtihonlar

Foydalanuvchi haqiqiy savollarni turli mocklarda takrorlashga ruxsat berdi va manbada yo‘q 42–43-savollarni ochiq qoldirib, “Bu savollarni tashlab o‘ting” deb ko‘rsatishni tanladi. 12 ta mock tayyor. Ularning har birida 48 haqiqiy savol bor; raqamlar 1–41, 44–50 ko‘rinishida saqlanadi. 42 va 43 tugmalari savol o‘rnidagi ogohlantirishni ochadi; bu joylar javobsiz yoki xato deb hisoblanmaydi.

Savollar avval ishlatilmagan manbalardan tanlanadi, zarur bo‘lsa eng kam ishlatilgan guruh qayta olinadi. Hozirgi 12 mockdagi 576 joy 574 ta noyob haqiqiy savol bilan to‘ldiriladi: faqat bitta 23–24 juftligi ikki mockda uchraydi. Bitta mock ichida takror yo‘q; umumiy matnli guruhlar ajratilmaydi. Har variant bir nechta asl imtihondan yig‘iladi. 111 yangi grammatika mashqi mocklarga kirmaydi, alohida mashq rejimida qoladi.

Oldin tayyorlangan `content/topik/draft-reading-replacements.json` ishlatilmaydi (`verified: false`). Yig‘ish skripti qo‘shimcha o‘qish qoralamalarini qo‘shmaydi. Bu qoralamalar kelgusida alohida topshiriqsiz bazaga kiritilmasin.

Mock mexanizmi 70 daqiqa, serverdagi yakun muddati, uzilishdan keyin davom ettirish va muddat tugaganda avtomatik yakunlashni qo‘llaydi. Har mavjud savol 2 ball, maksimal natija 96 ball. To‘g‘ri javoblar foizi 48 baholanadigan savolga nisbatan hisoblanadi. Har bir savolning asl imtihon raqami va manba savol raqami natijada saqlanadi.

## Qayta yig‘ish va import

Manba PDFlar o‘zgartirilmagan. `content/topik-source` OCR auditi, javob kalitlari va tagiga chizilgan qismlarni saqlaydi. 96회 javob kaliti papkada bo‘lmagani sabab 48 ochiq savol mustaqil yechilib, saqlangan asl kalit nusxasi bilan solishtirilgan; manbasi `96-review.json` ichida.

```bash
python3 scripts/build-topik-bank.py
python3 scripts/create-topik-vocabulary.py
npm run backup
npm run db:topik
```

Yig‘ish uchun Pillow kerak. Matn tuzatishlari `content/topik/corrections-early.json`, `corrections-middle.json`, `corrections-late.json` ichida; dalillar yonidagi notes/provenance fayllarida. Generator tuzatishlarni har qayta yig‘ishda qo‘llaydi. Tayyor import uchun Python yoki manba PDF kerak emas: `groups.json`, `vocabulary.json` va `public/topik-assets` yetarli.

Import mavjud o‘quvchi, guruh, topshiriq va natijalarni saqlaydi. Eski TOPIK urinishlari o‘z savol nusxalarini saqlaydi; yangi import oldingi natijaning mazmunini almashtirmaydi. Import ma’lumotlari tranzaksiyada tekshiriladi. `.env.local`/`.env` va `DATA_DIR` boshqa server skriptlari bilan bir xil qo‘llanadi.

Serverga chiqarishda avval server bazasining backup’i olinadi va ilova yangilanadi. Compose ilova boshlanishida `npm run db:seed` va `npm run db:topik` buyruqlarini avtomatik bajaradi; TOPIK savollari hamda mos yechimlar import qilinadi. Mahalliy `data` yoki OCR vaqtinchalik fayllarini serverga ko‘chirmang.

## Tekshirish

`tests/topik.test.ts` server mantiqi, maxfiy javoblar, egalik, muddat, aralash tanlov, bo‘sh 42–43 raqamlari, 48 ta javobni baholash va saqlangan urinishlarni qamrab oladi. `tests/topik-content.test.ts` barcha manba raqamlari, 26 istisno, 111 grammatika, tagiga chiziqlar, bo‘sh joylar, rasm fayllari va 12 mockda faqat zarur juftlik qayta ishlatilishini tekshiradi. Brauzer sinovlari va ekranlar tafsiloti: `docs/topik-qa.md`.
