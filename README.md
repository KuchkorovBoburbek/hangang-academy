# HangangAcademy

Koreys tilini guruh darajasi va darslar bo‘yicha o‘rganish platformasi. Ustozlar darslar, lug‘at, grammatika, quiz va uy vazifalarini boshqaradi; o‘quvchilar mashq qiladi, ish topshiradi va o‘z natijalarini kuzatadi.

## Repository tarkibi

- **[academy-app](academy-app/)** — Next.js, React, TypeScript va SQLite asosidagi veb-ilova, Telegram bot, AI yordamchi, testlar va Docker sozlamalari.
- **[Dars dasturlari qo‘llanmasi](academy-app/docs/COURSES.md)** — 한글, TOPIK 3/4, TOPIK 5/6, darslarni ochish, vazifalar, guruh reytingi va sovg‘alar.
- **[Lug‘at yordamchisi](academy-app/docs/VOCABULARY.md)** — sayt va Telegram orqali so‘zlar bilan ishlash.
- **[TOPIK grammatika PDF qo‘llanmasi](output/pdf/HangangAcademy_TOPIK_II_Grammatika_1-4.pdf)** — HangangAcademy brendi ostidagi o‘quv qo‘llanma.
- **[handbook](handbook/)** — PDF qo‘llanmasining matni va dastlabki generatori.
- **[Server qo‘llanmasi](academy-app/docs/DEPLOYMENT.md)** — mavjud server tuzilmasi va Docker bilan boshqarish.

## Mahalliy ishga tushirish

Node.js 24 yoki yangiroq kerak.

```bash
cd academy-app
npm ci
cp .env.example .env.local
```

`.env.local` ichida `APP_URL=http://localhost:3000` ni belgilang. Birinchi baza uchun admin email va o‘zingiz tanlagan kuchli parolni kiriting. AI/Telegram kerak bo‘lsa, shaxsiy kalitlarni shu faylga qo‘shing.

```bash
npm run db:seed
npm run db:topik
npm run dev
```

Ikkinchi terminalda:

```bash
cd academy-app
npm run worker
```

Brauzer: http://localhost:3000. Yangi guruhga darajani biriktiring, darsni tayyorlang va guruh uchun oching. Batafsil: [ilova qo‘llanmasi](academy-app/README.md).

## Docker

```bash
cd academy-app
cp .env.example .env
# .env ichida APP_URL, admin email/parol va kerakli integratsiyalarni sozlang.
docker compose up -d --build
```

`app`, `worker` va `backup` xizmatlari ishlaydi. O‘quvchi ma’lumotlari va fayllar Docker volume’da saqlanadi. Internetga chiqarish uchun HTTPS proksi kerak. GitHub’ga yuklash serverga avtomatik deploy qilmaydi.

## Tekshirish

```bash
cd academy-app
npm run build
npm run typecheck
npm test
# Oldin Playwright uchun brauzer o‘rnating:
npx playwright install chromium
npm run test:e2e
```

Testlar alohida vaqtinchalik bazadan foydalanadi. API kalitlari va haqiqiy Telegram xabarlari talab qilinmaydi.

## Ma’lumotlarni saqlash

Bu repository kod, dars kontenti va sozlama namunalarini saqlaydi. `.env` fayllari, API kalitlari, SSH kalitlari, admin parollari, o‘quvchi bazasi, shaxsiy yuklangan fayllar, zaxiralar va mahalliy deploy arxivlari Git’ga kiritilmaydi. Ularni alohida xavfsiz zaxiralash kerak. `.env.example` ichida faqat bo‘sh maydonlar va namuna qiymatlari bor.

Darslar va lug‘at bo‘yicha yangi kod mahalliy versiyada tayyor. Mavjud serverda qaysi imkoniyatlar ishga tushirilgani tegishli qo‘llanmalarda alohida qayd etilgan.
