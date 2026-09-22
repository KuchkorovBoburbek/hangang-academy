# Serverdagi HangangAcademy

Birinchi ishga tushirish: 2026-09-19. Oxirgi yangilanish: 2026-09-22 (Koreya vaqti).

- Sayt: https://hangang.3.37.181.144.sslip.io
- Telegram: https://t.me/hangang_academy_bot
- Server: `ubuntu@3.37.181.144`
- Loyiha: `/opt/hangang-academy`
- Xizmatlar: app, worker, backup. Image: `hangang-academy:20260922` (linux/amd64).
- Mavjud Coolify Traefik proksisi va uning Let's Encrypt sertifikat boshqaruvi ishlatiladi. Ilovaning 3000-porti internetga alohida ochilmagan.
- Serverda yangi baza va alohida kuchli admin paroli yaratilgan; mahalliy demo bazasi ko‘chirilmagan.
- Admin kirish ma’lumoti faqat foydalanuvchi kompyuteridagi `academy-app/.deploy/ACCESS.txt` ichida. Server maxfiy sozlamalari `/opt/hangang-academy/.env`, ruxsat 0600.

## Ishlatish

Serverda loyiha papkasidan:

```bash
sudo docker compose -f compose.yaml -f compose.server.yaml ps
sudo docker compose -f compose.yaml -f compose.server.yaml logs --tail 50 app worker backup
sudo docker compose -f compose.yaml -f compose.server.yaml up -d --no-build --wait
```

Docker qayta ishga tushganda xizmatlar avtomatik tiklanadi. Kundalik backup oxirgi 7 to‘liq nusxani shu serverda saqlaydi. Qo‘lda zaxira:

```bash
sudo docker compose -f compose.yaml -f compose.server.yaml exec -T app npm run backup
```

`academy-data` va `academy-backups` named volume’larini o‘chirmang. Yangilashdan oldin backup oling. Restore paytida app, worker va backup xizmatlarini to‘xtating; boshqa loyihalarning konteynerlariga tegmang. To‘liq restore tartibi README’da.

## Telegram

Webhook va bot menyusidagi HangangAcademy tugmasi real HTTPS manziliga bog‘langan. Ustoz saytga yangi admin hisobida kirib, **Sozlamalar → Telegram’ni ulash** orqali o‘z Telegram hisobini bog‘laydi. Shundan keyin yangi yozma ishlar haqidagi xabarlar unga keladi. Mahalliy demo hisobining Telegram ulanishi server hisobiga ko‘chmaydi.

## O‘z domeningizga o‘tish

1. Yangi domenning A yozuvini server IP manziliga yo‘naltiring.
2. Server `.env` faylida `APP_URL=https://yangi-domen` va `ACADEMY_HOST=yangi-domen` qiymatlarini yangilang.
3. Yuqoridagi `up -d --no-build --wait` buyrug‘i bilan xizmatlarni yangilang.
4. Yangi HTTPS manzili ishlagach Telegram’ni yangilang:

```bash
sudo docker compose -f compose.yaml -f compose.server.yaml exec -T app node --import tsx scripts/setup-telegram.ts
```

Hozirgi vaqtinchalik manzil serverning joriy IP manziliga va sslip.io DNS xizmatiga bog‘liq. Server IP’si o‘zgarsa manzil ham yangilanishi kerak. O‘z domeniga o‘tishda o‘quvchi ma’lumotlari named volume’da saqlanib qoladi.

## Tekshiruv natijalari

### Qayta deploy — 2026-09-22

- 44 ichki test, 12 HTTP oqim testi, TypeScript, Next.js va linux/amd64 Docker yig‘ish tekshiruvlari o‘tdi.
- Server bazasining nusxasida yangilanish oldindan sinovdan o‘tkazildi. Jonli almashtirishdan oldingi to‘liq zaxira: `/app/backups/2026-09-22T05-30-15.848Z`.
- TOPIK bazasi: 685 mavjud savol (574 asl va 111 grammatika mashqi), 685 yechim, 291 so‘z, 43 ibora va 12 mock. Har mockda 48 baholanadigan savol bor; 42–43 tashlab ketiladi.
- Ilova boshlanishida `db:seed` va `db:topik` bajariladi. Takroriy import mavjud urinishlar va bosh ustoz tahrirlarini saqlaydi.
- Jonli HTTPS saytda admin kirishi, Secure/HttpOnly cookie, bosh ustoz yechim tahririga ruxsati, katalog, lug‘at, iboralar, 685 tayyor yechim va savol rasmi tekshirildi. HTTP → HTTPS yo‘naltirish ishlaydi.
- SQLite yaxlitligi `ok`, tashqi kalit xatolari 0. Jonli bazadagi avvalgi yozuvlar zaxiradagi asl ustunlar bilan solishtirildi; yuklangan faylning SHA-256 izi ham bir xil. Hisoblar, guruhlar, topshiriqlar, quizlar, takrorlashlar, qaydlar, yozma ishlar va fayllar saqlangan. Admin paroli va integratsiya kalitlari o‘zgartirilmagan.
- Telegram webhook va ilova menyusi manzili tasdiqlandi: navbatda 0 yangilanish, yetkazish xatosi yo‘q.
- Ushbu qayta deployda pullik AI so‘rovi va o‘quvchilarga Telegram xabari yuborilmadi. OpenRouter va Telegram sozlamalari mavjud.
- Yangilanishdan keyin app ~92 MiB, worker ~81 MiB, backup ~37 MiB ishlatdi. Server diskining 90% band (taxminan 1.9 GiB bo‘sh); kelgusi yirik yangilanishlar va fayllar ko‘payishidan oldin diskni kengaytirish tavsiya etiladi. Qaytish uchun avvalgi image saqlangan.
- Avvalgi image va sozlamalar `/opt/hangang-academy/.releases/20260922/` orqali qayta tiklanishi mumkin. Undagi `previous.env` maxfiy, 0600 ruxsatli; uni ochiq joyga ko‘chirmang. Baza migratsiyasi qo‘shimcha jadvallar/ustunlardan iborat; backup’ni tiklashdan oldin yangilanishdan keyingi yozuvlarni ham hisobga oling.

### Dastlabki deploy — 2026-09-19

- Haqiqiy HTTPS sertifikati bilan tashqi health tekshiruvi o‘tdi.
- Real saytda admin login, Secure/HttpOnly cookie, yangi o‘quvchi, quiz, shaxsiy qayd, PNG/PDF topshirish va ustoz izohi sinovdan o‘tdi.
- Serverdagi AI navbati va worker haqiqiy OpenRouter so‘rovini yakunladi; nashr qilingan ustoz izohi o‘zgarmadi.
- Telegram webhook tasdiqlandi; pending update 0 va yetkazish xatosi yo‘q. Bot menyusidagi URL tekshirildi. Tasdiqlangan, xabar yaratmaydigan webhook sinovi 200 qaytardi.
- Saytning kirish sahifasi brauzerda ko‘rildi. Real o‘quvchi xabarlari yuborilmadi.
- Ishga tushishdan keyin xotira taxminan: app 139 MiB, worker 80 MiB, backup 37 MiB. Server 2 vCPU va 2 GiB RAM; 100 bir vaqtdagi faol foydalanuvchi yuklama sinovi hali bajarilmagan.
- Haqiqiy qo‘lyozma sifatini kichik guruh bilan tekshirish va backup’larni boshqa joyga ham nusxalash keyingi ishlar.
