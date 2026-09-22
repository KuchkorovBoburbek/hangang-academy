# Lug‘at markazi — 2026-09-22

Holat: mahalliy loyihada tayyor. Hozircha jonli serverga chiqarilmagan: saytning HTTPS health manzili javob beradi, ammo `3.37.181.144:22` SSH ulanishi ikki urinishda vaqt chegarasidan o‘tdi. Quyidagi imkoniyatlar yangi image bilan deploy va Telegram webhook sozlamasi yangilangach jonli botda ishlaydi.

## O‘quvchi

`/vocabulary` — umumiy Lug‘at markazi. Avval TOPIK 읽기 / 쓰기 / 듣기, so‘ng savollar diapazoni tanlanadi. Har bo‘limda so‘zlar va iboralar, qidirish, kartalar, jadval va takrorlash mashqi mavjud. Eski umumiy so‘zlar 읽기 ichidagi “Umumiy so‘zlar”da saqlangan. Eski asosiy lug‘at quizlari va shaxsiy daftar qaydlari ham mavjud.

읽기 tarkibidagi lug‘at/ibora tablari ko‘chirildi. Eski `/topik/vocabulary` va `/topik/idioms` havolalari yangi manzilga yo‘naltiriladi. Savol ichida so‘z ma’nosini ochish davom etadi. 쓰기 va 듣기 uchun sun’iy tayyor bank qo‘shilmadi; ustoz so‘z kiritgach ular to‘ladi. 듣기 diapazonlari qulay sonli guruhlar bo‘lib, rasmiy savol turlarini tasniflash da’vosi emas.

## Ustoz

Ustoz menyusida Lug‘at bor. Har mavjud so‘z yoki iboraning koreyschasi, ma’nosi, so‘z turkumi, misoli, tarjimasi, bo‘limi va diapazonlarini tahrirlash mumkin. Tahrir versiya bilan himoyalangan: boshqa oynadagi o‘zgarishni bilmasdan bosib ketish 409 xatosi bilan to‘xtatiladi. Tahrirlar asl JSON bankni o‘zgartirmasdan alohida saqlanadi va keyingi TOPIK importida yo‘qolmaydi. Avvalgi quiz savollari/urinishlari qayta yozilmaydi.

Yangi so‘z qo‘lda yoki AI yordamida qo‘shiladi. Har safar ustozga tegishli guruhlar tanlanadi. Yangi so‘zlar faqat o‘sha guruhlar o‘quvchilariga ko‘rinadi; umumiy eski bank barcha o‘quvchilar uchun qoladi. Ustozlar mavjud lug‘atlarni tahrirlashi mumkin.

AI yordamchi koreyscha matn yoki bitta JPG/PNG/WebP rasmni oladi. Rasm 5 MB, matn 10 000 belgi, bir so‘rov 40 so‘z bilan cheklangan. Bir ustozga bir vaqtda 2 faol so‘rov, kuniga 30 ta yuborish/qayta urinish mumkin. Avvalgi AI provider/model sozlamasi ishlatiladi; yangi API kaliti kerak emas. So‘rov model va providerga biriktiriladi.

Aniq so‘zlar o‘zbekcha ma’no, so‘z turkumi, koreyscha misol va tarjima bilan avtomatik saqlanadi. O‘qilishi noaniq so‘zlar taxmin qilinmaydi va natijada alohida beriladi. Xuddi shu bo‘lim va auditoriyaga mavjud so‘z takror kiritilmaydi. Eski so‘zning ma’nosi AI import orqali bosib ketilmaydi; ustoz Tahrirlash orqali yangilaydi. Noto‘liq yoki talabga mos kelmagan AI javobi bazaga kiritilmaydi.

Saqlash va o‘quvchilarga bildirishnoma navbati bitta baza tranzaksiyasida bajariladi. Faqat muvaffaqiyatli qo‘shilgan yangi so‘zlar uchun xabar yaratiladi. Ustozga barcha saqlangan so‘zlar va aniqlashtirish kerak bo‘lgan qismlar Telegram orqali yuboriladi; uzun natija bo‘lib yuboriladi. Telegram’i bog‘lanmagan foydalanuvchiga bot xabar yetkaza olmaydi. Ustoz saytning AI so‘rovlarim qismida ham natijani ko‘radi.

## Telegram

1. Ustoz saytga kirib, Sozlamalar → Telegram orqali o‘z hisobini bog‘laydi.
2. Botga `/lugat` yuboradi.
3. Tugmalardan 읽기/쓰기/듣기, savollar diapazoni va bir yoki bir nechta guruhni tanlaydi.
4. “Tanlov tayyor”ni bosib, koreyscha so‘zlar yoki bitta rasm yuboradi. JPG/PNG/WebP rasm hujjat sifatida ham qabul qilinadi; PDF bu lug‘at yordamchisiga kiritilmagan.
5. Natija avtomatik saqlanadi, ustozga xulosa va tanlangan guruhlarga yangi so‘zlar xabari boradi.

Tanlov 24 soat amal qiladi. `/lugat` tanlovni yangilaydi; `/bekor` yoki `/cancel` kiritishni tugatadi. `/bekor` avval navbatga olingan so‘rovni bekor qilmaydi. Faqat bog‘langan ustozning shaxsiy chatidan ishlaydi; guruh chatlari va o‘quvchi hisoblari so‘z qo‘sha olmaydi. Takror kelgan Telegram update bitta AI so‘roviga aylanadi.

Webhook endi `message` va `callback_query` yangilanishlarini qabul qilishi kerak. Yangi image ishga tushgach:

```bash
sudo docker compose -f compose.yaml -f compose.server.yaml exec -T app node --import tsx scripts/setup-telegram.ts
```

Bot natija va tugmalarini doimiy `worker` yetkazadi. Sayt yoki botdan yuborilgan so‘rovlar shu worker orqali ketadi. Lokal ishlatishda `npm run dev` yonida `npm run worker` ham ishlab turishi kerak. Uzilgan pullik AI so‘rovlari avtomatik takrorlanmaydi; ustoz holatni tekshirib, qayta yuboradi.

## Saqlash va tekshirish

Schema 11 qo‘shimcha jadvallar yaratadi: `vocabulary_entries`, `vocabulary_edits`, `vocabulary_revisions`, `vocabulary_jobs`, `vocabulary_bot_state`, `vocabulary_bot_updates`. O‘quvchi, urinish va fayllar o‘chirilmaydi. AI uchun yuborilgan rasm bazada saqlanadi, shu sabab mavjud SQLite backup uni ham qamrab oladi. Muvaffaqiyatli so‘rovdan so‘ng rasm darhol, muvaffaqiyatsiz so‘rovdan 7 kun o‘tgach tozalanadi.

- 53 unit/integration tests: yangi bo‘limlar, tahrirni importdan keyin saqlash, guruh chegaralari, takrorlash, topshiriqlar, bildirishnoma, AI idempotent navbati, noto‘liq AI javobi, rasm, Telegram wizard va xavfsiz fayl yuklash.
- 15 ta HTTP va desktop/mobile brauzer testi muvaffaqiyatli o‘tdi. Sinovlar `tests/http/vocabulary.spec.ts`da. Chrome o‘rnatilgan kompyuterda `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e`; aks holda Playwright Chromium o‘rnatilgan bo‘lishi kerak.
- Haqiqiy OpenRouter `openai/gpt-6-astra` bilan 3 matn so‘zi va 2 so‘zli sun’iy rasm muvaffaqiyatli tekshirildi. Koreyscha misol va o‘zbekcha tarjimalar ko‘rildi. Sinov natijalari o‘quvchilar bazasiga kiritilmadi, real Telegram xabarlari yuborilmadi.

Texnik manbalar: [Telegram Bot API](https://core.telegram.org/bots/api), [OpenRouter structured outputs](https://openrouter.ai/docs/guides/features/structured-outputs). Bu manbalar ulanish formatlari uchun tekshirildi; lug‘at mazmuni ulardan olinmadi.

Docker image tayyor: `hangang-academy:20260922-vocabulary` (`linux/amd64`). Serverning avval olingan zaxira nusxasida yangi sxema va import sinaldi: eski jadvallardagi har bir yozuvning asl ustunlari o‘zgarmagan, SQLite yaxlitligi `ok`. Mahalliy bazaning qo‘shimcha zaxirasi: `backups/2026-09-22T08-46-39.683Z`.
