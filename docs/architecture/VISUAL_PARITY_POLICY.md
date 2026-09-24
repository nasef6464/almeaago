# Visual & UX Parity Policy

## القرار
الواجهة الحالية لـALMEAA هي المرجع البصري والسلوكي للنسخة الجديدة. تغيير المعمار الداخلي لا يعني إعادة تصميم المنتج.

## يجب الحفاظ على
- بنية الصفحات والتنقل.
- RTL.
- hierarchy والخطوط والمسافات والكروت والجداول والنماذج والـdialogs.
- أماكن الأزرار والإجراءات.
- loading / empty / disabled / error.
- عرض السؤال والصورة والاختيارات والمراجعة.
- لوحات الطالب والمدرسة والإدارة.
- responsive behavior على Mobile/Desktop، وTablet/Projector حيث يلزم.
- النصوص الأساسية ما لم يعتمد تغيير صريح.

## Visual baseline
لكل شاشة حرجة:
- Desktop screenshot.
- Mobile screenshot.
- Tablet/Projector عند الحاجة.
- Actions/role/state inventory.

## Gate
لا تصل الشاشة إلى `PARITY_PROVEN` حتى تنجح الوظيفة والصلاحية والمقارنة البصرية وحالات loading/error/empty.

## ممنوع التحسين الصامت
أي Agent يريد تعديل UX يسجله PROPOSED أو INTENTIONALLY_CHANGED ويحتاج قرارًا صريحًا.
