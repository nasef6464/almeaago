# 03 — Question Bank, Skills, Images & Counters

هذا الملف أهم مرجع لبنك الأسئلة في النسخة الجديدة.

## 1. الهوية — VERIFIED

القاعدة:

**One Question -> One Stable Identity -> Unlimited Reuse**

السؤال لا يُنسخ داخل Quiz أو Review أو Training.

Current Question identity:
- Mongo `_id`.
- public `id`.
- stable `questionCode` unique.
- `questionCode` يصبح immutable بعد تعيينه.

Target:
- PostgreSQL UUID/internal key.
- immutable public question_code.
- references تستخدم question_id فقط.

## 2. السؤال يمكن أن يكون نصًا أو صورة — VERIFIED

Validation الحالية:
- يجب وجود `text` أو `imageUrl` على الأقل.
- types: mcq, true_false, essay.
- MCQ/TF يحتاج options عند العرض القابل للحل.

حقول المحتوى الحالية:

- text
- options[]
- correctOptionIndex
- explanation
- hint
- solvingStrategy
- videoUrl
- imageUrl
- imageAlt
- optionsEmbeddedInImage

إذا كان السؤال المصور Publishable/Pending Review فالنظام الحالي يطلب written explanation.

إذا كانت الاختيارات داخل الصورة:
- `aiContext.optionTexts` يجب أن تحتوي تمثيلًا نصيًا كاملًا للاختيارات.

## 3. حقوق/خصائص السؤال (Question Capabilities)

### الهوية والمصدر
- questionCode
- sourceMeta.documentCode
- documentTitle
- sourceItemId
- pdfPageIndex
- printedPageNumber
- printedQuestionNumber
- page
- questionNumber
- cropIndex
- importBatchId
- imageVersion
- imageHash

### المحتوى التعليمي
- explanation
- hint
- solvingStrategy
- videoUrl
- voiceExplanation.text/audioUrl/audioMimeType/version

### AI readiness
- readableText
- speechText
- visualDescription
- optionTexts
- mathExpressions: latex + spokenArabic
- concepts
- requiredData
- aiContext version

### التصنيف
- pathId
- subject / subjectId
- sectionId
- skillIds[]
- legacy skillId/subSkillId compatibility
- examType: qudurat/tahsili/general
- source: internal/official_exam/mock/imported
- year
- difficulty
- type

### الملكية والجودة
- ownerType
- ownerId
- createdBy
- assignedTeacherId
- approvalStatus: draft/pending_review/approved/rejected
- approvedBy/At
- reviewerNotes
- revenueSharePercentage

## 4. Skill Taxonomy — VERIFIED

التحقق الحالي عند إنشاء/تعديل Question:

1. path مطلوب.
2. subject مطلوب.
3. section/main skill مطلوب.
4. main skill يجب أن يكون موجودًا في taxonomy.
5. skillIds المرسلة يجب أن تكون من subskills التابعة لنفس main skill.
6. إذا كان main skill لديه subskills، يجب ربط السؤال بواحدة منها على الأقل.
7. canonical `skillIds` ينتج من mainSkillId + nested subskill IDs.

**Target design:**
لا نخزن skillIds array فقط. نستخدم:
- questions
- skills
- question_skills(question_id, skill_id, relation_type)
مع unique(question_id, skill_id).

relation_type يمكن أن يميز MAIN / SUB / SECONDARY إذا احتجنا.

## 5. عدادات الأسئلة والمهارات — VERIFIED + TARGET CLARIFICATION

Current coverage يحسب:
- total Questions في scope.
- mainSkillCount تقريبًا من distinct sectionId.
- subSkillCount من skill IDs غير المصنفة top-level.
- approved/pending.
- count per skill.
- count per section.

### قاعدة العد في النسخة الجديدة

يجب تعريف العدادات صراحة:

- **Questions Total:** COUNT DISTINCT question_id داخل scope.
- **Question count for skill:** COUNT DISTINCT question_id linked to skill.
- السؤال المرتبط بمهارتين يظهر في عداد كل مهارة، لكنه لا يصبح سؤالين في إجمالي البنك.
- Main Skill Coverage = عدد main skills التي لديها >= 1 qualifying question.
- Subskill Coverage = عدد subskills التي لديها >= 1 qualifying question.
- Unlinked = سؤال لا يملك أي canonical subskill relation المطلوبة.
- Approved/Pending حسب workflow state.

أي Counter يجب أن يصرح بالـscope: Platform total أم filtered scope.

## 6. Filters الحالية VERIFIED

Question Bank يدعم:
- path
- subject
- section/main skill
- skill / multiple skill IDs
- linked/unlinked
- difficulty
- type
- examType
- source
- year
- approval status
- with/without video
- with/without explanation
- search in text/questionCode/explanation/id
- pagination
- summary mode
- optional coverage

Target API يجب أن يبقي هذه القدرات أو يثبت بديلًا مكافئًا.

## 7. Pagination & bounded reads

Current:
- default list limit 80.
- max 100.
- IDs query bounded.
- public summary has 30s bounded in-process cache.

Target:
- server cursor/page pagination.
- exact counts لا تُطلب في كل request إذا مكلفة.
- coverage endpoint/cache منفصل عند كبر الحجم.
- Redis/shared cache بدل process-local عند multi-instance.

## 8. صور الأسئلة — لماذا R2؟

Current editor upload:
- JPEG/PNG/WebP.
- size bounded من env.
- Go/Node API يصدر presigned PUT فقط.
- المتصفح يرفع bytes مباشرة إلى R2.
- DB تحفظ URL/metadata ولا تحفظ bytes/Base64.

Modern import:
```
questions/v2/{QUESTION_CODE}/{SHA256_IMAGE_HASH}.webp
```

هذه content-addressed naming:
- تمنع رفع نسخة جديدة لنفس الصورة.
- تربط provenance بالهوية.
- تسمح بالتحقق من hash.
- تقلل bandwidth على API.
- تمنع تضخم DB.

Target يحافظ على نفس الفكرة، ويفضل direct-to-R2 upload عبر signed URLs.

## 9. Image lifecycle

- لا ترفع نفس hash مرة أخرى.
- imageVersion يتغير عند تغيير asset.
- object key immutable إن أمكن.
- CDN cache طويل للنسخ ذات hash.
- lazy-load في UI.
- لا تمر image bytes عبر backend للعرض.
- orphan cleanup job لا يحذف أي asset قبل إثبات عدم وجود reference/history.

## 10. Import workflow

Current V2 import:
- batchId strict.
- max 100 item/batch.
- questionCode format للـquant import.
- source metadata.
- dry-run first.
- SHA-256 image digest.
- draft isolation.
- verify no duplicate code/hash conflict.

Target import must support:
1. validate manifest.
2. dry-run.
3. detect duplicate identity.
4. detect duplicate image hash.
5. upload missing assets.
6. transactional/upsert question metadata.
7. produce import report.
8. no auto-approve unless policy says.

## 11. Reuse & delete

Quiz stores questionIds.
Mock sections store questionIds.
ReviewCard stores questionId.
QuestionAttempt stores questionId.

Current deletion removes reference from quizzes. Target الأفضل:
- soft archive Question بدل hard-delete إذا ظهر في historical attempt/result.
- cannot delete if historical immutable evidence exists.
- removal from future catalogs != erasing history.

## 12. Learner answer secrecy

Learner presentation must strip:
- correctOptionIndex
- explanation/hint/strategy حسب اختبار policy
- aiContext/private source metadata
- reviewer notes

الحل لا يُرسل قبل السماح به.

## 13. Question history

Target:
- revision/version metadata for material changes.
- attempt/result snapshot نصي محدود عند الحاجة للنزاهة التاريخية.
- لا snapshot للصورة bytes.
- snapshot يحتفظ بمعنى السؤال والاختيارات اللازمة لتفسير نتيجة قديمة.

## 14. Question Bank acceptance scenarios

- text-only question.
- image-only question.
- text + image.
- image with options embedded.
- multiple subskills.
- invalid cross-taxonomy subskill rejected.
- duplicate questionCode rejected.
- same image hash not reuploaded.
- pagination >100 items.
- linked/unlinked filter.
- coverage counters with multi-skill question.
- staff can edit; learner cannot see answer.
- reuse same question in normal quiz + mock + review without duplication.
