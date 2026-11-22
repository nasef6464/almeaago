# ALMEAA Permanent Multi-Agent Execution Rule

## المبدأ الحاكم الملزم
المرجع الإلزامي لقواعد التنفيذ لجميع الوكلاء (Antigravity, Codex, DeepSeek) في مستودع `nasef6464/almeaago`:
`docs/engineering/ANTIGRAVITY_EXECUTION_STANDARD_AR.md`

## القواعد الأساسية غير القابلة للتفاوض
1. **منع الفجوة**: لا يعني PASS في Mock أو Typecheck أو Build اكتمال وظيفة. الإغلاق هو سلسلة أدلة كاملة: Legacy contract → UI → exact HTTP payload → Go decoder/auth/application → PostgreSQL → persisted observable effect → negative scenarios → screenshots (390/820/1440 RTL) → exact-head CI.
2. **عزل الوكلاء**: كاتب واحد فقط لكل مجموعة ملفات، وكل مهمة كتابة مستقلة داخل Git Worktree وفرع واضح؛ ممنوع تعديل الملف نفسه بواسطة وكيلين دون مالك واحد واضح.
3. **لا تجاوز لبوابات الأمان**: يُمنع استخدام `|| true` أو إضعاف بوابات الأمان `govulncheck` و`npm audit`.
4. **لا حذف للتأكيدات (Zero Disabled Assertions)**: ممنوع حذف Assertions أو تمديد Timeouts للتغطية على عيب غير مشخص.
5. **منع المساس بالإنتاج**: ممنوع تعديل بيانات الإنتاج، أو النشر للإنتاج، أو تنفيذ أي عمليات مدمرة دون تفويض صريح مستقل.
