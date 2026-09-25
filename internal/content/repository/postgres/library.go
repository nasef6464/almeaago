package postgres

import (
	"context"
	"fmt"

	content "github.com/nasef6464/almeaago/internal/content/domain"
	operations "github.com/nasef6464/almeaago/internal/operations/domain"
)

func (r *Repository) CreateLibraryItem(ctx context.Context, actorUserID string, write content.LibraryWrite) (content.LibraryItem, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return content.LibraryItem{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	if err := r.validateContentRefsTx(ctx, tx, write.PathID, write.SubjectID, write.SkillIDs, []string{write.PrimaryAssetID}); err != nil {
		return content.LibraryItem{}, err
	}
	if err := validateOwnerTx(ctx, tx, write.OwnerType, write.OwnerUserID, write.OwnerSchoolID, write.AssignedTeacherID); err != nil {
		return content.LibraryItem{}, err
	}
	var id string
	err = tx.QueryRow(ctx, `
		INSERT INTO library_items (
			path_id,subject_id,title,description,item_type,external_url,owner_type,owner_user_id,owner_school_id,
			created_by,assigned_teacher_id,revenue_share_percentage,is_visible,is_locked
		) VALUES ($1::uuid,$2::uuid,$3,$4,$5,NULLIF($6,''),$7,NULLIF($8,'')::uuid,NULLIF($9,'')::uuid,
			$10::uuid,NULLIF($11,'')::uuid,$12,$13,$14)
		RETURNING id::text
	`, write.PathID, write.SubjectID, write.Title, write.Description, string(write.ItemType), write.ExternalURL,
		string(write.OwnerType), write.OwnerUserID, write.OwnerSchoolID, actorUserID, write.AssignedTeacherID,
		write.RevenueSharePercentage, write.IsVisible, write.IsLocked).Scan(&id)
	if err != nil {
		return content.LibraryItem{}, mapError(err)
	}
	if err := replaceLibraryLinksTx(ctx, tx, id, write.SkillIDs, write.PrimaryAssetID); err != nil {
		return content.LibraryItem{}, err
	}
	if err := r.writeAudit(ctx, tx, operations.AuditEvent{ActorUserID: actorUserID, Action: "content.library.create", ResourceType: "library_item", ResourceID: id}); err != nil {
		return content.LibraryItem{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return content.LibraryItem{}, err
	}
	return r.GetLibraryItem(ctx, id)
}

func (r *Repository) UpdateLibraryItem(ctx context.Context, actorUserID, itemID string, expectedRevision int, write content.LibraryWrite) (content.LibraryItem, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return content.LibraryItem{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	if err := r.validateContentRefsTx(ctx, tx, write.PathID, write.SubjectID, write.SkillIDs, []string{write.PrimaryAssetID}); err != nil {
		return content.LibraryItem{}, err
	}
	if err := validateOwnerTx(ctx, tx, write.OwnerType, write.OwnerUserID, write.OwnerSchoolID, write.AssignedTeacherID); err != nil {
		return content.LibraryItem{}, err
	}
	var id string
	err = tx.QueryRow(ctx, `
		UPDATE library_items SET path_id=$3::uuid,subject_id=$4::uuid,title=$5,description=$6,item_type=$7,external_url=NULLIF($8,''),
			owner_type=$9,owner_user_id=NULLIF($10,'')::uuid,owner_school_id=NULLIF($11,'')::uuid,assigned_teacher_id=NULLIF($12,'')::uuid,
			revenue_share_percentage=$13,is_visible=$14,is_locked=$15,revision=revision+1,updated_at=now()
		WHERE id=$1::uuid AND revision=$2 AND workflow_status NOT IN ('approved','archived')
		RETURNING id::text
	`, itemID, expectedRevision, write.PathID, write.SubjectID, write.Title, write.Description, string(write.ItemType), write.ExternalURL,
		string(write.OwnerType), write.OwnerUserID, write.OwnerSchoolID, write.AssignedTeacherID, write.RevenueSharePercentage,
		write.IsVisible, write.IsLocked).Scan(&id)
	if err != nil {
		return content.LibraryItem{}, mapUpdateError(ctx, tx, "library_items", itemID, expectedRevision, err)
	}
	if err := replaceLibraryLinksTx(ctx, tx, id, write.SkillIDs, write.PrimaryAssetID); err != nil {
		return content.LibraryItem{}, err
	}
	if err := r.writeAudit(ctx, tx, operations.AuditEvent{ActorUserID: actorUserID, Action: "content.library.update", ResourceType: "library_item", ResourceID: id}); err != nil {
		return content.LibraryItem{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return content.LibraryItem{}, err
	}
	return r.GetLibraryItem(ctx, id)
}

func (r *Repository) SetLibraryWorkflow(ctx context.Context, actorUserID, itemID string, expectedRevision int, status content.WorkflowStatus, reviewerNotes string) (content.LibraryItem, error) {
	if err := r.setWorkflow(ctx, actorUserID, "library_items", "library_item", itemID, expectedRevision, status, reviewerNotes); err != nil {
		return content.LibraryItem{}, err
	}
	return r.GetLibraryItem(ctx, itemID)
}

func (r *Repository) GetLibraryItem(ctx context.Context, itemID string) (content.LibraryItem, error) {
	var row content.LibraryItem
	var ownerUserID, ownerSchoolID, createdBy, assignedTeacherID, approvedBy, externalURL string
	err := r.db.QueryRow(ctx, `
		SELECT id::text,path_id::text,subject_id::text,title,description,item_type,COALESCE(external_url,''),owner_type,
			COALESCE(owner_user_id::text,''),COALESCE(owner_school_id::text,''),COALESCE(created_by::text,''),
			COALESCE(assigned_teacher_id::text,''),workflow_status,COALESCE(approved_by::text,''),approved_at,reviewer_notes,
			revenue_share_percentage,is_visible,is_locked,revision,created_at,updated_at
		FROM library_items WHERE id=$1::uuid
	`, itemID).Scan(&row.ID, &row.PathID, &row.SubjectID, &row.Title, &row.Description, &row.ItemType, &externalURL,
		&row.OwnerType, &ownerUserID, &ownerSchoolID, &createdBy, &assignedTeacherID, &row.WorkflowStatus, &approvedBy,
		&row.ApprovedAt, &row.ReviewerNotes, &row.RevenueSharePercentage, &row.IsVisible, &row.IsLocked,
		&row.Revision, &row.CreatedAt, &row.UpdatedAt)
	if err != nil {
		return content.LibraryItem{}, mapError(err)
	}
	row.ExternalURL, row.OwnerUserID, row.OwnerSchoolID = externalURL, ownerUserID, ownerSchoolID
	row.CreatedBy, row.AssignedTeacherID, row.ApprovedBy = createdBy, assignedTeacherID, approvedBy
	row.SkillIDs, err = r.loadIDs(ctx, `SELECT skill_id::text FROM library_skill_links WHERE library_item_id=$1::uuid ORDER BY skill_id`, itemID)
	if err != nil {
		return content.LibraryItem{}, err
	}
	_ = r.db.QueryRow(ctx, `SELECT COALESCE(asset_id::text,'') FROM library_item_assets WHERE library_item_id=$1::uuid AND purpose='primary' LIMIT 1`, itemID).Scan(&row.PrimaryAssetID)
	return row, nil
}

func (r *Repository) ListLibraryItems(ctx context.Context, query content.ListQuery) (content.LibraryPage, error) {
	where, args := buildListWhere(query, "li")
	args = append(args, query.Limit+1, (query.Page-1)*query.Limit)
	rows, err := r.db.Query(ctx, `
		SELECT li.id::text,li.path_id::text,li.subject_id::text,li.title,li.item_type,
			li.owner_type,COALESCE(li.owner_user_id::text,''),COALESCE(li.owner_school_id::text,''),
			COALESCE(li.assigned_teacher_id::text,''),li.workflow_status,li.is_visible,li.is_locked,li.revision,li.updated_at
		FROM library_items li WHERE `+where+`
		ORDER BY li.updated_at DESC,li.id DESC
		LIMIT $`+fmt.Sprint(len(args)-1)+` OFFSET $`+fmt.Sprint(len(args)), args...)
	if err != nil {
		return content.LibraryPage{}, err
	}
	defer rows.Close()
	items := make([]content.LibraryItem, 0, query.Limit+1)
	for rows.Next() {
		var row content.LibraryItem
		if err := rows.Scan(&row.ID, &row.PathID, &row.SubjectID, &row.Title, &row.ItemType,
			&row.OwnerType, &row.OwnerUserID, &row.OwnerSchoolID, &row.AssignedTeacherID,
			&row.WorkflowStatus, &row.IsVisible, &row.IsLocked, &row.Revision, &row.UpdatedAt); err != nil {
			return content.LibraryPage{}, err
		}
		items = append(items, row)
	}
	if err := rows.Err(); err != nil {
		return content.LibraryPage{}, err
	}
	hasMore := len(items) > query.Limit
	if hasMore {
		items = items[:query.Limit]
	}
	return content.LibraryPage{Items: items, Page: query.Page, Limit: query.Limit, HasMore: hasMore}, nil
}
