# Error Ownership Map

هدف الملف: أي مطور يعرف أين يبحث عندما تحدث مشكلة.

| Symptom | Primary owner | Secondary owner |
|---|---|---|
| Login/session/password | identity | platform/security |
| School/user scope leak | organizations | identity/security |
| Wrong path/subject/skill relation | taxonomy | content/questionbank |
| Foundation topic opens wrong resource | content | learning/taxonomy |
| Question fields/image/skill/count | questionbank | media/taxonomy |
| Image/audio upload or duplicate media | media | questionbank/content |
| Test start/save/submit/result | assessment | learning |
| Mistake/review/mastery wrong | learning | assessment/questionbank |
| Package/payment/access | commerce | organizations |
| Parent sees wrong child | parents | organizations |
| Smart Classroom socket/session | realtime | organizations/questionbank |
| AI tutor/provider/token/cost | ai | questionbank/learning |
| Aggregate/report/export | reporting | source domain |
| Backup/audit/integration/privacy | operations | platform |

If a bug requires edits in unrelated domains, stop and check the boundary before adding a workaround.
