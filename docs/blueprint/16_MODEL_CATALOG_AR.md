# 16 — Current Model Catalog & Target Mapping

**الهدف:** عدم نقل أسماء الـModels فقط؛ بل معرفة معنى كل كيان الحالي، وهل يصبح جدولًا مستقلًا أو Ledger أو Read Model أو يُدمج/يُستبدل في PostgreSQL.

> الحالة هنا تصف المعنى المعماري. التفاصيل الدقيقة لكل field يجب أن تُثبت من schema الحالي عند تنفيذ Domain.

| Current Model | المعنى/المسؤولية الحالية | Target Go/PostgreSQL |
|---|---|---|
| AccessCode | أكواد فتح وصول/باقات | access_codes + redemption ledger |
| AccessGrant | سجل منح الوصول القابل للتدقيق والإلغاء | entitlements/access_grants - canonical |
| Activity | نشاط/حدث مستخدم | activity_events أو analytics stream حسب القيمة |
| AdminAuditLog | سجل أوامر الإدارة | audit_log - append-only |
| AiInteraction | تفاعل AI ومراقبته | ai_interactions + usage ledger |
| AiQuestionAssistCache | كاش مساعد السؤال | Redis + optional durable ai_cache metadata |
| AnnouncementAd | إعلانات/تنبيهات العرض | announcement_ads |
| B2BPackage | باقة مدرسة ونطاق محتوى/سعة | school_products/packages + package_items |
| BackupActivity | تشغيل/سجل نسخة احتياطية | backup_runs |
| BackupSnapshot | metadata للنسخة | backup_snapshots/manifest metadata |
| Certificate | شهادات الطالب | certificates |
| ClassroomParticipant | عضو/حضور جلسة فصل ذكي | classroom_participants |
| ClassroomResponse | إجابة طالب لحظية | classroom_responses |
| ClassroomSession | جلسة الفصل الذكي | classroom_sessions |
| ClassroomTemplate | قالب حصة/أسئلة معد مسبقًا | classroom_templates |
| ClientEvent | Telemetry من الواجهة | client_events مع retention |
| Course | الدورة/الباقة legacy mixed fields جزئيًا | courses + course_modules + commercial product refs |
| DiscountCode | كود خصم | discount_codes + redemption/use records |
| DiscussionReply | رد منتدى/Q&A | discussion_replies |
| DiscussionThread | موضوع سؤال/نقاش | discussion_threads |
| Group | مجموعات/فصول وعلاقات legacy arrays | groups/classes + membership link tables |
| HomepageSettings | إعدادات الصفحة الرئيسية | platform_presentation_settings/JSONB |
| Lesson | وحدة درس/فيديو/ملف/جلسة | lessons + assets + skill links |
| Level | مستوى/مرحلة ضمن taxonomy | levels |
| LibraryItem | ملف/مرجع دعم | library_items + asset link |
| LiveExamSession | جلسة اختبار حي | assessment_sessions (channel/type) |
| MasteryGoal | هدف إتقان لطالب | mastery_goals |
| NotificationDelivery | سجل إرسال قناة لمستخدم | notification_deliveries |
| NotificationTemplate | قالب إشعار | notification_templates |
| ParentStudentRelationship | علاقة ولي الأمر بالطالب | parent_student_relationships - canonical |
| Path | مسار تعليمي/تجاري | paths |
| PaymentGatewayEventGuard | منع تكرار Webhook | payment_events UNIQUE(provider,event_id) |
| PaymentRequest | طلب شراء/دفع | payment_requests |
| PaymentSettings | إعداد بوابات ووسائل الدفع | payment_provider_settings |
| PhoneOtp | OTP الهاتف | ephemeral otp store/table with TTL |
| PlatformFontSettings | إعداد خط المنصة | presentation_settings |
| PlatformIntegrationHistory | تاريخ تغيير التكاملات | integration_audit/history |
| PlatformIntegrationSettings | مفاتيح/إعدادات التكاملات | integration_settings + encrypted secrets |
| PublicBarcodeSubmission | إجابة/تسليم اختبار باركود | public_assessment_submissions أو normal attempt channel |
| PublicBarcodeSubmissionGuard | منع التكرار | idempotency/submission key unique |
| PublicBarcodeTest | تعريف اختبار عام/باركود | assessment + public session/distribution |
| Question | السؤال canonical | questions + versions/options/source/skills/assets |
| QuestionAttempt | Evidence على مستوى سؤال | answers/mastery_evidence حسب السياق |
| Quiz | تعريف الاختبار legacy جامع | assessments + versions + placements |
| QuizResult | نتيجة محاولة | results + skill summaries + review snapshot |
| ReviewCard | علاقة طالب/سؤال للمراجعة وSM-2 | review_cards - canonical |
| SchoolContract | عقد المدرسة والوحدات/الحدود | school_contracts + modules/limits |
| SchoolIntervention | تدخل علاجي مدرسي | interventions |
| SchoolMembership | دور المستخدم داخل مدرسة | school_memberships - canonical |
| SchoolSkillAggregate | Read model لإتقان المدرسة | school_skill_rollups/materialized view |
| SchoolSkillEvidence | أدلة مهارة مدرسية | mastery_evidence with school context |
| Section | قسم/مهارة رئيسية حسب taxonomy الحالي | main_skill/taxonomy node; الاسم النهائي يُحسم في ERD |
| Skill | مهارة رئيسية/فرعية embedded حاليًا | skills normalized hierarchy |
| SkillProgress | الحالة الحالية لإتقان المستخدم | skill_progress |
| StudyPlan | خطة تعلم/تدخل | study_plans + plan_items |
| Subject | مادة ضمن مسار/مستوى | subjects |
| TeachingAssignment | معلم + مدرسة + فصل + مادة | teaching_assignments - canonical |
| Topic | موضوع تأسيس وربط موارد | foundation_topics + link tables |
| User | الهوية + حقول وعلاقات legacy كثيرة | users فقط؛ العلاقات/progress خارج user row |

## Infrastructure Models داخل modules/quizzes

يوجد أيضًا Assessment infrastructure حديث نسبيًا خارج مجلد models التقليدي، مثل:
- AssessmentAssignment.
- AssessmentAttempt.
- AssessmentResponse.
- AssessmentResult.
- AssessmentVersion.
- Mirror/Audit records.

هذه تمثل اتجاهًا صحيحًا لفصل Definition/Assignment/Attempt/Result، والنسخة الجديدة لا تنقل طبقتي Quiz legacy + Assessment modern معًا؛ بل تستخرج contract القانوني النهائي.

## قواعد تحويل الـModels

1. **لا تحويل 1:1 من Mongoose إلى SQL tables.**
2. أي Array IDs تمثل علاقة طويلة العمر تتحول غالبًا Join Table.
3. أي Ledger مالي/وصول/Audit يصبح append-only أو controlled state transition.
4. Read Models/Aggregates لا تُعامل كمصدر الحقيقة.
5. Binary assets لا تُخزن في PostgreSQL.
6. Config المرن يمكن JSONB إذا لم يحتج علاقات.
7. كل entity تاريخية تحتاج سياسة archive/version بدل hard delete عند وجود evidence.

## Models تحتاج أعلى تدقيق أثناء التحويل

### Question / Quiz / Result / Attempt
لأنها تربط النزاهة، الإجابات، المهارات، التقييم، التحليل.

### User / SchoolMembership / Group / TeachingAssignment
لأن legacy arrays تتعايش مع علاقات canonical.

### Course / Topic / Lesson / Skill
لأنها تصنع رحلة التأسيس ومساحة المادة.

### PaymentRequest / AccessGrant
لأنها مالية وصلاحية وصول ولا تقبل duplicate side effects.

### AI/Notification/Event Logs
لأنها الأسرع تضخمًا وتحتاج retention/cache/aggregation.
