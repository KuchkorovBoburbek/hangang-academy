# Google Cloud deploy

Loyiha `codex/anvarjon-work` branchidan Google Compute Engine serveriga Docker Compose orqali joylanadi.

- Project: `project-2a2690ee-0b76-4795-a36`
- Region / zone: `asia-northeast3` / `asia-northeast3-a` (Seul)
- VM: `hangang-academy`, `e2-medium`, Debian 12
- Doimiy IP: `34.50.15.119`
- Sayt: https://hangang.34.50.15.119.sslip.io
- Kod: `/opt/hangang-academy/releases/`; faol versiya: `/opt/hangang-academy/current`
- SQLite, yuklangan fayllar, backup va TLS sertifikatlari: alohida 20 GB persistent disk, `/srv/hangang-academy`
- Maxfiy sozlamalar: `/srv/hangang-academy/.env` (0600), Git va Docker image ichiga kirmaydi.

## Keyingi o‘zgarishlarni deploy qilish

Birinchi marta Google Cloud CLI bilan `gcloud auth login` qiling. `academy-app/.deploy/gcp.env` ichiga `deploy/gcp/config.env.example` nusxasini qo‘ying; kerak bo‘lsa SSH user/key ni o‘zingiznikiga moslang. `.deploy/` Git’dan chiqarilgan.

```bash
cd academy-app
git switch codex/anvarjon-work
# Kodni o‘zgartirib, tegishli test/build bilan tekshiring.
git add <ozgartirilgan-fayllar>
git commit -m "O‘zgarish tavsifi"
git push origin codex/anvarjon-work
npm run deploy:gcp
```

Buyruq aynan joriy commitni yuboradi. Commit qilinmagan o‘zgarishlar bo‘lsa to‘xtaydi. Maxfiy kalitlar va mahalliy baza yuborilmaydi. Server yangi image’ni avval yig‘adi, faol bazadan backup oladi, keyin app/worker/backup xizmatlarini almashtiradi. Health tekshiruvi o‘tmaganda avvalgi image qayta ishga tushadi. Faol xizmat almashtirilganda qisqa tanaffus bo‘ladi. Bir vaqtning o‘zida faqat bitta deploy bajariladi.

Oddiy deploy bazani import qilmaydi va almashtirmaydi. Faqat dasturning mavjud, takroran xavfsiz seed/import va schema migratsiyalari ishlaydi. Kelajakdagi destructive schema o‘zgarishlarini alohida tekshirish kerak.

## Xizmatlar va zaxira

Serverga kirib:

```bash
cd /opt/hangang-academy/current
sudo docker compose --env-file /srv/hangang-academy/.env --env-file deploy.env -f compose.gcp.yaml ps
sudo docker compose --env-file /srv/hangang-academy/.env --env-file deploy.env -f compose.gcp.yaml logs --tail 80 app worker backup proxy
sudo docker compose --env-file /srv/hangang-academy/.env --env-file deploy.env -f compose.gcp.yaml exec -T app npm run backup
```

Backup xizmati har kuni SQLite’ning yaxlitligi tekshirilgan nusxasi va biriktirilgan fayllarni saqlaydi; oxirgi 7 kun saqlanadi. Google Cloud disk snapshot schedule ham kuniga bir marta ishlaydi, 7 kun saqlaydi. VM o‘chirilganda ma’lumot diski avtomatik o‘chmaydi. Snapshot disk holatini oladi; ilova backup’i SQLite va fayllar uchun izchil nusxani ta’minlaydi. Birinchi Cloud snapshot reja vaqti kelganda yaratiladi.

Oldingi kod versiyasiga qaytish uchun `/opt/hangang-academy/previous` ichidagi `deploy.env` va `compose.gcp.yaml` bilan `up -d --wait` ishlating. Bu faqat kodni qaytaradi; database’ni avtomatik eski nusxaga qaytarmaydi. To‘liq restore oldidan yangi yozuvlarni ham zaxiralang, app/worker/backup xizmatlarini to‘xtating, tasdiqlangan backup’dagi baza va uploads’ni birgalikda tiklang.

## Yangi serverni tayyorlash

`hangang-data` device-name bilan ajratilgan persistent diskni ulang. `deploy/gcp/bootstrap.sh`ni root sifatida bajaring. U Docker o‘rnatadi, faqat shu nomli yangi bo‘sh diskni ext4 formatlaydi, mount va Docker’ning mountga bog‘liqligini sozlaydi. Mavjud ext4 diskni qayta formatlamaydi. Birinchi deploy oldidan production `.env` va kerakli boshlang‘ich backup’ni xususiy kanal bilan ko‘chiring. Buni keyingi deploylarda takrorlamang.

80/443 tashqariga ochiq; 3000 faqat Docker tarmog‘ida. Caddy HTTPS sertifikatini avtomatik oladi va yangilaydi. O‘z domeniga o‘tilsa DNS A yozuvini doimiy IP’ga yo‘naltiring, `.env` ichida `ACADEMY_HOST` va `APP_URL`ni yangilang, deploy qiling, so‘ng `scripts/setup-telegram.ts`ni app konteynerida bajaring.

Google Cloud VM, disk, IP va snapshotlar hisobingiz bo‘yicha doimiy xarajat qiladi.
