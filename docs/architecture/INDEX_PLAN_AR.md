# Index Plan — ALMEAA V2

## المبدأ
الفهرس ليس هدفًا في حد ذاته. كل Index يجب أن يخدم Query/Constraint معروفة، ويتم حذف أو تعديل الفهارس عديمة الفائدة بعد القياس.

| Domain | Query/Access Pattern | Index direction |
|---|---|---|
| Identity | login by normalized email | unique lower(email) |
| Identity | login by national ID | partial unique national_id |
| Identity | login/session by token hash | unique/active token hash |
| Identity | active sessions per user | user_id + expires_at where not revoked |
| Organizations | members by school/role/status | school_id + role + status + user_id |
| Organizations | classes for student | user_id + status + class_id |
| Organizations | teacher assignments | school_id + teacher_id + class_id + subject_id |
| Parents | active children for parent | parent_user_id + status + student_user_id |
| Taxonomy | skills by subject/parent/order | subject_id + parent_skill_id + kind + sort_order |
| Question Bank | question by stable code | unique question_code |
| Question Bank | approved questions by skill | skill_id + question_id + workflow status path |
| Assessment | attempts by student | student_id + created_at/id |
| Assessment | attempts by assessment/status | assessment_id + status + created_at/id |
| Learning | mastery by student+skill | unique/current student_id + skill_id |
| Review | mistake/review queue | student_id + status + due_at/id |
| Commerce | entitlement resolution | user_id + scope_type + scope_id + status + expires_at |
| Commerce | payment idempotency/provider event | unique idempotency/provider event id |
| Notifications | inbox page | user_id + created_at/id |
| Audit | entity history | entity_type + entity_id + created_at/id |
| AI | usage/cost by user/date/provider | user_id/provider + created_at |

## قبل إضافة Index
1. حدد query الفعلية.
2. افحص `EXPLAIN (ANALYZE, BUFFERS)` على dataset واقعي/synthetic.
3. قس rows scanned مقابل rows returned.
4. راقب write amplification وحجم index.
5. لا تضف index مركب لمجرد التخمين.

## Keyset Pagination
للقوائم الكبيرة نفضل cursor مبني على ترتيب ثابت مثل:
`ORDER BY created_at DESC, id DESC`
وفهرس مطابق:
`(owner_id, created_at DESC, id DESC)`

ده يمنع بطء OFFSET عندما يصل المستخدم لصفحات عميقة.
