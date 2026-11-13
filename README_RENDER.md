# Marketing.Uz — Render'ga xavfsiz demo joylashtirish

Bu paket real savdo serveri emas, **faqat ko‘rish uchun demo**. Ro‘yxatdan o‘tish, shaxsiy telefon/IMEI yuborish va e’lon joylash ataylab o‘chirilgan.

## Nega cheklangan?
Render Free xizmatida SQLite va yuklangan fayllar qayta ishga tushganda yo‘qoladi. Demo toza ma’lumotlar bazasi bilan ishga tushadi. Real savdoda doimiy PostgreSQL/object storage, xavfsiz SMS provayder, individual admin 2FA va yuridik/texnik audit zarur.

## Render orqali ishga tushirish
1. ZIP arxivini oching va **MarketingUz_Render_demo** papkasidagi fayllarni yangi, xususiy GitHub repozitoriysiga yuklang. `render.yaml` va `Dockerfile` repozitoriy ildizida bo‘lsin. `data/` va `uploads/` ni GitHub'ga yuklamang.
2. Render Dashboard → **New → Blueprint** → GitHub repozitoriyingizni tanlang → **Apply**. Blueprint `marketing-uz-demo` nomli bepul Docker web service tayyorlaydi.
3. Build yakunlangach Render `https://<sizning-servisingiz>.onrender.com` manzilini beradi; aniq URL faqat deploy qilingandan keyin paydo bo‘ladi.
4. URL ochib Marketing.Uz dizayni va IMEI ma’lumotini *faqat brauzerda* tekshiradigan bo‘limni ko‘ring. Serverga telefon/IMEI yuboradigan amallar bloklangan.

## Muqobil
Render → New → Web Service → GitHub repository → Environment: **Docker**, Instance: **Free**, Health Check: `/health`, Environment variables: `NODE_ENV=production`, `PUBLIC_DEMO_READONLY=1`, `IMEI_HMAC_SECRET` (kamida 32 belgili sirli token) bo‘lishi shart. Blueprint bu qiymatni o‘zi yaratadi.

## Tekshirish
`npm test` — lokal sinovlar; `NODE_ENV=production PUBLIC_DEMO_READONLY=1 IMEI_HMAC_SECRET=<kamida-32-belgili-sir> node server.mjs` — demoni mahalliy sinab ko‘rish. Health endpoint `/health` → `{"status":"ok"}`.

Render Free foydalanuvchisining faoliyatsizligidan keyin sekin ochilishi mumkin; batafsil rasmiy hujjatlar: https://render.com/docs/free

**Admin, SMS va IMEI haqiqiy davlat tekshiruvi bu ommaviy demoda ishlamaydi.** Rasmiy tekshiruv havolasi `https://uzimei.uz` bo‘lib qoladi.
