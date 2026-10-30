---
name: almeaa-release-orchestrator
description: >-
  Orchestrates the vertical capability slice release lifecycle for ALMEAA. Ensures every
  slice closes Actor -> Screen -> HTTP -> Domain -> PostgreSQL completely with build,
  typecheck, test, and visual parity evidence before handoff.
---

# ALMEAA Release Orchestrator

## الغرض
حوكمة واعتماد إغلاق الشرائح العمودية (Vertical Capability Slices) والتأكد من استيفاء بوابات الجودة الأربعة قبل الإعلان عن إنجاز أي شريحة.

## بوابات الجودة الأربعة الإلزامية (Acceptance Gates)
1. **بوابة البناء (Build Gate):**
   - تجميع الـ Go API: `go build ./cmd/api` بنجاح.
   - فحص الأنواع بـ TypeScript: `npm run typecheck` بنتيجة 0 أخطاء.
2. **بوابة الاختبارات (Test Gate):**
   - نجاح كافة اختبارات Go: `go test ./internal/...`.
   - نجاح كافة اختبارات Playwright E2E للشريحة.
3. **بوابة قاعدة البيانات (Database Gate):**
   - تطبيق ملفات الهجرة والتأكد من سلامة القيود التزامنية والمفاتيح الأجنبية.
4. **بوابة التطابق البصري (Visual Parity Gate):**
   - لقطات شاشة موثقة ومقارنة مع الأصل عند المقاسات الثلاثة (390px, 820px, 1440px RTL).
