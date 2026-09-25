package postgres

import (
	"context"

	content "github.com/nasef6464/almeaago/internal/content/domain"
)

const (
	maxLearnerCourseModules    = 200
	maxLearnerCoursePlacements = 5000
	maxLearnerModulePlacements = 500
	maxLearnerTopicPlacements  = 1000
)

func (r *Repository) GetLearningSpace(ctx context.Context, pathID, subjectID string, limit int) (content.LearningSpace, error) {
	ok, err := r.learningTaxonomyExists(ctx, pathID, subjectID)
	if err != nil {
		return content.LearningSpace{}, err
	}
	if !ok {
		return content.LearningSpace{}, content.ErrNotFound
	}

	result := content.LearningSpace{
		PathID:       pathID,
		SubjectID:    subjectID,
		Courses:      []content.LearnerCourseSummary{},
		Foundation:   []content.LearnerTopicSummary{},
		LibraryItems: []content.LearnerLibrarySummary{},
	}

	courseRows, err := r.db.Query(ctx, `
		SELECT c.id::text,c.title,c.description,c.instructor_name,c.duration_minutes,c.level,
		       COALESCE(a.id::text,''),c.drip_content_enabled,c.certificate_enabled
		FROM courses c
		LEFT JOIN assets a ON a.id=c.thumbnail_asset_id AND a.status='active'
		WHERE c.path_id=$1::uuid AND c.subject_id=$2::uuid
		  AND c.workflow_status='approved' AND c.is_published=true AND c.is_visible=true
		ORDER BY c.published_at DESC,c.id DESC
		LIMIT $3
	`, pathID, subjectID, limit+1)
	if err != nil {
		return content.LearningSpace{}, mapError(err)
	}
	for courseRows.Next() {
		var row content.LearnerCourseSummary
		if err := courseRows.Scan(
			&row.ID,
			&row.Title,
			&row.Description,
			&row.InstructorName,
			&row.DurationMinutes,
			&row.Level,
			&row.ThumbnailAssetID,
			&row.DripContentEnabled,
			&row.CertificateEnabled,
		); err != nil {
			courseRows.Close()
			return content.LearningSpace{}, err
		}
		result.Courses = append(result.Courses, row)
	}
	if err := courseRows.Err(); err != nil {
		courseRows.Close()
		return content.LearningSpace{}, err
	}
	courseRows.Close()
	result.CoursesHasMore = len(result.Courses) > limit
	if result.CoursesHasMore {
		result.Courses = result.Courses[:limit]
	}

	topicRows, err := r.db.Query(ctx, `
		SELECT id::text,COALESCE(parent_topic_id::text,''),title,description,sort_order,is_locked
		FROM foundation_topics
		WHERE path_id=$1::uuid AND subject_id=$2::uuid
		  AND status='active' AND is_visible=true
		ORDER BY sort_order,id
		LIMIT $3
	`, pathID, subjectID, limit+1)
	if err != nil {
		return content.LearningSpace{}, mapError(err)
	}
	for topicRows.Next() {
		var row content.LearnerTopicSummary
		if err := topicRows.Scan(
			&row.ID,
			&row.ParentTopicID,
			&row.Title,
			&row.Description,
			&row.SortOrder,
			&row.IsLocked,
		); err != nil {
			topicRows.Close()
			return content.LearningSpace{}, err
		}
		result.Foundation = append(result.Foundation, row)
	}
	if err := topicRows.Err(); err != nil {
		topicRows.Close()
		return content.LearningSpace{}, err
	}
	topicRows.Close()
	result.FoundationHasMore = len(result.Foundation) > limit
	if result.FoundationHasMore {
		result.Foundation = result.Foundation[:limit]
	}

	libraryRows, err := r.db.Query(ctx, `
		SELECT id::text,title,description,item_type,is_locked
		FROM library_items
		WHERE path_id=$1::uuid AND subject_id=$2::uuid
		  AND workflow_status='approved' AND is_visible=true
		ORDER BY updated_at DESC,id DESC
		LIMIT $3
	`, pathID, subjectID, limit+1)
	if err != nil {
		return content.LearningSpace{}, mapError(err)
	}
	for libraryRows.Next() {
		var row content.LearnerLibrarySummary
		if err := libraryRows.Scan(&row.ID, &row.Title, &row.Description, &row.ItemType, &row.IsLocked); err != nil {
			libraryRows.Close()
			return content.LearningSpace{}, err
		}
		result.LibraryItems = append(result.LibraryItems, row)
	}
	if err := libraryRows.Err(); err != nil {
		libraryRows.Close()
		return content.LearningSpace{}, err
	}
	libraryRows.Close()
	result.LibraryHasMore = len(result.LibraryItems) > limit
	if result.LibraryHasMore {
		result.LibraryItems = result.LibraryItems[:limit]
	}

	return result, nil
}

func (r *Repository) GetLearnerCourse(ctx context.Context, courseID string) (content.LearnerCourse, error) {
	var result content.LearnerCourse
	var thumbnailAssetID string
	err := r.db.QueryRow(ctx, `
		SELECT c.id::text,c.title,c.description,c.instructor_name,c.duration_minutes,c.level,
		       COALESCE(a.id::text,''),c.drip_content_enabled,c.certificate_enabled
		FROM courses c
		LEFT JOIN assets a ON a.id=c.thumbnail_asset_id AND a.status='active'
		WHERE c.id=$1::uuid
		  AND c.workflow_status='approved' AND c.is_published=true AND c.is_visible=true
	`, courseID).Scan(
		&result.Course.ID,
		&result.Course.Title,
		&result.Course.Description,
		&result.Course.InstructorName,
		&result.Course.DurationMinutes,
		&result.Course.Level,
		&thumbnailAssetID,
		&result.Course.DripContentEnabled,
		&result.Course.CertificateEnabled,
	)
	if err != nil {
		return content.LearnerCourse{}, mapError(err)
	}
	result.Course.ThumbnailAssetID = thumbnailAssetID

	moduleRows, err := r.db.Query(ctx, `
		SELECT id::text,title,description,sort_order
		FROM course_modules
		WHERE course_id=$1::uuid AND status='active'
		ORDER BY sort_order,id
		LIMIT 201
	`, courseID)
	if err != nil {
		return content.LearnerCourse{}, mapError(err)
	}
	result.Modules = make([]content.LearnerCourseModule, 0, 16)
	moduleIndex := make(map[string]int, 16)
	for moduleRows.Next() {
		if len(result.Modules) >= maxLearnerCourseModules {
			moduleRows.Close()
			return content.LearnerCourse{}, content.ErrConflict
		}
		var row content.LearnerCourseModule
		if err := moduleRows.Scan(&row.ID, &row.Title, &row.Description, &row.SortOrder); err != nil {
			moduleRows.Close()
			return content.LearnerCourse{}, err
		}
		row.Lessons = []content.LearnerLessonSummary{}
		moduleIndex[row.ID] = len(result.Modules)
		result.Modules = append(result.Modules, row)
	}
	if err := moduleRows.Err(); err != nil {
		moduleRows.Close()
		return content.LearnerCourse{}, err
	}
	moduleRows.Close()

	lessonRows, err := r.db.Query(ctx, `
		SELECT cl.module_id::text,l.id::text,l.title,l.description,l.lesson_type,l.duration_seconds,
		       l.is_locked,cl.is_preview,cl.sort_order
		FROM course_lessons cl
		JOIN course_modules cm ON cm.id=cl.module_id AND cm.status='active'
		JOIN lessons l ON l.id=cl.lesson_id
		WHERE cm.course_id=$1::uuid
		  AND l.workflow_status='approved' AND l.is_visible=true
		ORDER BY cm.sort_order,cm.id,cl.sort_order,l.id
		LIMIT 5001
	`, courseID)
	if err != nil {
		return content.LearnerCourse{}, mapError(err)
	}
	defer lessonRows.Close()
	placementCount := 0
	for lessonRows.Next() {
		if placementCount >= maxLearnerCoursePlacements {
			return content.LearnerCourse{}, content.ErrConflict
		}
		var moduleID string
		var row content.LearnerLessonSummary
		if err := lessonRows.Scan(
			&moduleID,
			&row.ID,
			&row.Title,
			&row.Description,
			&row.LessonType,
			&row.DurationSeconds,
			&row.IsLocked,
			&row.IsPreview,
			&row.SortOrder,
		); err != nil {
			return content.LearnerCourse{}, err
		}
		index, ok := moduleIndex[moduleID]
		if !ok {
			return content.LearnerCourse{}, content.ErrConflict
		}
		if len(result.Modules[index].Lessons) >= maxLearnerModulePlacements {
			return content.LearnerCourse{}, content.ErrConflict
		}
		result.Modules[index].Lessons = append(result.Modules[index].Lessons, row)
		placementCount++
	}
	if err := lessonRows.Err(); err != nil {
		return content.LearnerCourse{}, err
	}
	return result, nil
}

func (r *Repository) GetLearnerTopic(ctx context.Context, topicID string) (content.LearnerTopic, error) {
	var result content.LearnerTopic
	err := r.db.QueryRow(ctx, `
		SELECT id::text,COALESCE(parent_topic_id::text,''),title,description,sort_order,is_locked
		FROM foundation_topics
		WHERE id=$1::uuid AND status='active' AND is_visible=true
	`, topicID).Scan(
		&result.Topic.ID,
		&result.Topic.ParentTopicID,
		&result.Topic.Title,
		&result.Topic.Description,
		&result.Topic.SortOrder,
		&result.Topic.IsLocked,
	)
	if err != nil {
		return content.LearnerTopic{}, mapError(err)
	}

	result.Lessons = []content.LearnerLessonSummary{}
	lessonRows, err := r.db.Query(ctx, `
		SELECT l.id::text,l.title,l.description,l.lesson_type,l.duration_seconds,l.is_locked,tl.sort_order
		FROM topic_lessons tl
		JOIN lessons l ON l.id=tl.lesson_id
		WHERE tl.topic_id=$1::uuid
		  AND l.workflow_status='approved' AND l.is_visible=true
		ORDER BY tl.sort_order,l.id
		LIMIT 1001
	`, topicID)
	if err != nil {
		return content.LearnerTopic{}, mapError(err)
	}
	for lessonRows.Next() {
		if len(result.Lessons) >= maxLearnerTopicPlacements {
			lessonRows.Close()
			return content.LearnerTopic{}, content.ErrConflict
		}
		var row content.LearnerLessonSummary
		if err := lessonRows.Scan(
			&row.ID,
			&row.Title,
			&row.Description,
			&row.LessonType,
			&row.DurationSeconds,
			&row.IsLocked,
			&row.SortOrder,
		); err != nil {
			lessonRows.Close()
			return content.LearnerTopic{}, err
		}
		result.Lessons = append(result.Lessons, row)
	}
	if err := lessonRows.Err(); err != nil {
		lessonRows.Close()
		return content.LearnerTopic{}, err
	}
	lessonRows.Close()

	result.LibraryItems = []content.LearnerLibrarySummary{}
	libraryRows, err := r.db.Query(ctx, `
		SELECT li.id::text,li.title,li.description,li.item_type,li.is_locked
		FROM topic_library_items tli
		JOIN library_items li ON li.id=tli.library_item_id
		WHERE tli.topic_id=$1::uuid
		  AND li.workflow_status='approved' AND li.is_visible=true
		ORDER BY tli.sort_order,li.id
		LIMIT 1001
	`, topicID)
	if err != nil {
		return content.LearnerTopic{}, mapError(err)
	}
	defer libraryRows.Close()
	for libraryRows.Next() {
		if len(result.LibraryItems) >= maxLearnerTopicPlacements {
			return content.LearnerTopic{}, content.ErrConflict
		}
		var row content.LearnerLibrarySummary
		if err := libraryRows.Scan(&row.ID, &row.Title, &row.Description, &row.ItemType, &row.IsLocked); err != nil {
			return content.LearnerTopic{}, err
		}
		result.LibraryItems = append(result.LibraryItems, row)
	}
	if err := libraryRows.Err(); err != nil {
		return content.LearnerTopic{}, err
	}
	return result, nil
}

func (r *Repository) learningTaxonomyExists(ctx context.Context, pathID, subjectID string) (bool, error) {
	var ok bool
	err := r.db.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1
			FROM paths p
			JOIN subjects s ON s.path_id=p.id
			WHERE p.id=$1::uuid AND s.id=$2::uuid
			  AND p.status='active' AND s.status='active'
		)
	`, pathID, subjectID).Scan(&ok)
	if err != nil {
		return false, mapError(err)
	}
	return ok, nil
}
