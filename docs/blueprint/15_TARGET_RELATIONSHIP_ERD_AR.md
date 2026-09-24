# 15 — Target Relationship Map / Logical ERD

هذه خريطة منطقية؛ التفاصيل الفيزيائية النهائية تُراجع عند تصميم PostgreSQL migrations.

## 1. Identity & Organization

```
User
 ├─< AuthSession
 ├─< SchoolMembership >─ School
 │                         ├─< Class
 │                         ├─< SchoolContract
 │                         └─< SchoolPackage/Entitlement
 ├─< ClassMembership >──── Class
 ├─< TeachingAssignment >─ Class
 │          └───────────── Subject
 └─< ParentStudentRelationship >─ User(Student)
```

## 2. Academic Taxonomy

```
Path
 └─< Subject
     └─< MainSkill/Section
         └─< SubSkill
```

يفضل Skill table موحد مع parent_skill_id/type، أو main_skills + skills إذا كان ذلك أوضح؛ القرار يجب ألا يخلط presentation section بمعنى skill دون تسمية صريحة.

## 3. Foundation & Content

```
SubSkill
 ├─< TopicSkill >─ FoundationTopic
 │                  ├─< TopicLesson >─ Lesson
 │                  ├─< TopicAssessment >─ Assessment
 │                  └─< TopicLibraryItem >─ LibraryItem
 └─< LessonSkill >─ Lesson

Course
 └─< CourseModule
     └─< CourseLesson >─ Lesson
```

نفس Lesson يمكن أن يرتبط بسياق واحد أو أكثر فقط إذا policy تسمح؛ لا تكرر الـmedia.

## 4. Question Bank

```
Question
 ├─< QuestionVersion
 ├─< QuestionOption
 ├─< QuestionSkill >─ Skill
 ├─< QuestionSource
 ├─< QuestionAsset >─ Asset(R2)
 ├─1 QuestionAIContext
 └─0..1 QuestionVoiceExplanation -> Asset(R2)
```

QuestionCode unique/immutable.

## 5. Assessment

```
Assessment
 └─< AssessmentVersion
     ├─< AssessmentSection
     │   └─< SectionQuestion >─ QuestionVersion/Question
     └─< VersionQuestion >──── QuestionVersion/Question

Assessment
 ├─< LearningPlacement
 ├─< Assignment
 └─< Session

User(Student)
 └─< Attempt >─ AssessmentVersion
       ├─< Answer >─ Question
       └─1 Result
            ├─< ResultSkillSummary >─ Skill
            └─< ResultQuestionReviewSnapshot
```

Assignment audience via link tables:
- assignment_users
- assignment_groups/classes.

## 6. Learning/Adaptive

```
User
 ├─< LessonProgress >─ Lesson
 ├─< SkillProgress >─ Skill
 │     └─< MasteryEvidence >─ Question/Attempt/Result
 ├─< MasteryGoal >─ Skill/Subject
 ├─< ReviewCard >─ Question
 ├─< StudyPlan
 └─< Intervention
```

ReviewCard unique(user, question).

## 7. Commerce

```
Product
 ├─ Course product
 ├─ Package product
 └─ Membership product

Package
 └─< PackageItem -> Course/Path/Subject/ContentType

User
 ├─< PaymentRequest
 │    └─< PaymentEvent
 └─< Entitlement/AccessGrant -> Product/Scope
```

Payment confirmation + entitlement في transaction/idempotent workflow.

## 8. School Access

```
SchoolContract
 ├─ modules/features
 ├─ validity
 └─ limits

School + Contract
 -> school-level entitlement
 -> user/class grant according policy
```

Membership وحدها لا تفتح المحتوى.

## 9. Smart Classroom

```
School
 └─ Class
    └─ ClassroomSession
       ├─ Teacher
       ├─ Subject/Skills
       ├─< Participant >─ Student
       ├─< Batch
       │   └─< ClassroomQuestion >─ Question
       ├─< Response >─ Student/Question
       └─1 ImmutableReportSnapshot
```

Transient socket state في Redis، durable final state PostgreSQL.

## 10. AI

```
AIProviderConfig
AIModelPolicy
PromptVersion
AIInteraction
 ├─ User
 ├─ feature/context
 ├─ optional Question
 └─ AIUsageLedger

AICache
 key = feature + stable input fingerprint + prompt/model policy version
```

## 11. Notifications

```
NotificationTemplate
NotificationCampaign
 └─< NotificationDelivery >─ User
       └─ provider attempts/status
```

## 12. Assets

```
Asset
- id
- object_key
- public/signed delivery policy
- mime
- size
- sha256
- version
- status
- created_by
```

Business entities link to Asset by ID.
R2 object key unique.
Checksum index optional/global depending privacy and dedupe policy.

## 13. Audit

كل privileged mutation:
- actor user.
- role/context.
- school scope.
- action.
- entity type/id.
- before/after summary or diff pointer.
- request ID.
- timestamp.

## 14. Hard constraints examples

- question_code UNIQUE.
- question_skill UNIQUE(question_id, skill_id).
- review_card UNIQUE(user_id, question_id).
- teaching_assignment UNIQUE(school_id, teacher_id, class_id, subject_id).
- parent_student active uniqueness حسب policy.
- payment_event provider_event_id UNIQUE.
- access_grant idempotency_key UNIQUE.
- attempt submission key UNIQUE where used.
- active live classroom unique per school/class if product policy remains.
