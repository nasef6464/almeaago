# 04 — Assessment, Attempts, Results & Review

## 1. North Star

Assessment هو تعريف المحتوى وقواعد التشغيل. لا نعتبر طرق التوزيع أنواع اختبارات مستقلة.

```
Question Bank
  -> Assessment Definition
     -> Learning Placement / Directed Assignment / Session
        -> Attempt
           -> Answers
              -> Server Scoring
                 -> Result
                    -> Skill Analytics / Review / Next Action
```

## 2. أنواع التقييم الحالية

### quizKind
- drill
- test
- mock

### mode legacy/delivery
- regular
- saher
- central

### target / placement
- learningPlacements: training/tests/foundation/course
- targetGroupIds
- targetUserIds
- dueDate
- supervisorMessage

### mock
- enabled
- pathId
- qiyasCategory
- targetScore
- strict section lock
- presentationMode
- sections: id/title/subject/questionIds/time/order/domain

النسخة الجديدة يجب أن تفصل:
- Assessment Kind.
- Delivery/Assignment.
- Learning placement.
- Live/Public session.

## 3. Quiz Settings

Current contract includes:
- showExplanations
- showAnswers
- showResultsReport
- returnToSourceOnFinish
- maxAttempts
- passingScore
- timeLimit
- randomizeQuestions
- randomizeOptions + legacy shuffleOptions compatibility
- showProgressBar
- requireAnswerBeforeNext
- allowQuestionReview
- optionLayout

### Acceptance Rule

أي setting لا تعتبر supported إلا إذا نجح:

```
Builder
 -> API validation
 -> Persistence
 -> GET/reload
 -> Edit restoration
 -> Student Runner
 -> Result/Analytics effect
```

## 4. Student Attempt

لا تُقبل correctness من العميل.

Target:
- attempts table.
- assessment_version_id.
- user_id.
- started/submitted/expires.
- status.
- source context.
- idempotency/submission key.
- optional section state.

Answers:
- attempt_id
- question_id
- selected option/value
- first/last answer timestamps
- time spent
- review flag
- server-computed correctness after policy allows.

## 5. Autosave/Resume

Current product has autosave/resume/retry hardening.

Target requirements:
- one logical attempt only.
- repeated autosave idempotent.
- retry بعد network failure لا ينشئ duplicate attempt/result.
- expiration enforced server-side.
- client local state is cache only, not source of truth.

## 6. Scoring

- server owns score.
- answer key never trusted from frontend.
- passing score from assessment config/version.
- section analytics computed from submitted server data.
- mock section boundaries preserved.
- historical version/snapshot protects meaning of old result.

## 7. Versioning

Target Assessment model:
- assessments
- assessment_versions
- assessment_version_questions
- assessment_sections
- assessment_assignments
- assessment_sessions

Publishing/editing:
- Draft can mutate.
- Published assessment creates/locks version semantics as policy.
- Historical attempts point to exact version.

## 8. Result

Current QuizResult contains:
- userId
- quizId/title
- total/correct/wrong
- score/passed
- attemptNumber
- source/learningContext
- schoolId/classId
- time spent
- skillsAnalysis
- questionReview
- sectionResults
- submissionKey
- quizSnapshot

Target splits core result from derived analytics where useful.

## 9. Results Review

بعد التسليم فقط، وحسب policy:
- question stem.
- learner answer.
- correct answer.
- explanation.
- video.
- Question Assistant.
- voice explanation.
- navigation/question map.

قبل التسليم لا يُكشف answer key/explanation private fields.

## 10. Student Review Library

Current unified direction:
- Saved for review.
- Mistakes.
- One question appears once حتى لو السببان موجودان.
- ReviewCard canonical relation between user and question.
- no question/image duplication.

ReviewCard fields currently include:
- savedForReview/savedAt
- hasMistake
- skill/path/subject/section
- spaced repetition fields
- nextReviewDate
- last review event

## 11. Review Training

Student may start:
- saved-only.
- mistakes-only.
- all.

Session references question IDs only.
New attempts are normal learning evidence against same Question identity.

## 12. Evidence Types

النسخة الجديدة يجب أن تسجل `evidence_type` حتى لا نضاعف mastery:

Examples:
- assessment
- practice
- remediation
- mastery_review
- smart_classroom

Business rule:
نفس user/question/attempt event لا يُحتسب مرتين.

## 13. Skill Analysis

```
Answer
 -> Question skills
 -> Attempt evidence
 -> Result skills analysis
 -> SkillProgress/mastery
 -> Weakness
 -> Next Best Action
```

لا يستخدم AI لحساب score أو deterministic mastery core إلا إذا اتُخذ قرار منتج منفصل؛ AI يشرح ويقترح، وليس مصدر الحقيقة الرقمية.

## 14. Directed Assessment

- audience by users/groups/school scope.
- direct URL خارج الجمهور = denied.
- creator ownership لا يسمح targeting خارج authority.
- due date/window server enforced.
- supervisor/teacher can only target managed students.

## 15. Public/Barcode Tests

تبقى Distribution channel مستقلة عن Assessment definition.
Public session لا تنسخ الأسئلة.
Security limits تمنع answer exposure والتلاعب بالنتيجة.

## 16. Performance

- assessment list paginated.
- question selection bounded/searchable.
- no embedding full Question docs in every Assessment.
- result detail separate from list summary.
- expensive analytics pre-aggregate/cache only when justified.
- exports/background reports as jobs.

## 17. Required E2E

1. create draft.
2. select questions across multiple pages.
3. publish/reload/edit.
4. directed audience.
5. outsider direct URL denied.
6. student starts.
7. autosaves.
8. resumes.
9. submits once despite retry.
10. result generated.
11. section + skill analysis.
12. save review.
13. mistake appears.
14. remediation attempt.
15. mastery updates once.
