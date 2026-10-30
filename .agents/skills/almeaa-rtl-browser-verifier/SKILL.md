---
name: almeaa-rtl-browser-verifier
description: >-
  Validates Arabic RTL layout, approved platform typography, and responsive rendering
  across three mandatory viewports (390px Mobile, 820px Tablet, 1440px Desktop) using
  Playwright end-to-end browser fixtures against live services.
---

# ALMEAA RTL & Browser Verifier

## الغرض
التحقق الميداني المباشر من صحة العرض باللغة العربية، اتجاه اليمين لليسار (RTL)، تناسق الخطوط الرسمية المخزنة في قاعدة البيانات (`content_platform_font_settings`)، واستجابة الشاشات على ثلاثة مقاسات معتمدة.

## المقاسات الإلزامية للفحص
1. **الجوال (Mobile):** `390x844` (iPhone 14)
2. **التابلت (Tablet):** `820x1180` (iPad Air)
3. **الكمبيوتر المكتبي (Desktop):** `1440x900`

## متطلبات التشغيل
- التأكد من تشغيل الخوادم المحلية:
  - Frontend: `http://localhost:5173`
  - Backend API: `http://localhost:8080`
  - Database: PostgreSQL on 5432
- استخدام أوامر تشغيل اختبارات Playwright:
  ```powershell
  cd c:\almeaago\almeaago\apps\web
  npx playwright test tests/e2e/<spec-name>.spec.ts --project=chromium
  ```

## قواعد التحقق البصري
1. لا يجوز الحكم على تطابق الشاشة دون لقطة شاشة (Screenshot) فعلية من المتصفح.
2. فحص الهيدر والقوائم المنسدلة والتأكد من عدم خروج النصوص خارج الإطار في المقاسات الضيقة (390px).
3. التأكد من حفظ لقطات الشاشة المرجعية داخل `docs/migration/evidence/`.
