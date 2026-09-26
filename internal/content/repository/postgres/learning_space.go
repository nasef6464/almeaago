package postgres

import (
	"context"

	"github.com/jackc/pgx/v5"

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

func (r *Repository) GetLearnerCourseLesson(ctx context.Context, courseID, lessonID string) (content.LearnerLessonDetail, error) {
	var row content.LearnerLessonDetail
	err := r.db.QueryRow(ctx, `
		SELECT l.id::text,l.title,l.description,l.lesson_type,l.duration_seconds,l.is_locked,
		       cl.is_preview,cl.sort_order,l.content_text,COALESCE(l.video_url,''),COALESCE(l.video_source,'')
		FROM course_lessons cl
		JOIN course_modules cm ON cm.id=cl.module_id AND cm.status='active'
		JOIN courses c ON c.id=cm.course_id
		JOIN lessons l ON l.id=cl.lesson_id
		WHERE c.id=$1::uuid
		  AND l.id=$2::uuid
		  AND c.workflow_status='approved' AND c.is_published=true AND c.is_visible=true
		  AND l.workflow_status='approved' AND l.is_visible=true
		  AND (l.is_locked=false OR cl.is_preview=true)
		ORDER BY cm.sort_order,cm.id,cl.sort_order
		LIMIT 1
	`, courseID, lessonID).Scan(
		&row.ID, &row.Title, &row.Description, &row.LessonType, &row.DurationSeconds, &row.IsLocked,
		&row.IsPreview, &row.SortOrder, &row.ContentText, &row.VideoURL, &row.VideoSource,
	)
	if err != nil {
		return row, mapError(err)
	}
	return row, nil
}

// ResolveLessonProgressTarget is Learning's bounded Content read boundary.
// It returns false for hidden/locked content so Learning never grants access itself.
func (r *Repository) ResolveLessonProgressTarget(ctx context.Context, contextType, contextID, lessonID string) (bool, string, int, error) {
	var lessonType string
	var duration int
	switch contextType {
	case "course":
		err := r.db.QueryRow(ctx, `
			SELECT l.lesson_type,l.duration_seconds
			FROM course_lessons cl
			JOIN course_modules cm ON cm.id=cl.module_id AND cm.status='active'
			JOIN courses c ON c.id=cm.course_id
			JOIN lessons l ON l.id=cl.lesson_id
			WHERE c.id=$1::uuid AND l.id=$2::uuid
			  AND c.workflow_status='approved' AND c.is_published=true AND c.is_visible=true
			  AND l.workflow_status='approved' AND l.is_visible=true
			  AND (l.is_locked=false OR cl.is_preview=true)
			LIMIT 1
		`, contextID, lessonID).Scan(&lessonType, &duration)
		if err != nil {
			if err == pgx.ErrNoRows {
				return false, "", 0, nil
			}
			return false, "", 0, mapError(err)
		}
		return true, lessonType, duration, nil
	case "foundation":
		err := r.db.QueryRow(ctx, `
			SELECT l.lesson_type,l.duration_seconds
			FROM topic_lessons tl
			JOIN foundation_topics t ON t.id=tl.topic_id
			JOIN lessons l ON l.id=tl.lesson_id
			WHERE t.id=$1::uuid AND l.id=$2::uuid
			  AND t.status='active' AND t.is_visible=true AND t.is_locked=false
			  AND l.workflow_status='approved' AND l.is_visible=true AND l.is_locked=false
			LIMIT 1
		`, contextID, lessonID).Scan(&lessonType, &duration)
		if err != nil {
			if err == pgx.ErrNoRows {
				return false, "", 0, nil
			}
			return false, "", 0, mapError(err)
		}
		return true, lessonType, duration, nil
	default:
		return false, "", 0, nil
	}
}

// ValidateStudyPlanCourses verifies only Content-owned Course identity/visibility.
// Learning owns the Study Plan; Commerce entitlement remains a separate later boundary.
func (r *Repository) ValidateStudyPlanCourses(
	ctx context.Context,
	pathID string,
	subjectIDs, courseIDs []string,
) (bool, error) {
	if len(courseIDs) == 0 {
		return true, nil
	}
	var ok bool
	err := r.db.QueryRow(ctx, `
		SELECT NOT EXISTS(
			SELECT 1
			FROM unnest($2::text[]) requested(course_id)
			LEFT JOIN courses c
			  ON c.id::text=requested.course_id
			 AND c.path_id=$1::uuid
			 AND c.workflow_status='approved'
			 AND c.is_published=true
			 AND c.is_visible=true
			 AND (
				cardinality($3::text[])=0
				OR c.subject_id::text=ANY($3::text[])
			 )
			WHERE c.id IS NULL
		)
	`, pathID, courseIDs, subjectIDs).Scan(&ok)
	if err != nil {
		return false, mapError(err)
	}
	return ok, nil
}

// ListStudyPlanResources is Learning's bounded Content catalog boundary.
// It returns compact canonical references only; no Lesson/Library body or asset payload is copied.
func (r *Repository) ListStudyPlanResources(
	ctx context.Context,
	pathID string,
	subjectIDs, courseIDs []string,
	limit int,
) ([]content.StudyPlanResource, error) {
	if limit < 1 || limit > 100 {
		return nil, content.ErrConflict
	}
	rows, err := r.db.Query(ctx, `
		WITH eligible_courses AS (
			SELECT c.id,c.subject_id
			FROM courses c
			WHERE c.path_id=$1::uuid
			  AND c.workflow_status='approved'
			  AND c.is_published=true
			  AND c.is_visible=true
			  AND (cardinality($2::text[])=0 OR c.subject_id::text=ANY($2::text[]))
			  AND (cardinality($3::text[])=0 OR c.id::text=ANY($3::text[]))
		),
		lesson_rows AS (
			SELECT DISTINCT ON (l.id,c.id)
			       'lesson'::text AS kind,
			       l.id::text AS id,
			       c.id::text AS course_id,
			       l.subject_id::text AS subject_id,
			       l.title,
			       ''::text AS external_url,
			       GREATEST(10,CEIL(l.duration_seconds/60.0)::int) AS duration_minutes,
			       (cm.sort_order*10000+cl.sort_order) AS sort_order
			FROM eligible_courses c
			JOIN course_modules cm ON cm.course_id=c.id AND cm.status='active'
			JOIN course_lessons cl ON cl.module_id=cm.id
			JOIN lessons l ON l.id=cl.lesson_id
			WHERE l.workflow_status='approved'
			  AND l.is_visible=true
			  AND (l.is_locked=false OR cl.is_preview=true)
			ORDER BY l.id,c.id,cm.sort_order,cl.sort_order
		),
		resource_rows AS (
			SELECT 'resource'::text,
			       li.id::text,
			       ''::text,
			       li.subject_id::text,
			       li.title,
			       COALESCE(li.external_url,''),
			       15,
			       1000000+ROW_NUMBER() OVER(ORDER BY li.updated_at DESC,li.id)::int
			FROM library_items li
			WHERE li.path_id=$1::uuid
			  AND li.workflow_status='approved'
			  AND li.is_visible=true
			  AND li.is_locked=false
			  AND (cardinality($2::text[])=0 OR li.subject_id::text=ANY($2::text[]))
		)
		SELECT kind,id,course_id,subject_id,title,external_url,duration_minutes,sort_order
		FROM (
			SELECT * FROM lesson_rows
			UNION ALL
			SELECT * FROM resource_rows
		) resources
		ORDER BY subject_id,sort_order,kind,id
		LIMIT $4
	`, pathID, subjectIDs, courseIDs, limit)
	if err != nil {
		return nil, mapError(err)
	}
	defer rows.Close()
	out := make([]content.StudyPlanResource, 0, limit)
	for rows.Next() {
		var item content.StudyPlanResource
		if err = rows.Scan(
			&item.Kind,
			&item.ID,
			&item.CourseID,
			&item.SubjectID,
			&item.Title,
			&item.ExternalURL,
			&item.DurationMinutes,
			&item.SortOrder,
		); err != nil {
			return nil, err
		}
		out = append(out, item)
	}
	return out, rows.Err()
}
