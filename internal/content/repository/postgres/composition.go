package postgres

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"

	content "github.com/nasef6464/almeaago/internal/content/domain"
	operations "github.com/nasef6464/almeaago/internal/operations/domain"
)

const (
	maxActiveCourseModules = 200
	maxLessonsPerModule    = 500
	maxTopicPlacements     = 1000
)

func (r *Repository) CreateCourseModule(ctx context.Context, actorUserID, courseID string, expectedRevision int, title, description string, sortOrder int) (content.CourseModule, int, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return content.CourseModule{}, 0, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	newRevision, err := bumpCourseRevisionTx(ctx, tx, courseID, expectedRevision)
	if err != nil {
		return content.CourseModule{}, 0, err
	}
	var activeCount int
	if err := tx.QueryRow(ctx, `SELECT count(*) FROM course_modules WHERE course_id=$1::uuid AND status='active'`, courseID).Scan(&activeCount); err != nil {
		return content.CourseModule{}, 0, err
	}
	if activeCount >= maxActiveCourseModules {
		return content.CourseModule{}, 0, content.ErrConflict
	}
	var row content.CourseModule
	if err := tx.QueryRow(ctx, `
		INSERT INTO course_modules(course_id,title,description,sort_order,status)
		VALUES($1::uuid,$2,$3,$4,'active')
		RETURNING id::text,course_id::text,title,description,sort_order,status,created_at,updated_at
	`, courseID, title, description, sortOrder).Scan(
		&row.ID, &row.CourseID, &row.Title, &row.Description, &row.SortOrder, &row.Status, &row.CreatedAt, &row.UpdatedAt,
	); err != nil {
		return content.CourseModule{}, 0, mapError(err)
	}
	row.Lessons = []content.CourseLessonPlacement{}
	if err := r.writeAudit(ctx, tx, operations.AuditEvent{
		ActorUserID: actorUserID, Action: "content.course.module.create", ResourceType: "course_module", ResourceID: row.ID,
		Metadata: map[string]any{"courseId": courseID, "courseRevision": newRevision},
	}); err != nil {
		return content.CourseModule{}, 0, err
	}
	if err := tx.Commit(ctx); err != nil {
		return content.CourseModule{}, 0, err
	}
	return row, newRevision, nil
}

func (r *Repository) UpdateCourseModule(ctx context.Context, actorUserID, courseID, moduleID string, expectedRevision int, title, description, status string, sortOrder int) (content.CourseModule, int, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return content.CourseModule{}, 0, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	newRevision, err := bumpCourseRevisionTx(ctx, tx, courseID, expectedRevision)
	if err != nil {
		return content.CourseModule{}, 0, err
	}
	var row content.CourseModule
	if err := tx.QueryRow(ctx, `
		UPDATE course_modules
		SET title=$3,description=$4,sort_order=$5,status=$6,updated_at=now()
		WHERE id=$1::uuid AND course_id=$2::uuid
		RETURNING id::text,course_id::text,title,description,sort_order,status,created_at,updated_at
	`, moduleID, courseID, title, description, sortOrder, status).Scan(
		&row.ID, &row.CourseID, &row.Title, &row.Description, &row.SortOrder, &row.Status, &row.CreatedAt, &row.UpdatedAt,
	); err != nil {
		return content.CourseModule{}, 0, mapError(err)
	}
	row.Lessons, err = listModuleLessonsTx(ctx, tx, row.ID)
	if err != nil {
		return content.CourseModule{}, 0, err
	}
	if err := r.writeAudit(ctx, tx, operations.AuditEvent{
		ActorUserID: actorUserID, Action: "content.course.module.update", ResourceType: "course_module", ResourceID: row.ID,
		Metadata: map[string]any{"courseId": courseID, "courseRevision": newRevision, "status": status},
	}); err != nil {
		return content.CourseModule{}, 0, err
	}
	if err := tx.Commit(ctx); err != nil {
		return content.CourseModule{}, 0, err
	}
	return row, newRevision, nil
}

func (r *Repository) ListCourseModules(ctx context.Context, courseID string) ([]content.CourseModule, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id::text,course_id::text,title,description,sort_order,status,created_at,updated_at
		FROM course_modules
		WHERE course_id=$1::uuid
		ORDER BY sort_order,id
		LIMIT 201
	`, courseID)
	if err != nil {
		return nil, mapError(err)
	}
	defer rows.Close()
	modules := make([]content.CourseModule, 0, 16)
	for rows.Next() {
		var row content.CourseModule
		if err := rows.Scan(&row.ID, &row.CourseID, &row.Title, &row.Description, &row.SortOrder, &row.Status, &row.CreatedAt, &row.UpdatedAt); err != nil {
			return nil, err
		}
		if len(modules) >= maxActiveCourseModules {
			return nil, content.ErrConflict
		}
		row.Lessons, err = r.listModuleLessons(ctx, row.ID)
		if err != nil {
			return nil, err
		}
		modules = append(modules, row)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return modules, nil
}

func (r *Repository) PlaceCourseLesson(ctx context.Context, actorUserID, courseID, moduleID, lessonID string, expectedRevision, sortOrder int, preview bool) (int, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return 0, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	newRevision, err := bumpCourseRevisionTx(ctx, tx, courseID, expectedRevision)
	if err != nil {
		return 0, err
	}
	var moduleCourseID string
	if err := tx.QueryRow(ctx, `
		SELECT course_id::text FROM course_modules
		WHERE id=$1::uuid AND status='active'
		FOR UPDATE
	`, moduleID).Scan(&moduleCourseID); err != nil {
		return 0, mapError(err)
	}
	if moduleCourseID != courseID {
		return 0, content.ErrConflict
	}
	var coursePath, courseSubject, lessonPath, lessonSubject string
	if err := tx.QueryRow(ctx, `SELECT path_id::text,subject_id::text FROM courses WHERE id=$1::uuid`, courseID).Scan(&coursePath, &courseSubject); err != nil {
		return 0, mapError(err)
	}
	if err := tx.QueryRow(ctx, `
		SELECT path_id::text,subject_id::text FROM lessons
		WHERE id=$1::uuid AND workflow_status<>'archived'
	`, lessonID).Scan(&lessonPath, &lessonSubject); err != nil {
		return 0, mapError(err)
	}
	if coursePath != lessonPath || courseSubject != lessonSubject {
		return 0, content.ErrConflict
	}
	var exists bool
	var count int
	if err := tx.QueryRow(ctx, `
		SELECT EXISTS(SELECT 1 FROM course_lessons WHERE module_id=$1::uuid AND lesson_id=$2::uuid),
		       count(*)
		FROM course_lessons
		WHERE module_id=$1::uuid
	`, moduleID, lessonID).Scan(&exists, &count); err != nil {
		return 0, err
	}
	if !exists && count >= maxLessonsPerModule {
		return 0, content.ErrConflict
	}
	if _, err := tx.Exec(ctx, `
		INSERT INTO course_lessons(module_id,lesson_id,sort_order,is_preview)
		VALUES($1::uuid,$2::uuid,$3,$4)
		ON CONFLICT(module_id,lesson_id)
		DO UPDATE SET sort_order=EXCLUDED.sort_order,is_preview=EXCLUDED.is_preview
	`, moduleID, lessonID, sortOrder, preview); err != nil {
		return 0, mapError(err)
	}
	if err := r.writeAudit(ctx, tx, operations.AuditEvent{
		ActorUserID: actorUserID, Action: "content.course.lesson.place", ResourceType: "course", ResourceID: courseID,
		Metadata: map[string]any{"moduleId": moduleID, "lessonId": lessonID, "sortOrder": sortOrder, "preview": preview, "courseRevision": newRevision},
	}); err != nil {
		return 0, err
	}
	if err := tx.Commit(ctx); err != nil {
		return 0, err
	}
	return newRevision, nil
}

func (r *Repository) RemoveCourseLesson(ctx context.Context, actorUserID, courseID, moduleID, lessonID string, expectedRevision int) (int, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return 0, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	newRevision, err := bumpCourseRevisionTx(ctx, tx, courseID, expectedRevision)
	if err != nil {
		return 0, err
	}
	command, err := tx.Exec(ctx, `
		DELETE FROM course_lessons cl
		USING course_modules cm
		WHERE cl.module_id=cm.id AND cm.course_id=$1::uuid
		  AND cl.module_id=$2::uuid AND cl.lesson_id=$3::uuid
	`, courseID, moduleID, lessonID)
	if err != nil {
		return 0, mapError(err)
	}
	if command.RowsAffected() != 1 {
		return 0, content.ErrNotFound
	}
	if err := r.writeAudit(ctx, tx, operations.AuditEvent{
		ActorUserID: actorUserID, Action: "content.course.lesson.remove", ResourceType: "course", ResourceID: courseID,
		Metadata: map[string]any{"moduleId": moduleID, "lessonId": lessonID, "courseRevision": newRevision},
	}); err != nil {
		return 0, err
	}
	if err := tx.Commit(ctx); err != nil {
		return 0, err
	}
	return newRevision, nil
}

func (r *Repository) ListTopicPlacements(ctx context.Context, topicID string) (content.FoundationPlacements, error) {
	result := content.FoundationPlacements{
		Lessons:      []content.TopicLessonPlacement{},
		LibraryItems: []content.TopicLibraryPlacement{},
	}
	lessonRows, err := r.db.Query(ctx, `
		SELECT lesson_id::text,sort_order
		FROM topic_lessons
		WHERE topic_id=$1::uuid
		ORDER BY sort_order,lesson_id
		LIMIT 1001
	`, topicID)
	if err != nil {
		return content.FoundationPlacements{}, mapError(err)
	}
	for lessonRows.Next() {
		if len(result.Lessons) >= maxTopicPlacements {
			lessonRows.Close()
			return content.FoundationPlacements{}, content.ErrConflict
		}
		var row content.TopicLessonPlacement
		if err := lessonRows.Scan(&row.LessonID, &row.SortOrder); err != nil {
			lessonRows.Close()
			return content.FoundationPlacements{}, err
		}
		result.Lessons = append(result.Lessons, row)
	}
	if err := lessonRows.Err(); err != nil {
		lessonRows.Close()
		return content.FoundationPlacements{}, err
	}
	lessonRows.Close()

	libraryRows, err := r.db.Query(ctx, `
		SELECT library_item_id::text,sort_order
		FROM topic_library_items
		WHERE topic_id=$1::uuid
		ORDER BY sort_order,library_item_id
		LIMIT 1001
	`, topicID)
	if err != nil {
		return content.FoundationPlacements{}, mapError(err)
	}
	defer libraryRows.Close()
	for libraryRows.Next() {
		if len(result.LibraryItems) >= maxTopicPlacements {
			return content.FoundationPlacements{}, content.ErrConflict
		}
		var row content.TopicLibraryPlacement
		if err := libraryRows.Scan(&row.LibraryItemID, &row.SortOrder); err != nil {
			return content.FoundationPlacements{}, err
		}
		result.LibraryItems = append(result.LibraryItems, row)
	}
	if err := libraryRows.Err(); err != nil {
		return content.FoundationPlacements{}, err
	}
	return result, nil
}

func (r *Repository) LinkTopicLesson(ctx context.Context, actorUserID, topicID, lessonID string, expectedRevision, sortOrder int) (int, error) {
	return r.mutateTopicPlacement(ctx, actorUserID, topicID, expectedRevision, "lesson", lessonID, sortOrder, false)
}

func (r *Repository) UnlinkTopicLesson(ctx context.Context, actorUserID, topicID, lessonID string, expectedRevision int) (int, error) {
	return r.mutateTopicPlacement(ctx, actorUserID, topicID, expectedRevision, "lesson", lessonID, 0, true)
}

func (r *Repository) LinkTopicLibrary(ctx context.Context, actorUserID, topicID, itemID string, expectedRevision, sortOrder int) (int, error) {
	return r.mutateTopicPlacement(ctx, actorUserID, topicID, expectedRevision, "library", itemID, sortOrder, false)
}

func (r *Repository) UnlinkTopicLibrary(ctx context.Context, actorUserID, topicID, itemID string, expectedRevision int) (int, error) {
	return r.mutateTopicPlacement(ctx, actorUserID, topicID, expectedRevision, "library", itemID, 0, true)
}

func (r *Repository) mutateTopicPlacement(ctx context.Context, actorUserID, topicID string, expectedRevision int, kind, targetID string, sortOrder int, remove bool) (int, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return 0, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	newRevision, pathID, subjectID, err := bumpTopicRevisionTx(ctx, tx, topicID, expectedRevision)
	if err != nil {
		return 0, err
	}
	action := ""
	metadata := map[string]any{"topicRevision": newRevision}
	switch kind {
	case "lesson":
		if !remove {
			if err := validateTopicLessonTx(ctx, tx, targetID, pathID, subjectID); err != nil {
				return 0, err
			}
			var count int
			if err := tx.QueryRow(ctx, `SELECT count(*) FROM topic_lessons WHERE topic_id=$1::uuid`, topicID).Scan(&count); err != nil {
				return 0, err
			}
			if count >= maxTopicPlacements {
				var exists bool
				if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM topic_lessons WHERE topic_id=$1::uuid AND lesson_id=$2::uuid)`, topicID, targetID).Scan(&exists); err != nil {
					return 0, err
				}
				if !exists {
					return 0, content.ErrConflict
				}
			}
			if _, err := tx.Exec(ctx, `
				INSERT INTO topic_lessons(topic_id,lesson_id,sort_order)
				VALUES($1::uuid,$2::uuid,$3)
				ON CONFLICT(topic_id,lesson_id) DO UPDATE SET sort_order=EXCLUDED.sort_order
			`, topicID, targetID, sortOrder); err != nil {
				return 0, mapError(err)
			}
			action = "content.foundation.lesson.link"
		} else {
			command, err := tx.Exec(ctx, `DELETE FROM topic_lessons WHERE topic_id=$1::uuid AND lesson_id=$2::uuid`, topicID, targetID)
			if err != nil {
				return 0, mapError(err)
			}
			if command.RowsAffected() != 1 {
				return 0, content.ErrNotFound
			}
			action = "content.foundation.lesson.unlink"
		}
		metadata["lessonId"] = targetID
	case "library":
		if !remove {
			if err := validateTopicLibraryTx(ctx, tx, targetID, pathID, subjectID); err != nil {
				return 0, err
			}
			var count int
			if err := tx.QueryRow(ctx, `SELECT count(*) FROM topic_library_items WHERE topic_id=$1::uuid`, topicID).Scan(&count); err != nil {
				return 0, err
			}
			if count >= maxTopicPlacements {
				var exists bool
				if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM topic_library_items WHERE topic_id=$1::uuid AND library_item_id=$2::uuid)`, topicID, targetID).Scan(&exists); err != nil {
					return 0, err
				}
				if !exists {
					return 0, content.ErrConflict
				}
			}
			if _, err := tx.Exec(ctx, `
				INSERT INTO topic_library_items(topic_id,library_item_id,sort_order)
				VALUES($1::uuid,$2::uuid,$3)
				ON CONFLICT(topic_id,library_item_id) DO UPDATE SET sort_order=EXCLUDED.sort_order
			`, topicID, targetID, sortOrder); err != nil {
				return 0, mapError(err)
			}
			action = "content.foundation.library.link"
		} else {
			command, err := tx.Exec(ctx, `DELETE FROM topic_library_items WHERE topic_id=$1::uuid AND library_item_id=$2::uuid`, topicID, targetID)
			if err != nil {
				return 0, mapError(err)
			}
			if command.RowsAffected() != 1 {
				return 0, content.ErrNotFound
			}
			action = "content.foundation.library.unlink"
		}
		metadata["libraryItemId"] = targetID
	default:
		return 0, errors.New("unsupported topic placement kind")
	}
	if !remove {
		metadata["sortOrder"] = sortOrder
	}
	if err := r.writeAudit(ctx, tx, operations.AuditEvent{
		ActorUserID: actorUserID, Action: action, ResourceType: "foundation_topic", ResourceID: topicID, Metadata: metadata,
	}); err != nil {
		return 0, err
	}
	if err := tx.Commit(ctx); err != nil {
		return 0, err
	}
	return newRevision, nil
}

func bumpCourseRevisionTx(ctx context.Context, tx pgx.Tx, courseID string, expectedRevision int) (int, error) {
	var revision int
	err := tx.QueryRow(ctx, `
		UPDATE courses
		SET revision=revision+1,updated_at=now()
		WHERE id=$1::uuid AND revision=$2 AND workflow_status NOT IN ('approved','archived')
		RETURNING revision
	`, courseID, expectedRevision).Scan(&revision)
	if err != nil {
		return 0, mapUpdateError(ctx, tx, "courses", courseID, expectedRevision, err)
	}
	return revision, nil
}

func bumpTopicRevisionTx(ctx context.Context, tx pgx.Tx, topicID string, expectedRevision int) (int, string, string, error) {
	var revision int
	var pathID, subjectID string
	err := tx.QueryRow(ctx, `
		UPDATE foundation_topics
		SET revision=revision+1,updated_at=now()
		WHERE id=$1::uuid AND revision=$2 AND status='active'
		RETURNING revision,path_id::text,subject_id::text
	`, topicID, expectedRevision).Scan(&revision, &pathID, &subjectID)
	if err != nil {
		return 0, "", "", mapUpdateError(ctx, tx, "foundation_topics", topicID, expectedRevision, err)
	}
	return revision, pathID, subjectID, nil
}

func validateTopicLessonTx(ctx context.Context, tx pgx.Tx, lessonID, pathID, subjectID string) error {
	var ok bool
	if err := tx.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1 FROM lessons
			WHERE id=$1::uuid AND path_id=$2::uuid AND subject_id=$3::uuid AND workflow_status<>'archived'
		)
	`, lessonID, pathID, subjectID).Scan(&ok); err != nil {
		return mapError(err)
	}
	if !ok {
		return content.ErrConflict
	}
	return nil
}

func validateTopicLibraryTx(ctx context.Context, tx pgx.Tx, itemID, pathID, subjectID string) error {
	var ok bool
	if err := tx.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1 FROM library_items
			WHERE id=$1::uuid AND path_id=$2::uuid AND subject_id=$3::uuid AND workflow_status<>'archived'
		)
	`, itemID, pathID, subjectID).Scan(&ok); err != nil {
		return mapError(err)
	}
	if !ok {
		return content.ErrConflict
	}
	return nil
}

func (r *Repository) listModuleLessons(ctx context.Context, moduleID string) ([]content.CourseLessonPlacement, error) {
	rows, err := r.db.Query(ctx, `
		SELECT lesson_id::text,sort_order,is_preview
		FROM course_lessons
		WHERE module_id=$1::uuid
		ORDER BY sort_order,lesson_id
		LIMIT 501
	`, moduleID)
	if err != nil {
		return nil, mapError(err)
	}
	defer rows.Close()
	result := make([]content.CourseLessonPlacement, 0, 16)
	for rows.Next() {
		if len(result) >= maxLessonsPerModule {
			return nil, content.ErrConflict
		}
		var row content.CourseLessonPlacement
		if err := rows.Scan(&row.LessonID, &row.SortOrder, &row.IsPreview); err != nil {
			return nil, err
		}
		result = append(result, row)
	}
	return result, rows.Err()
}

func listModuleLessonsTx(ctx context.Context, tx pgx.Tx, moduleID string) ([]content.CourseLessonPlacement, error) {
	rows, err := tx.Query(ctx, `
		SELECT lesson_id::text,sort_order,is_preview
		FROM course_lessons
		WHERE module_id=$1::uuid
		ORDER BY sort_order,lesson_id
		LIMIT 501
	`, moduleID)
	if err != nil {
		return nil, mapError(err)
	}
	defer rows.Close()
	result := make([]content.CourseLessonPlacement, 0, 16)
	for rows.Next() {
		if len(result) >= maxLessonsPerModule {
			return nil, content.ErrConflict
		}
		var row content.CourseLessonPlacement
		if err := rows.Scan(&row.LessonID, &row.SortOrder, &row.IsPreview); err != nil {
			return nil, err
		}
		result = append(result, row)
	}
	return result, rows.Err()
}
