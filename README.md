# Marketing.Uz — mustaqil v2 (Lovable kreditisiz)

Bu **real ishlaydigan mahalliy sinov MVP**. Node.js 22.13+ bilan tashqi npm paketlarisiz ishlaydi. Bozorim.Uz / Lovable saytining asl domenini va uning kodini **avtomatik yangilamaydi**. Oldingi ma'lumotlar bazasi ham bu paketga ko'chirilmagan.

## Ishga tushirish

1. [Node.js](https://nodejs.org/) **22.13 yoki yangi** versiyasini o'rnating.
2. ZIP faylni oching, `MarketingUz_v2` papkasiga kiring.
3. Terminalda quyidagini bajaring:

```bash
node server.mjs
```

4. Brauzerda **http://localhost:3000** sahifasini oching.

**Windows:** ZIP'ni ochib, papka ichida terminal (PowerShell / CMD) oching va `node server.mjs` yozing. Bitta terminal ochiq tursin.

### Sinovda SMS kodi

Mahalliy sinov rejimida haqiqiy SMS yuborilmaydi. `Kod yuborish` tugmasini bossangiz, terminalda **`LOCAL DEMO OTP (+998...): 123456`** kabi kod chiqadi. Shu kodni brauzerga kiriting. Ommaviy serverda SMS provaydersiz ishlatish **taqiqlangan**; `NODE_ENV=production` bo'lsa, SMS konfiguratsiyasiz server ishga tushmaydi.

### QR kodli sertifikat

QR kod yaratish uchun Python 3 va `qrcode` kerak. Terminalda: `python -m pip install qrcode` (Windows) yoki `python3 -m pip install qrcode`. Python topilmasa sertifikatning tekshiruv havolasi baribir ishlaydi, faqat QR rasmi ko'rinmasligi mumkin.

## Nimalar ishlaydi

- Marketing.Uz nomi va oltin globus logosi; avvalgi qoramtir turkum, oq/mint **Tonggi rejim**. Tanlov brauzerda saqlanadi.
- **Loyiha asoschilari** — Xabibullayev Abubakrsiddiq, Abdulvohidov Abdurahmon, Bilolxon.
- Oddiy sotuvchi yoki do'kon sifatida ro'yxatdan o'tish; nickname cheklovi; mahalliy SMS demo; parol `scrypt` orqali xeshlangan; `HttpOnly` cookie.
- Ikki xil shartnoma, bosiladigan rozilik muhri, bazaga qayd va tasdiqlash QR sertifikati. Bu **sotuvchi halolligi kafolati emas**.
- Avatar/banner, Follow/Unfollow, profil, admin tomonidan tekshirilgan do'kon belgisi.
- Haqiqiy e'lon qo'yish: narx, marka, model, hudud, holat, batareya %, ta'mir tarixi, ko'pi bilan 4 ta rasm, qidiruv/filtr, sevimlilar, shikoyat, mahsulotlarni taqqoslash va real e'lonlardan median narx (kamida 3 ta bo'lsa).
- **Telefon IMEI1, IMEI2**: 15 raqamli Luhn tekshiruvi; maxfiy server-side `HMAC-SHA256` xeshlari; xaridorga faqat oxirgi 4 raqam; bir IMEI bilan bir vaqtning o'zida ikkita faol e'longa yo'l qo'yilmaydi. IMEI asl egasi ekanini tasdiqlamaydi.
- E'lon egasi `Sotildi` ni bosib, IMEI'ni **qayta kiritadi**; egasi serverda tekshirilmasa, e'lon o'zgarmaydi. Sotilgan e'lon faol ro'yxatdan yo'qoladi, tarixda saqlanadi. Begona odam faqat IMEI'ni bilishi bilan e'lonni boshqara olmaydi.
- **IMEI haqiqiy davlat / o'g'irlanganlik tekshiruvi** bu yerda YO'Q: rasmiy tekshiruv uchun [uzimei.uz](https://uzimei.uz) ga yo'naltiriladi. Format tekshiruvi xavfsiz qurilma degani emas.
- **Admin** faqat foydalanuvchi allaqachon ro'yxatdan o'tganidan keyin, loyiha egasi tayinlagan ID bo'yicha beriladi; eng ko'pi bilan **10 faol admin**; boshqa akkaunt o'zi rolini o'zgartira olmaydi. Bloklash, do'kon tekshiruvi, audit va rolni bekor qilish.

## Birinchi egani tayinlash (faqat o'zingiz boshqaradigan lokal serverda)

Hech kim avtomatik admin emas. **Avval** o'z telefoningiz bilan odatiy sotuvchi yoki do'kon akkaunti oching. So'ng terminalda bitta marta bajariladi:

Linux/macOS:
```bash
OWNER_PHONE='+998901234567' npm run grant-owner
```

Windows PowerShell:
```powershell
$env:OWNER_PHONE='+998901234567'; npm run grant-owner
```

`+998901234567` o'rniga o'zingiz ro'yxatdan o'tgan telefonni yozing. Kodda **hech qanday tayyor admin parol yo'q**. Keyingi adminlar loyiha egasining admin paneli orqali **akkaunt ID** bo'yicha qo'shiladi; maksimal 10 kishi (owner ham shu limit ichida). Amallar audit jurnaliga yoziladi.

## Sinovlarni ishlatish

```bash
npm test
```

Integratsion testlar yangi vaqtinchalik SQLite bazada ishlaydi va quyidagilarni tekshiradi: asosiy sahifa, ro'yxatdan o'tish, maxfiy telefon, IMEI mosligi/takrorni cheklash, faqat e'lon egasi `Sotildi` qila olishi va admin rolini oddiy foydalanuvchi tayinlay olmasligi.

## Production uchun majburiy ishlar

1. HTTPS reverse proxy/hosting, doimiy disk, backuplar, monitoring. SQLite sinov va kichik trafik uchun; ko'p foydalanuvchida boshqariladigan DB va xavfsizlik auditini o'tkazing.
2. `NODE_ENV=production`, `OTP_SECRET` (32+), `IMEI_HMAC_SECRET` (32+), `SMS_WEBHOOK_URL` va `SMS_WEBHOOK_TOKEN`, `PUBLIC_BASE_URL=https://sizning-domeningiz` kerak. Kalitlar almashsa, oldingi IMEI xeshlari bilan moslashtirish ishlamay qoladi — kalitni zaxira qiling va himoyalang.
3. Hozirgi demo admin 2FA umumiy `ADMIN_TOTP_SECRET` sozlamasiga tayangan: bu **ommaviy 10 adminli tizim uchun yetarli emas**. Har admin uchun alohida kuchli 2FA, qurilma/session boshqaruvi va ruxsat auditini productiondan oldin implement qiling.
4. Rasmlar va foydalanuvchi kontentini yaxshiroq sanitizatsiya qilish, faylni qayta kodlash, CSP va security pen-testing; akkauntni qayta tiklash mexanizmi.
5. SMS uchun rasmiy provayder, IMEI o'g'irlanganlik bazasiga kirish uchun **rasmiy ruxsatli API**, onlayn to'lov/escrow uchun **litsenziyalangan** to'lov hamkori zarur. Bu imkoniyatlar ulangan deb ko'rsatilmasligi kerak.
6. Maxfiylik va majburiyatnomalar huquqshunos tomonidan ko'rib chiqilsin. Sertifikat hukumat yoki notarius tasdig'i emas.
7. `Marketing.Uz` domenining huquqiy mavjudligi/mulkdorligi alohida tekshirilsin. Ushbu ZIP hech qanday domenni sotib olmagan yoki internetga joylamagan.

## Ma'lumotlar qayerda?

- Baza: `data/marketing.sqlite` (ishlagandan keyin yaratiladi)
- IMEI sirli indeks kaliti (mahalliy): `data/.imei-hmac-key`
- Yuklangan rasmlar: `uploads/`

Bu papkalarni, parollarni, tokenlarni va shaxsiy ma'lumotlarni ommaga tarqatmang, GitHub'ga yuklamang; `.gitignore` ularni cheklaydi.

**Hozircha kiritilmagan:** Cetizen'ning barcha xususiyatlari, tranzaksiya va haqiqiy pul himoyasi, real vaqt IMEI o'g'irlanganlik tekshiruvi, AI orqali erkin chat, brend/model katalogining to'liq ma'lumotlari, savdo tarixini bank tasdiqlashi. Bularni rasmiy integratsiyalar va huquqiy tekshiruvlardan keyin qo'shish mumkin.
