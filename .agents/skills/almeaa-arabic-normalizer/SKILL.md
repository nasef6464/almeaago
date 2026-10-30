---
name: almeaa-arabic-normalizer
description: >-
  Normalizes Arabic-Indic digits (٠-٩ to 0-9), national ID inputs, phone numbers,
  and handles Arabic Unicode text length and Mojibake sanitization across login,
  forms, and database writes.
---

# ALMEAA Arabic Normalizer & Text Sanitizer

## الغرض
معالجة وتطبيع مدخلات ومخرجات النصوص والأرقام العربية في كافة طبقات النظام (الواجهة الأمامية، وسيط HTTP، وقاعدة البيانات).

## القواعد والتطبيقات
1. **تطبيع الأرقام الهندية المشرقية (Arabic-Indic Normalization):**
   - تحويل فوري لأي أرقام مدخلة بصيغة `٠١٢٣٤٥٦٧٨٩` إلى الصيغة القياسية `0123456789`.
   - يطبق على: حقول تسجيل الدخول الذكي، رقم الهاتف، رقم الهوية الوطنية، والرموز السرية (OTP).
2. **التحقق من رقم الهوية الوطنية:**
   - 10 أرقام تبدأ بـ 1 أو 2، مع التحقق بعد التطبيع.
3. **معالجة التشفير العربي (Mojibake Sanitization):**
   - منع وتصحيح أي تشفير مزدوج مثل `Ø§Ù„Ù…Ø¦Ø©` واستعادة النص العربي الأصلي `المئة`.
   - التحقق من حدود أطوال الأسماء العربية بحساب عدد المحارف الفعلي وليس عدد البايتات فقط (`utf8.RuneCountInString`).
