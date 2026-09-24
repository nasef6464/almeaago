# 02 — Roles, Scopes & Relationship Map

## 1. Roles VERIFIED

- admin
- supervisor
- teacher
- school_admin
- parent
- student

## 2. القرار الأمني

```
Allow(resource, action)
= authenticated identity
+ active account
+ role
+ tenant/school scope
+ group/class scope
+ managed path/subject scope
+ ownership/assignment
+ resource lifecycle state
+ access entitlement
```

إخفاء الزر ليس Authorization.

## 3. علاقات الهوية الحالية

User يحتوي legacy/compatibility references مثل:

- `schoolId`
- `groupIds[]`
- `linkedStudentIds[]`
- `managedPathIds[]`
- `managedSubjectIds[]`
- `enrolledCourses[]`
- `enrolledPaths[]`
- subscription arrays
- review/favorites legacy arrays

وفي المقابل توجد كيانات canonical أكثر دقة:

- SchoolMembership.
- ParentStudentRelationship.
- TeachingAssignment.
- AccessGrant.

النسخة الجديدة يجب أن تجعل الجداول العلاقية canonical وتستخدم legacy fields فقط أثناء أي compatibility period.

## 4. School Membership

المعنى: **من ينتمي إلى أي مدرسة وبأي دور**.

Current verified fields الأساسية:
- userId
- schoolId
- role: student/teacher/supervisor/school_admin/parent
- status
- permissions

Unique identity حاليًا user + school + role.

في PostgreSQL المقترح:
- school_memberships
- membership_permissions
- optional class memberships منفصلة إن احتجنا

## 5. Teaching Assignment

المعنى: **ما الذي يدرسه المعلم ولأي فصل داخل أي مدرسة**.

Fields الحالية:
- schoolId
- teacherId
- classId
- subjectId
- status

Unique: school + teacher + class + subject.

هذه العلاقة أقوى من teacher.role وحده.

## 6. Parent → Student

Canonical relationship:
- parentUserId
- studentUserId
- schoolId
- status
- source
- audit creator/revocation

ولي الأمر لا يحصل على كل طلاب المدرسة؛ فقط العلاقات النشطة.

## 7. Groups / Classes

Group الحالي يدعم:
- name
- type
- parentId
- ownerId
- supervisorIds[]
- studentIds[]
- courseIds[]
- metadata

في النسخة الجديدة:
- groups/classes كجدول.
- memberships كجدول link بدل arrays كبيرة.
- supervisors/owners كعلاقات واضحة.
- لا نستخدم user.groupIds كمرجع وحيد.

## 8. Learning Access ≠ School Membership

وجود الطالب في مدرسة لا يفتح المحتوى تلقائيًا.

AccessGrant الحالي يمثل ledger للوصول:
- userId
- sourceType/sourceId
- packageId/courseIds
- contentTypes
- pathIds
- subjectIds
- status
- grantedAt/expiresAt
- revoke audit
- idempotencyKey

في النسخة الجديدة يصبح `entitlements`/access ledger هو مصدر الحقيقة لفتح المحتوى.

## 9. Content Ownership

كيانات مثل Question/Course/Lesson/Quiz تحتوي:
- ownerType: platform/teacher/school
- ownerId
- createdBy
- assignedTeacherId
- approvalStatus
- approvedBy/At
- reviewerNotes

قاعدة النسخة الجديدة:
Ownership لا يساوي Permission. يتم التحقق من الاثنين.

## 10. Assessment Scope

لا نخلط:
- Assessment Definition.
- Learning Placement.
- Directed Assignment.
- Session.

المعلم قد يملك Assessment لكنه لا يستطيع توجيهه لطالب خارج managed scope.

## 11. Hybrid Account

INTENDED/جزئي موجود:
- نفس الحساب قد يعمل كمتعلم فردي وكعضو مدرسة.
- السياق يجب أن يكون explicit workspace/context switch.
- تبديل السياق لا يرفع الصلاحيات.
- Analytics المدرسة تبقى منفصلة عن self-study عند الحاجة.

## 12. Privacy Lifecycle

عند حذف/إلغاء هوية:
- revoke/deactivate canonical authority أولًا.
- إزالة membership/parent/teaching/access authority.
- عدم حذف السجل الأكاديمي/المالي/التدقيقي بلا سياسة retention موثقة.
- عدم ترك orphan authority.

## 13. PostgreSQL Target Relations

```
users
roles / user_global_roles
schools
school_memberships
school_membership_permissions
classes
class_memberships
teaching_assignments
parent_student_relationships
groups
group_memberships
content_owners (or owner columns)
access_grants / entitlements
```

Foreign keys + unique constraints + active/status indexes مطلوبة.

## 14. Negative Tests إلزامية

لكل API حساس:
- School A actor → School B resource = 403/404 policy.
- Teacher unassigned subject/class = deny.
- Parent unlinked student = deny.
- Student other student's result = deny.
- Inactive/revoked membership = deny immediately.
- Direct URL must not bypass UI hiding.
