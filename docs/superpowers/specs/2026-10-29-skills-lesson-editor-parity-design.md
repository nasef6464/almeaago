# ALMEAA Skills → Lesson Creation and Editing — Design

## Contract and intent

The owner requires the original admin journey: **Skills Center stays independent from Paths Center**, and a subskill card offers linked lessons, link-existing, **add new lesson**, **edit lesson**, and detach. Legacy reference: `almeaacodax@bf7281f`, `dashboards/admin/SkillsTreeManager.tsx` lines 340–383 and 636–675. The existing target branch already implements listing/link/detach but omits create/edit within the card.

## Approaches

1. Copy Legacy `Lesson`/store/editor: rejected because Mongo/Zustand-era business logic bypasses Go authorization and content ownership.
2. Create a second lesson form inside Skills Center: rejected because fields and validation will diverge from canonical Go content.
3. **Chosen:** reuse `LessonEditorPanel`, with initial path/subject/required subskill and a scoped invocation from `SkillsAdminPage`. Go's existing Content API owns create/update and PostgreSQL link rows. This follows the owner's existing instruction to choose the safe engineering implementation and continue autonomously.

## Accepted behavior

- Within an expanded subskill: “إضافة درس جديد” opens the existing canonical lesson builder, preselects its current path, subject and subskill, and prevents accidental removal of the anchor skill during creation. Other same-subject skills remain optional.
- “تعديل الدرس” opens that same builder for the selected linked lesson and retains the current subskill association while editing there. Go keeps approved/archived lessons read-only. No separate backend or database table is created.
- On successful create/update, the builder closes, linked lessons refresh from the server, and the subskill stays open. On network, validation, CSRF, or revision failure the builder retains the draft and displays an error. Cancel never creates content.
- Browser evidence tests open/create/edit and server-scoped data. Tests with fixture APIs prove the UI wiring, not live database or full visual parity. No production writes/merge/cutover.

## Review hazards

- Taxonomy's asynchronous load must not clear the preselected subskill.
- A fast context change or cancellation must not associate a lesson to the wrong subject/path.
- Existing editor behavior for general admins/teachers must stay unchanged when no required skill is passed.
- A mismatched existing lesson or approved/archived lesson must not become editable by opening from Skills Center.
- Network failures must not close the draft or show a success message.
