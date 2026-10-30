---
name: almeaa-db-migrator
description: >-
  Verifies database schema integrity, foreign keys, migrations, and concurrency locks between
  MongoDB and PostgreSQL for ALMEAA. Ensures reference integrity, prevents table deadlocks,
  and validates transactional consistency (e.g. SELECT FOR UPDATE on student class moves and seats).
---

# ALMEAA Database Migrator & Integrity Guard

## الغرض
التأكد من صحة وسلامة قواعد البيانات وانتقال الكيانات من MongoDB إلى PostgreSQL بنسبة 100% دون فقدان للعلاقات أو المفاتيح الأساسية أو الفهارس، وضمان معالجة التنافس التزامني.

## متى تُستدعى هذه المهارة
- عند فحص أو كتابة أي ملف هجرة SQL (`migrations/*.sql`).
- عند التحقق من سلامة القيود والعلاقات بين الجداول (Foreign Keys & Cascades).
- عند مراجعة عمليات القفل التزامني (Concurrency Locks) في المعاملات المالية أو نقل الطلاب.

## القواعد الصارمة
1. **التكامل المرجعي الصارم:** كل جدول فرعي يجب أن يمتلك مفاتيح أجنبية صريحة تربطه بالجدول الأب مع تحديد سلوك `ON DELETE` بوضوح (CASCADE أو RESTRICT).
2. **منع الأقفال الميتة (Deadlock Prevention):** العمليات المتزامنة (مثل نقل الطلاب بين الفصول أو حجز المقاعد) يجب أن تستخدم تسلسلاً موحداً مع `SELECT ... FOR UPDATE` لضمان الذرية.
3. **تطابق الهجرة:** كل ملف `.up.sql` يجب أن يقابله ملف `.down.sql` صالح للاسترجاع دون كسر بنية البيانات.
