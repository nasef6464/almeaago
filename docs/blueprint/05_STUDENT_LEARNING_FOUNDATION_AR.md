# 05 — Student Journey, Foundation & Adaptive Learning

## 1. Product philosophy

الطالب يرى رحلة بسيطة. التعقيد يبقى في الإدارة والخادم.

الرحلة العامة:

```
Dashboard
 -> Path
 -> Subject Learning Space
    -> Foundation
    -> Courses
    -> Practice
    -> Assessments
    -> Library
 -> Result
 -> Weak Skill
 -> Next Best Action
 -> Resource / Video / Practice
 -> Reassessment
```

## 2. Subject Learning Space VERIFIED

المساحة الموحدة تجمع:
- Courses.
- Foundation.
- Practice.
- Assessments.
- Library.

Composition/placement responsibility هنا، بينما Course وAssessment تظلان مملوكتين لوحداتهما.

## 3. Foundation Data Model VERIFIED

Topic الحالي:
- id
- pathId
- subjectId
- sectionId
- skillId
- title
- parentId
- order
- visibility/locked
- lessonIds[]
- quizIds[]
- libraryItemIds[]

الرحلة المطلوبة:
- Main Topic.
- Subtopic.
- Resources المربوطة فقط.
- لا fallback يعرض كل محتوى المادة للطالب عشوائيًا.
- المدير يستطيع رؤية missing linkage واقتراحات الإدارة.

Target PostgreSQL:
- foundation_topics
- topic_skill_links
- topic_lessons
- topic_assessments
- topic_library_items

## 4. Main Skill ↔ Subskill ↔ Foundation

قاعدة التصميم الجديدة:

```
Main Skill
  -> Subskills
      -> Foundation Topic(s)
         -> Lesson/Video
         -> Supporting file
         -> Short drill
```

الربط لا يعتمد على اسم النص فقط، بل IDs مستقرة.

## 5. Short Foundation Drill

هو Assessment موجود، وليس Question copy ولا quiz engine ثان.

Learning placement:
- slot = foundation
- optional topicId
- accessType
- order/visibility

بعده:
- returnToSourceOnFinish حسب الإعداد.
- أو Result مختصر إذا policy تتطلب.

## 6. Courses

Course منفصل عن Foundation لكنه يظهر في نفس Learning Space.

Lesson fields الحالية تسمح:
- content/video/file/meeting/recording
- skillIds
- quiz link
- school/class/teacher metadata
- approval/workflow

Target:
- courses
- course_modules
- lessons
- lesson_skill_links
- lesson_assets
- lesson_progress

لا نخزن completedLessons array على user كمصدر الحقيقة طويل المدى؛ نستخدم progress table.

## 7. Interactive Video

Current user model يحمل video progress array.

Target:
- lesson_video_progress table.
- user + lesson unique.
- position seconds.
- answered interactive question events منفصلة/JSON bounded.
- avoid unbounded array inside user.

## 8. Adaptive Learning

Core deterministic loop:

```
QuestionAttempt
 -> Mastery Evidence
 -> Skill Progress
 -> Readiness
 -> Next Best Action
 -> Learning Resource
 -> Remediation Attempt
 -> Recheck
```

Current modules include:
- masteryReadiness
- nextBestAction
- skillAnalytics
- mastery goals
- school aggregates
- adaptive routes

## 9. SkillProgress

Current:
- userId
- skillId
- path/subject/section
- mastery
- status
- attempts
- evidenceCount
- recentEvidence bounded
- recentEvidenceKeys replay guard
- lastQuiz
- lastAttempt
- recommendedAction

Target:
- skill_progress materialized/current state.
- mastery_evidence append-only or bounded retained source events.
- unique user + taxonomy + skill.
- no double-counting.

## 10. Recommendation Resolution

Next action may point to:
- lesson/video.
- resource/library item.
- foundation topic.
- published practice assessment.
- reassessment.

كل target يجب أن يكون:
- visible.
- accessible/entitled.
- within learner path.
- not stale/deleted.

## 11. Student Dashboard

Current labels show:
- overview.
- paths/courses.
- smart path.
- sessions.
- previous/school tests.
- reports.
- plans.
- review questions.
- flashcards.
- Q&A.
- requests.
- parent-child tools حسب الدور.

Target dashboard reads page-scoped summaries only؛ لا يحمل كل question bank.

## 12. Review & Smart Tutor

`Ask Teacher`/Question Assistant يقرأ question_id + trusted context.
لا يرسل full history.
يرشد تدريجيًا:
- prompt learner thinking.
- hint.
- stronger hint.
- concept.
- steps.
- full solution only when policy allows.

## 13. Student Analytics

تقارير الطالب تركز على:
- current mastery.
- weakest skill.
- evidence trend.
- recommended next action.
- goal/readiness.

تجنب metric overload.

## 14. Parent/Supervisor views

Parent:
- what is weak?
- what happened?
- what next?

Supervisor/School:
- cohorts/classes.
- skill aggregate.
- students needing intervention.
- school vs self-study source separation.

## 15. Data growth protections

- progress rows instead of arrays on user.
- events append with retention/aggregation.
- topic/resource join tables.
- bounded dashboard queries.
- no all-question bootstrap.
- summaries separate from detail.
