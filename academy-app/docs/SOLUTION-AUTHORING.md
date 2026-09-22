# TOPIK yechimlari

2026-09-22: foydalanuvchi ko‘rsatmasiga binoan yechimlar tashqi AI xizmatiga yuborilmasdan, savollarni mahalliy o‘qish va tahlil qilish orqali yozildi. OpenRouter so‘rovi yuborilmadi va API xarajati qilinmadi. Bu ish uchun tashqi xizmatdan foydalanish rejalashtirilmaydi.

## Tayyor mazmun

`content/topik/solutions.json` da **685 / 685** mavjud savolning yechimi bor:

- 12 haqiqiy imtihondagi **574** mavjud savol: 35, 36, 37, 41, 47, 52, 60, 64, 83, 91, 96 va 102회.
- Avvaldan bazada bo‘lgan **111** grammatika mashqi.
- Manbada mualliflik sabab berilmagan 26 savolga yechim yaratilmagan. Mockda 42–43 savollarni tashlab ketish siyosati saqlangan.

Har yechim qisqa o‘zbekcha sabab, boshqa variantlarning farqi va bitta amaliy eslatmadan iborat. Zarur joyda qisqa koreyscha iqtibos ham bor; iqtibos majburiy emas. Yechimlar 100 so‘zdan oshmaydi. Diagrammali savollarning ko‘rsatkichlari asl mahalliy rasmlar bilan solishtirildi. Bu matnlar professional o‘qituvchi uslubida yozilgan tahlillardir; inson ustoz tomonidan tasdiqlangan degan belgi qo‘yilmagan. Bosh ustoz mazmunni istalgan payt tahrirlashi mumkin.

## Mahalliy tayyorlash va import

`content/topik/solution-notes/` ichidagi fayllar mustaqil tanlangan javob va yozilgan izohlarni saqlaydi. Har bir qator shakli:

```text
savolRaqami|javob1dan4gacha|sabab|boshqaVariantlarFarqi|ixtiyoriyIqtibos|ixtiyoriyEslatma
```

Grammatika faylida savol raqami o‘rniga `a01`, `b01` kabi identifikator ishlatiladi. 35회 ning dastlabki to‘rtta yechimi bevosita `solutions.json` da avvaldan mavjud; yig‘uvchi ularni saqlaydi.

```sh
node --import tsx scripts/assemble-solutions.ts --complete
npm run db:solutions
```

Birinchi buyruq mahalliy matnlarni birlashtiradi, mustaqil javobni kalit bilan, iqtibosni manba bilan va har yechimni uning manba xeshi bilan tekshiradi. `--complete` mavjud savollarning birortasi yechimsiz qolsa xato bilan tugaydi. U tarmoqqa ulanmaydi. Ikkinchi buyruq faylni bazaga import qiladi; bosh ustoz kiritgan tahrirlarni bosib ketmaydi. Takroriy o‘zgarmagan import yangi tahrir yaratmaydi. `npm run db:topik` ham mos yechimlarni import qiladi.

## O‘quvchi va ustoz imkoniyatlari

- Mashqda javob alohida tekshirilgach qulflanadi. Shundan keyin o‘quvchi o‘zi «Yechimni ko‘rish»ni bosib izohni ochadi. Mockda yechimlar imtihon yakunida ochiladi.
- Bosh ustoz uchun `/solutions`: tur va qidiruv bo‘yicha tanlash, asl savol yonida tahrirlash, o‘quvchi ko‘rinishi va tahrirlar tarixi. Oddiy ustoz va o‘quvchi tahrirlay olmaydi. Bosh ustoz `ADMIN_EMAIL` orqali belgilanadi; `users.content_editor=1` va `role=teacher` talab qilinadi.
- Har yechim matn, variant va javob kalitining SHA-256 iziga bog‘langan. Eski urinishlar o‘z manbasiga mos tahrirni ochadi. Parallel tahrirlar 409 bilan himoyalangan.
- O‘quvchi yechimni daftariga saqlaydi. Saqlangan ustoz yechimi va o‘quvchining shaxsiy izohi alohida; ustozning keyingi tahriri oldingi qaydni o‘zgartirmaydi.
- Takror saqlash nusxa ko‘paytirmaydi. Arxivdagi qayd tiklanadi. Daftarda tur bo‘limlari, qidiruv, papka, teg, muhimlik, saralash va qaytariladigan arxiv bor. Savolga qaytish va qayta yechish mumkin.

## Tekshiruv

- Mazmun testi barcha 685 mavjud savolni bir martadan qamrashni, manba xeshini, javob belgisini, qisqalikni va berilgan iqtiboslarni tekshiradi. Bu tekshiruv semantik sifatni avtomatik tasdiqlamaydi; mazmun savol va variantlarni o‘qib tahlil qilish orqali yozilgan.
- 2026-09-22: 44 ichki test va TypeScript tekshiruvi muvaffaqiyatli. Alohida test bazasidagi 12 HTTP oqim testi ham muvaffaqiyatli.
- Mahalliy asosiy bazada 685 nashr qilingan yechim, yechimsiz mavjud savollar soni 0. SQLite yaxlitligi `ok`, tashqi kalit xatosi yo‘q.
- Interfeysning yechimni ochish/saqlash, shaxsiy qayd, papka/teg/muhimlik, arxiv/tiklash, qidirish, qayta yechish, bosh ustoz tahriri va 390 px telefon holati 2026-09-21 da alohida bazada brauzer orqali tekshirilgan. Bu safar mavjud interfeys uchun mazmun to‘ldirildi.
- Mahalliy `http://localhost:3000` bazasi va 2026-09-22 da jonli server yangilandi. Jonli serverda ham 685 yechim tayyor; bosh ustoz katalogiga HTTPS orqali kirish tekshirildi. Tafsilot: `docs/DEPLOYMENT.md`.

Avvalgi o‘zgarishlardan oldingi zaxiralar: `backups/2026-09-21T08-54-38.361Z` va `backups/2026-09-21T09-22-46.152Z-before-solutions.sqlite`. O‘quvchi hisoblari, vazifalari, urinishlari va qaydlari mazmun importida o‘zgartirilmaydi.
