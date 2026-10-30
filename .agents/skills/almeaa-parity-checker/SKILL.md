---
name: almeaa-parity-checker
description: >-
  Audits visual, structural, and interaction parity between Legacy (nasef6464/almeaacodax)
  and Target (almeaago). Enforces the zero-redesign rule: Legacy is the 100% authoritative
  visual and functional reference. Detects missing buttons, incorrect padding, altered colors,
  moved navigation, or unlinked handlers.
---

# ALMEAA Parity Checker

## الغرض الحاكم
التأكد من أن كل شاشة أو مكون في `almeaago` يطابق نظيره في `nasef6464/almeaacodax/main` بنسبة 100% بصرياً ووظيفياً، ومنع أي محاولة لإعادة التصميم أو التغيير التلقائي.

## متى تُستدعى هذه المهارة
- قبل إغلاق أي شريحة عمل للواجهات.
- عند مقارنة مكون جديد بالمكون القديم.
- عند التحقق من وجود الأزرار الأصلية وحالات الضغط (Hover, Active, Disabled).

## خطوات العمل الصارمة
1. **تحديد المرجع الأصلي:** فحص ملف المكون أو الصفحة في `c:\almeaago\almeaacodax` واستخراج:
   - كافة عناصر الـ DOM والـ JSX.
   - ترتيب القوائم والروابط.
   - النصوص العربية الدقيقة وحالات الرسائل الفارغة (Empty states) وحالات التحميل (Loading).
2. **فحص المكون المستهدف في `almeaago`:** فحص الملف المقابل في `apps/web/src/features/...` ومقارنة:
   - الـ Layout والمسافات والـ Breakpoints.
   - وجود كافة الحقول والأزرار وتوصيلها بالـ Handlers المناسبة.
3. **تصنيف الفروقات:**
   - `VERIFIED`: تطابق تام في العناصر والتفاعل.
   - `PARTIAL`: وجود واجهة لكن مع نقص في الروابط أو التفاصيل البصرية.
   - `MISSING`: غياب الشاشة أو عناصر أساسية منها.
   - `BLOCKED`: تعذر المقارنة بسبب عدم توفر البيانات أو الخدمات.
4. **منع إعادة التصميم:** أي فرق ناتج عن "تحسين مظهر" غير مصرح به يُرفض فوراً وتتم استعادة التصميم الأصلي.
