# 14 — Current Repository Inventory

**Baseline:** main @ 4aec4bc265299ecc1ba7e32738a0fdc60681a878

## 1. Repository scale

- Files: ~1,644
- Directories: ~122
- docs: ~322 files
- scripts: ~361 files
- server: ~355 files
- dashboards: ~144 files
- components: ~70 files
- pages: ~73 files

هذا inventory لا يعني أن كل ملف Feature مستقل؛ الهدف منع إغفال surfaces موجودة.

## 2. Backend Models — 59

1. AccessCode
2. AccessGrant
3. Activity
4. AdminAuditLog
5. AiInteraction
6. AiQuestionAssistCache
7. AnnouncementAd
8. B2BPackage
9. BackupActivity
10. BackupSnapshot
11. Certificate
12. ClassroomParticipant
13. ClassroomResponse
14. ClassroomSession
15. ClassroomTemplate
16. ClientEvent
17. Course
18. DiscountCode
19. DiscussionReply
20. DiscussionThread
21. Group
22. HomepageSettings
23. Lesson
24. Level
25. LibraryItem
26. LiveExamSession
27. MasteryGoal
28. NotificationDelivery
29. NotificationTemplate
30. ParentStudentRelationship
31. Path
32. PaymentGatewayEventGuard
33. PaymentRequest
34. PaymentSettings
35. PhoneOtp
36. PlatformFontSettings
37. PlatformIntegrationHistory
38. PlatformIntegrationSettings
39. PublicBarcodeSubmission
40. PublicBarcodeSubmissionGuard
41. PublicBarcodeTest
42. Question
43. QuestionAttempt
44. Quiz
45. QuizResult
46. ReviewCard
47. SchoolContract
48. SchoolIntervention
49. SchoolMembership
50. SchoolSkillAggregate
51. SchoolSkillEvidence
52. Section
53. Skill
54. SkillProgress
55. StudyPlan
56. Subject
57. TeachingAssignment
58. Topic
59. User

بالإضافة إلى infrastructure models داخل modules مثل Assessment Assignment/Attempt/Response/Result/Version وموديلات mirror/audit.

## 3. Backend Modular Areas

### ai
- student target authorization
- provider circuit breaker
- question assistant

### auth
- auth user domain

### content
- bootstrap cache/payload/request/visibility
- learning content workflow
- school operations scope
- presentation/platform integrations
- review/study plan/school commercial/relations routes

### media
- question image upload
- import image upload
- explanation audio upload
- R2 presigned PUT

### notifications
- campaigns
- audience authority
- realtime/SSE

### parents
- parent authority

### privacy
- user deletion lifecycle

### product-config
- customer instance fingerprint/manifest/settings/public config

### public-tests
- barcode/public scope

### quizzes
- question bank
- assessment definition/versioning compatibility
- submissions
- attempts/results
- analytics/mastery
- student review
- school skill read models

### reports
- parent weekly reports/WhatsApp/scheduler/queue

### schools
- access policy
- context resolver
- director access/workspace
- entitlements
- teacher workspace
- classroom intelligence/reports/scoring

## 4. API Route Groups

- activity.routes
- ai.routes
- auth.routes
- backup.routes
- certificates.routes
- classroom root/subroutes
- content.routes
- course.routes
- discussions.routes
- health.routes
- leaderboard.routes
- live-exams.routes
- media.routes
- notification.routes
- operations.routes
- parent.routes
- payment.routes
- productConfig.routes
- publicTests.routes
- questionAnalytics.routes
- quiz.routes
- quizResults.routes
- review.routes
- schoolAccess.routes
- schoolAdminIntegrity.routes
- search.routes
- seo.routes
- taxonomy.routes
- modular studentReview/questionBank/adaptive routes

## 5. API families mounted

- /api/health
- /api/auth
- /api/taxonomy
- /api/content
- /api/courses
- /api/quizzes
- /api/question-analytics
- /api/media
- /api/live-exams
- /api/payments
- /api/ai
- /api/operations
- /api/backups
- /api/seo
- /api/notifications
- /api/product-config
- /api/school-access
- /api/classroom
- /api/certificates
- /api/discussions
- /api/review
- /api/leaderboard
- /api/search
- /api/parent
- /api/activities
- /api/public-tests

## 6. Student/Public Frontend Surfaces

- Landing/Home
- Dashboard
- Generic Path / Qudrat / Tahsili / STEP
- Subject Learning
- Courses/Course View
- Quiz/QuizPage/Quizzes
- Mock Exams
- Results
- Reports
- Review Session
- Favorites/Review
- Plan
- QA
- Achievements
- Flashcards
- Book/Live Sessions
- Smart Classroom Student
- Pricing/Cart/Checkout
- My Requests
- Profile
- Certificates
- Barcode Tests
- Blog/static/about/contact/faq/privacy/terms

## 7. Role Dashboards

- AdminDashboard
- SupervisorDashboard
- SchoolTeacherDashboard
- SchoolDirectorDashboard
- Parent dashboard via role routing
- instructor/trainer context

## 8. Admin Managers

- AdvancedCourseBuilder
- AiAssistantManager
- AnnouncementAdsManager
- BackupManager
- ContentReviewQueueManager
- CoursesManager
- FinancialManager
- FoundationManager
- GroupsManager
- HomepageManager
- LessonsManager
- LibraryManager
- LiveSessionsManager
- MembershipsManager
- MockExamManager
- NotificationsManager
- OperationsCommandCenter
- PathsManager
- PlatformFontsManager
- PlatformIntegrationsManager
- PublicBarcodeTestsManager
- QuestionBankManager
- QuizBuilder/UnifiedQuizBuilder
- QuizzesManager
- SchoolsManager + school subpanels
- SkillsManager/SkillsTreeManager
- SmartClassroom panels
- StudentIntelligenceProfile
- TestAnalyticsReport
- Trainer managers
- UsersManager

## 9. Frontend API groups

- access codes
- AI
- announcement ads
- auth
- courses
- learning support
- library
- operations
- payments
- questions
- quizzes
- study plans
- taxonomy/content

## 10. Testing estate

Root package contains extensive:
- smoke contracts.
- live audits.
- role pages.
- student journeys.
- school journeys.
- assessment contracts.
- question bank coverage.
- payment/security.
- monitoring.
- database/backup.
- performance/load.
- AI bridge.
- adaptive phases.
- deep pre-merge E2E.

New platform should reuse business scenarios, not port Node-specific test implementation blindly.
