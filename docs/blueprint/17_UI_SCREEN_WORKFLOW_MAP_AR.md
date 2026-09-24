# 17 — UI Screen & Workflow Map

## 1. Public / Acquisition

### Landing
- تعريف المنصة والمسارات والباقات/المزايا.
- تسجيل/دخول.
- SEO/public only data.
- إعلانات/هوية/خطوط قابلة للإدارة.

### Pricing / Cart / Checkout
- اختيار منتج.
- فصل Course عن Package.
- التحقق من الوصول الحالي.
- إنشاء Payment Request؛ لا فتح وصول من الواجهة مباشرة.

### Public Barcode Test
- فتح بالslug/QR.
- محاولة عامة وفق السياسة.
- منع duplicate submission.
- نتيجة حسب إعداد الاختبار.

## 2. Authentication

- Login.
- Signup.
- Email verify.
- Forgot/reset password.
- account status/lockout.
- role routing بعد الدخول.

## 3. Student Dashboard

مناطق حالية/مقصودة:
- نظرة عامة.
- مساراتي.
- دوراتي.
- المسار الذكي.
- جلساتي.
- الاختبارات السابقة.
- اختبارات المدرسة.
- الاختبارات.
- تقاريري.
- خططي.
- أسئلتي للمراجعة.
- بطاقات التذكر.
- سؤال وجواب.
- طلباتي.

كل بطاقة Dashboard يجب أن تأتي من summary API مخصص، لا bootstrap شامل.

## 4. Path / Subject Learning Space

```
Path
 -> Subject
    -> Foundation
    -> Courses
    -> Practice
    -> Assessments
    -> Library
```

Actions:
- open topic.
- open lesson/video.
- open support file.
- start short drill.
- start assessment.
- buy/request access if locked.
- return to same source context.

## 5. Foundation Admin

- filter path/subject.
- list main/sub topics.
- visible/locked/access status.
- link lesson.
- link practice assessment.
- link library resource.
- preview exactly as learner.
- readiness/missing link indicators.

## 6. Question Bank Admin

### List
- scoped counters.
- path/subject/main skill/subskill filters.
- linked/unlinked.
- difficulty/type/source/year.
- workflow state.
- video/explanation presence.
- search by text/code/id.
- pagination.
- bulk approve/reject/delete policy.
- preview/edit/usage analytics.

### Editor
- text and/or image.
- options/correct answer.
- embedded-image options mode.
- explanation/hint/strategy.
- video.
- path/subject/main skill/subskill(s).
- difficulty/type/exam/source/year.
- provenance/source metadata.
- AI readable/speech/visual/math context.
- voice explanation.
- workflow/ownership.
- direct R2 upload.

### Import
- manifest/dry-run.
- code/hash validation.
- image upload intents.
- draft isolation.
- import report.

## 7. Assessment Center

Admin/authorized staff:
- list/search/filter.
- normal/drill/mock.
- create/edit.
- select questions across pages.
- settings.
- mock sections/timing.
- learning placement.
- audience assignment.
- workflow approval/publication.
- analytics/usage.

## 8. Student Assessment Runner

- intro/access gate.
- timer.
- question navigation.
- answer/save.
- review later.
- section locking if mock.
- autosave.
- resume.
- submit confirmation.
- retry-safe submit.
- finish destination according returnTo/result policy.

## 9. Results / Review

- score/pass.
- section analysis.
- skill analysis.
- question map.
- own answer.
- correct answer/explanation only when policy allows.
- image zoom.
- video explanation.
- voice explanation.
- Question Assistant.
- save/review status.
- next action.

## 10. Review Session / “أسئلتي للمراجعة”

- saved.
- mistakes.
- one item if both reasons.
- start saved/mistakes/all practice.
- spaced review scheduling.
- remediation attempts.
- smart tutor context.

## 11. Reports

Student:
- mastery/readiness.
- weakest skill.
- next action.
- goals/weekly plan.

Parent:
- linked child.
- concise result/progress.
- weak skills/action.
- weekly report.

Supervisor/School:
- scoped student list.
- class/school aggregates.
- comparisons.
- interventions.

Admin:
- platform aggregate/export.

## 12. School Admin Center

Existing manager is multi-panel:
- school list/portfolio.
- wizard/create.
- leadership.
- classes.
- people hub/roster.
- relations/import.
- access codes.
- packages.
- courses.
- contracts.
- teaching assignments.
- director delegation.
- reports/performance.
- services.
- settings/safety.
- launch/readiness/command center.

Target frontend should split by feature routes/components without losing one capability.

## 13. School Teacher

- workspace selector/context.
- assigned classes/subjects.
- minimal roster.
- teaching content/tests.
- class reports.
- smart classroom.
- cannot see unrelated school data.

## 14. Supervisor

- assigned schools/classes/subjects.
- student roster.
- assessment distribution.
- skill analytics.
- student focus.
- interventions/tasks.
- no platform-global administration.

## 15. School Director

- school switch if multiple authorized.
- overview.
- delegated student management.
- classes/assignments/reports according permission.
- no self-escalation.
- no cross-school.

## 16. Smart Classroom

Teacher console:
- choose scope.
- choose questions.
- schedule/start.
- attendance.
- push/reveal/end batch.
- live aggregate.
- end session/report.

Student live:
- join.
- current question.
- answer/revise allowed window.
- no aggregate/answer leakage.

Projector:
- PIN/QR.
- roster/attendance summary.
- question.
- controlled distribution/solution reveal.

## 17. AI Admin

- readiness.
- provider status/test.
- fallback chain.
- interactions logs.
- assistant prompt.
- integrations jump.
- usage/error observability.

## 18. Operations/Admin

- users.
- trainers.
- memberships.
- finance.
- notifications.
- monitoring.
- integrations.
- backups.
- homepage/fonts/ads.
- audit/operations center.

## 19. UI parity rule

لكل Screen:
- route.
- roles.
- data sources.
- actions.
- loading/error/empty.
- mobile/desktop.
- direct-link authorization.
- screenshots old/new.

لا يكفي نسخ الشكل؛ يجب إثبات actions والside effects.
