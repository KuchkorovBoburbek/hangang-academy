# O‘rganish tajribasi — qabul qilingan bosqichlar

1-taklif keyinchalik qabul qilindi: qisqa TOPIK yechimlari, bosh ustoz tahriri, faqat o‘quvchi so‘raganda ochish va daftarga saqlash. Joriy holat: [SOLUTION-AUTHORING.md](SOLUTION-AUTHORING.md).

- [x] 1. 685 ta qisqa TOPIK yechimi, javobdan keyin ixtiyoriy ochish, bosh ustoz tahriri va tartiblangan daftarga saqlash. Yechimlar tashqi AI xizmatiga yuborilmasdan yozildi.

- [x] 2. TOPIK xatolari, ikkilangan javoblar, so‘z va iboralar uchun saqlanadigan takrorlash.
- [x] 3. 10/20/30 daqiqalik shaxsiy kunlik reja.
- [x] 4. TOPIKni umumiy natijalar va grammatika kutubxonasiga bog‘lash.
- [x] 5. Grammatika mini-darslari va kunlar bo‘yicha o‘zlashtirish.
- [x] 6. Natija matnidagi lug‘at, saqlash va gapni to‘ldirish.
- [x] 7. Mock tur/vaqt tahlili, avval ko‘rilgan savollarni ajratish.
- [x] 8. Mobil o‘qish qulayligi va ustozning maqsadli TOPIK topshiriqlari.

Mahalliy ilovada amalga oshiriladi; jonli serverga tarqatilgani alohida qayd etiladi.

## Joriy imkoniyatlar

- TOPIKdagi xato/javobsiz va «Ikkilandim» javoblar yakunda avtomatik rejalashtiriladi. Kartadagi baholar ham hisobda saqlanadi. Bosqichlar 1/2/4/7/14/30 kun; bir kunda qayta-qayta javob berish bosqichni sun’iy oshirmaydi. Oldingi yakunlangan TOPIK urinishlari bir marta tarixga olinadi.
- Kunlik reja foydalanuvchi sanasi va 10/20/30 daqiqalik tanloviga saqlanadi. Vaqti kelgan / hali o‘rganilmagan so‘zlar, kamida 4 javob kuzatilgan zaif savol turi va grammatika mashqi tanlanadi. Davom etish o‘sha urinishni ochadi. Vaqt taxminiy.
- Bosh sahifa va ustoz ko‘rsatkichlariga TOPIK qo‘shildi. So‘z kartalari faollikka kiradi, ammo o‘zini baholash natijasi test aniqligi foiziga aralashtirilmaydi. Grammatika kutubxonasidagi 111 band tegishli TOPIK savoliga ulanadi.
- Mini-darslar mavjud tekshirilgan qo‘llanma mazmunini ishlatadi: ma’no, qoida/ogohlantirish, tarjimani ochib ko‘rish, eslash mashqi va ikki shaklni taqqoslash. O‘zlashtirish alohida kunlardagi to‘g‘ri javoblardan hisoblanadi; xato/ikkilanish hisobni qayta boshlaydi. Dars oynasini ochish natija hisoblanmaydi.
- Tugatilgan savollar matnidagi aniqlangan lug‘at birliklari bosiladi. Lug‘aviy ma’no, matndagi shakl va tegishli jumla ko‘rinadi; so‘zni takrorlashga qo‘shish va o‘quv misolidagi bo‘shliqni to‘ldirish mumkin. Bu barcha koreyscha shakllarni taniydigan morfologik tahlilchi emas; belgilangan lug‘at va kuzatilgan shakllar ishlatiladi.
- Natijada har tur bo‘yicha to‘g‘ri javob/vaqt va mos mashqqa o‘tish bor. Birinchi marta berilgan savollar oldin berilganlardan alohida hisoblanadi. Eski urinishlar uchun yozilmagan ko‘rilganlik/vaqt ma’lumoti taxmin qilinmaydi. Faol oyna va ko‘rinib turgan savol uchun vaqt yoziladi; texnik kechikishlarda bu taxminiy o‘qish vaqti.
- Telefon uchun uch matn o‘lchami, diqqat rejimi, matnga qaytish va fokus holatida ham yakunlash bor. Ustoz oxirgi 30 kunning zaif turlari/so‘zlarini ko‘rib, o‘z guruhiga belgilangan muddatli mashq beradi; o‘quvchi bosh sahifadan bajaradi; ustoz bajarilganlar sonini ko‘radi.

42–43 bo‘sh qolishi, haqiqiy savollarni mocklar orasida takrorlash mumkinligi va mockning 48 baholanadigan savoli siyosati o‘zgarmagan. Audio/쓰기 ishlari bu bosqichga kirmaydi.

## Yakuniy tekshiruv — 2026-09-21

- 34 ichki test, 11 HTTP oqim testi, tur tekshiruvi va ishlab chiqarish yig‘ilishi muvaffaqiyatli.
- Alohida sinov bazasida brauzer orqali: kunlik reja/kartalar, ikkilanishni saqlash, 390 px telefon ko‘rinishi, diqqat rejimi, grammatika bosqichlari va solishtirish, matndagi lug‘at/bo‘shliq mashqi, natija tahlili, ustozdan maqsadli vazifa va o‘quvchining uni ochishi tekshirildi. Brauzer xatosi qayd etilmadi.
- O‘zgartirishdan oldingi zaxira: `backups/2026-09-21T08-09-44.474Z`. Mavjud o‘quvchilar, guruhlar, vazifalar, topshirilgan ishlar, qaydlar va TOPIK manbalari saqlangan. SQLite yaxlitligi to‘g‘ri, tashqi kalit xatosi yo‘q.
- `http://localhost:3000` yangi versiyada ishlaydi. Jonli serverga tarqatilmagan.
