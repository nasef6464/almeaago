---
name: almeaa-content-taxonomy-guard
description: >-
  Enforces the ALMEAA pedagogical taxonomy hierarchy: Path -> Level -> Subject -> Topic ->
  Skill -> Question -> Lesson -> Course. Critically enforces Rule 2: The Skills Center
  (SkillsAdminPage) MUST remain an independent administrative module and must never be merged
  or buried inside path management screens.
---

# ALMEAA Content & Taxonomy Guard

## الغرض الحاكم والقاعدة الملزمة
فرض التسلسل الهرمي البيداغوجي المعتمد للمنصة، مع التطبيق الصارم لـ **القاعدة الثابتة 2: استقلالية مركز إدارة المهارات**.

## القواعد الملزمة
1. **استقلالية مركز المهارات:**
   - مركز المهارات (`SkillsAdminPage.tsx`) مكون مستقل تماماً يظهر في لوحة الإدارة تحت التبويب المستقل (`/admin-dashboard?tab=skills`).
   - يُمنع منعاً باتاً دمج إدارة المهارات كشاشة فرعية داخل إدارة المسارات (`TaxonomyAdminPage.tsx` أو `PathsManager.tsx`).
2. **الهرمية الإدارية المرجعية:**
   - 1. المسارات (Paths)
   - 2. المهارات (Skills)
   - 3. الأسئلة (Questions)
   - 4. الدروس (Lessons)
   - 5. الدورات (Courses)
3. **الربط متعدد لمتعدد:**
   - المهارة ترتبط بالأسئلة والدروس والمواضيع التأسيسية عبر جداول الربط المستقلة في PostgreSQL (`question_skill_links`, `lesson_skill_links`, `topic_skill_links`) لضمان عدم حصر المهارة في مسار واحد بصورة تعطل قياس مستوى الطالب الشامل.
