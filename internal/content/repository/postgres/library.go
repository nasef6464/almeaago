package postgres

import (
	"context"

	"github.com/jackc/pgx/v5"

	content "github.com/nasef6464/almeaago/internal/content/domain"
	operations "github.com/nasef6464/almeaago/internal/operations/domain"
)

func (r *Repository) CreateLibraryItem(ctx context.Context, actorUserID string, command content.LibraryCommand) (content.LibraryItem, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return content.LibraryItem{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if err := r.validateTaxonomyTx(ctx, tx, command.PathID, command.SubjectID, command.SkillLinks); err != nil {
		return content.LibraryItem{}, err
	}
	if err := r.validateOwnerTx(ctx, tx, command.OwnerType, command.OwnerUserID, command.OwnerSchoolID, command.AssignedTeacherID); err != nil {
		return content.LibraryItem{}, err
	}
	assetIDs := make([]string, 0, len(command.Assets))
	for _, item := range command.Assets {
		assetIDs = append(assetIDs, item.AssetID)
	}
	if err := r.validateAssetsTx(ctx, tx, assetIDs); err != nil {
		return content.LibraryItem{}, err
	}

	var id string
	err = tx.QueryRow(ctx, `
		INSERT INTO library_items (
			path_id,subject_id,title,description,item_type,external_url,
			owner_type,owner_user_id,owner_school_id,created_by,assigned_teacher_id,
			workflow_status,is_visible,is_locked
		)
		VALUES (
			$1::uuid,$2::uuid,$3,$4,$5,NULLIF($6,''),
			$7,NULLIF($8,'')::uuid,NULLIF($9,'')::uuid,$10::uuid,NULLIF($11,'')::uuid,
			'draft',$12,$13
		)
		RETURNING id::text
	`, command.PathID, command.SubjectID, command.Title, command.Description, command.ItemType,
		command.ExternalURL, string(command.OwnerType), command.OwnerUserID, command.OwnerSchoolID,
		actorUserID, command.AssignedTeacherID, command.IsVisible, command.IsLocked).Scan(&id)
	if err != nil {
		return content.LibraryItem{}, mapError(err)
	}
	if err := replaceLibraryLinksTx(ctx, tx, id, command.SkillLinks, command.Assets); err != nil {
		return content.LibraryItem{}, err
	}
	if err := r.writeAudit(ctx, tx, operations.AuditEvent{
		ActorUserID: actorUserID, Action: "content.library.create", ResourceType: "library_item", ResourceID: id,
		Metadata: map[string]any{"pathId": command.PathID, "subjectId": command.SubjectID, "type": command.ItemType},
	}); err != nil {
		return content.LibraryItem{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return content.LibraryItem{}, err
	}
	return r.GetLibraryItem(ctx, id)
}

func (r *Repository) UpdateLibraryItem(ctx context.Context, actorUserID, itemID string, expectedRevision int, command content.LibraryCommand) (content.LibraryItem, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return content.LibraryItem{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var current int
	var status content.WorkflowStatus
	if err := tx.QueryRow(ctx, `SELECT revision,workflow_status FROM library_items WHERE id=$1::uuid FOR UPDATE`, itemID).Scan(&current, &status); err != nil {
		return content.LibraryItem{}, mapError(err)
	}
	if current != expectedRevision {
		return content.LibraryItem{}, content.ErrVersionConflict
	}
	if status == content.WorkflowArchived {
		return content.LibraryItem{}, content.ErrConflict
	}
	if err := r.validateTaxonomyTx(ctx, tx, command.PathID, command.SubjectID, command.SkillLinks); err != nil {
		return content.LibraryItem{}, err
	}
	if err := r.validateOwnerTx(ctx, tx, command.OwnerType, command.OwnerUserID, command.OwnerSchoolID, command.AssignedTeacherID); err != nil {
		return content.LibraryItem{}, err
	}
	assetIDs := make([]string, 0, len(command.Assets))
	for _, item := range command.Assets {
		assetIDs = append(assetIDs, item.AssetID)
	}
	if err := r.validateAssetsTx(ctx, tx, assetIDs); err != nil {
		return content.LibraryItem{}, err
	}

	_, err = tx.Exec(ctx, `
		UPDATE library_items
		SET path_id=$2::uuid,subject_id=$3::uuid,title=$4,description=$5,item_type=$6,
			external_url=NULLIF($7,''),owner_type=$8,owner_user_id=NULLIF($9,'')::uuid,
			owner_school_id=NULLIF($10,'')::uuid,assigned_teacher_id=NULLIF($11,'')::uuid,
			is_visible=$12,is_locked=$13,revision=revision+1,updated_at=now()
		WHERE id=$1::uuid
	`, itemID, command.PathID, command.SubjectID, command.Title, command.Description, command.ItemType,
		command.ExternalURL, string(command.OwnerType), command.OwnerUserID, command.OwnerSchoolID,
		command.AssignedTeacherID, command.IsVisible, command.IsLocked)
	if err != nil {
		return content.LibraryItem{}, mapError(err)
	}
	if err := replaceLibraryLinksTx(ctx, tx, itemID, command.SkillLinks, command.Assets); err != nil {
		return content.LibraryItem{}, err
	}
	if err := r.writeAudit(ctx, tx, operations.AuditEvent{
		ActorUserID: actorUserID, Action: "content.library.update", ResourceType: "library_item", ResourceID: itemID,
		Metadata: map[string]any{"fromRevision": current, "toRevision": current + 1},
	}); err != nil {
		return content.LibraryItem{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return content.LibraryItem{}, err
	}
	return r.GetLibraryItem(ctx, itemID)
}

func (r *Repository) GetLibraryItem(ctx context.Context, itemID string) (content.LibraryItem, error) {
	var row content.LibraryItem
	var ownerUserID, ownerSchoolID, createdBy, assignedTeacherID, approvedBy string
	var revenue float64
	err := r.db.QueryRow(ctx, `
		SELECT id::text,path_id::text,subject_id::text,title,description,item_type,COALESCE(external_url,''),
			owner_type,COALESCE(owner_user_id::text,''),COALESCE(owner_school_id::text,''),
			COALESCE(created_by::text,''),COALESCE(assigned_teacher_id::text,''),workflow_status,
			COALESCE(approved_by::text,''),approved_at,reviewer_notes,
			COALESCE(revenue_share_percentage::float8,-1),is_visible,is_locked,revision,created_at,updated_at
		FROM library_items
		WHERE id=$1::uuid
	`, itemID).Scan(
		&row.ID, &row.PathID, &row.SubjectID, &row.Title, &row.Description, &row.ItemType, &row.ExternalURL,
		&row.Ownership.OwnerType, &ownerUserID, &ownerSchoolID, &createdBy, &assignedTeacherID,
		&row.Ownership.WorkflowStatus, &approvedBy, &row.Ownership.ApprovedAt, &row.Ownership.ReviewerNotes,
		&revenue, &row.IsVisible, &row.IsLocked, &row.Ownership.Revision, &row.Ownership.CreatedAt,
		&row.Ownership.UpdatedAt,
	)
	if err != nil {
		return content.LibraryItem{}, mapError(err)
	}
	row.Ownership.OwnerUserID = ownerUserID
	row.Ownership.OwnerSchoolID = ownerSchoolID
	row.Ownership.CreatedBy = createdBy
	row.Ownership.AssignedTeacherID = assignedTeacherID
	row.Ownership.ApprovedBy = approvedBy
	if revenue >= 0 {
		row.Ownership.RevenueShare = &revenue
	}
	skills, assets, err := r.loadLibraryLinks(ctx, itemID)
	if err != nil {
		return content.LibraryItem{}, err
	}
	row.SkillLinks, row.Assets = skills, assets
	return row, nil
}

func (r *Repository) ListLibraryItems(ctx context.Context, query content.ListQuery) (content.LibraryPage, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id::text,path_id::text,subject_id::text,title,description,item_type,COALESCE(external_url,''),
			owner_type,COALESCE(owner_user_id::text,''),COALESCE(owner_school_id::text,''),
			COALESCE(created_by::text,''),COALESCE(assigned_teacher_id::text,''),workflow_status,
			COALESCE(approved_by::text,''),approved_at,reviewer_notes,
			COALESCE(revenue_share_percentage::float8,-1),is_visible,is_locked,revision,created_at,updated_at
		FROM library_items li
		WHERE ($1='' OR li.path_id=$1::uuid)
		  AND ($2='' OR li.subject_id=$2::uuid)
		  AND ($3='' OR li.workflow_status=$3)
		  AND ($4='' OR lower(li.title) LIKE '%' || lower($4) || '%')
		  AND (
			$5='admin'
			OR ($5='teacher' AND (li.owner_user_id=$6::uuid OR li.assigned_teacher_id=$6::uuid))
			OR ($5='school_admin' AND EXISTS(
				SELECT 1 FROM school_memberships sm
				WHERE sm.user_id=$6::uuid AND sm.school_id=li.owner_school_id
				  AND sm.role='school_admin' AND sm.status='active'
			))
		  )
		ORDER BY li.updated_at DESC,li.id DESC
		LIMIT $7 OFFSET $8
	`, query.PathID, query.SubjectID, string(query.Workflow), query.Search, string(query.StaffScope), query.ActorUserID,
		query.Limit+1, (query.Page-1)*query.Limit)
	if err != nil {
		return content.LibraryPage{}, mapError(err)
	}
	defer rows.Close()
	items := make([]content.LibraryItem, 0, query.Limit+1)
	for rows.Next() {
		var row content.LibraryItem
		var ownerUserID, ownerSchoolID, createdBy, assignedTeacherID, approvedBy string
		var revenue float64
		if err := rows.Scan(
			&row.ID, &row.PathID, &row.SubjectID, &row.Title, &row.Description, &row.ItemType, &row.ExternalURL,
			&row.Ownership.OwnerType, &ownerUserID, &ownerSchoolID, &createdBy, &assignedTeacherID,
			&row.Ownership.WorkflowStatus, &approvedBy, &row.Ownership.ApprovedAt, &row.Ownership.ReviewerNotes,
			&revenue, &row.IsVisible, &row.IsLocked, &row.Ownership.Revision, &row.Ownership.CreatedAt,
			&row.Ownership.UpdatedAt,
		); err != nil {
			return content.LibraryPage{}, err
		}
		row.Ownership.OwnerUserID = ownerUserID
		row.Ownership.OwnerSchoolID = ownerSchoolID
		row.Ownership.CreatedBy = createdBy
		row.Ownership.AssignedTeacherID = assignedTeacherID
		row.Ownership.ApprovedBy = approvedBy
		if revenue >= 0 {
			row.Ownership.RevenueShare = &revenue
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

func (r *Repository) SetLibraryWorkflow(ctx context.Context, actorUserID, itemID string, expectedRevision int, status content.WorkflowStatus, notes string) (content.LibraryItem, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return content.LibraryItem{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	var current int
	if err := tx.QueryRow(ctx, `SELECT revision FROM library_items WHERE id=$1::uuid FOR UPDATE`, itemID).Scan(&current); err != nil {
		return content.LibraryItem{}, mapError(err)
	}
	if current != expectedRevision {
		return content.LibraryItem{}, content.ErrVersionConflict
	}
	_, err = tx.Exec(ctx, `
		UPDATE library_items
		SET workflow_status=$2,reviewer_notes=$3,
			approved_by=CASE WHEN $2='approved' THEN $4::uuid WHEN $2 IN ('draft','pending_review','rejected') THEN NULL ELSE approved_by END,
			approved_at=CASE WHEN $2='approved' THEN now() WHEN $2 IN ('draft','pending_review','rejected') THEN NULL ELSE approved_at END,
			revision=revision+1,updated_at=now()
		WHERE id=$1::uuid
	`, itemID, string(status), notes, actorUserID)
	if err != nil {
		return content.LibraryItem{}, mapError(err)
	}
	if err := r.writeAudit(ctx, tx, operations.AuditEvent{
		ActorUserID: actorUserID, Action: "content.library.workflow", ResourceType: "library_item", ResourceID: itemID,
		Metadata: map[string]any{"status": status, "fromRevision": current, "toRevision": current + 1},
	}); err != nil {
		return content.LibraryItem{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return content.LibraryItem{}, err
	}
	return r.GetLibraryItem(ctx, itemID)
}

func replaceLibraryLinksTx(ctx context.Context, tx pgx.Tx, itemID string, skills []content.SkillLink, assets []content.AssetLink) error {
	if _, err := tx.Exec(ctx, `DELETE FROM library_skill_links WHERE library_item_id=$1::uuid`, itemID); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `DELETE FROM library_item_assets WHERE library_item_id=$1::uuid`, itemID); err != nil {
		return err
	}
	for _, link := range skills {
		if _, err := tx.Exec(ctx, `
			INSERT INTO library_skill_links(library_item_id,skill_id,relation_type)
			VALUES($1::uuid,$2::uuid,$3)
		`, itemID, link.SkillID, link.RelationType); err != nil {
			return mapError(err)
		}
	}
	for _, asset := range assets {
		if _, err := tx.Exec(ctx, `
			INSERT INTO library_item_assets(library_item_id,asset_id,purpose,sort_order)
			VALUES($1::uuid,$2::uuid,$3,$4)
		`, itemID, asset.AssetID, asset.Purpose, asset.SortOrder); err != nil {
			return mapError(err)
		}
	}
	return nil
}

func (r *Repository) loadLibraryLinks(ctx context.Context, itemID string) ([]content.SkillLink, []content.AssetLink, error) {
	skillRows, err := r.db.Query(ctx, `
		SELECT skill_id::text,relation_type FROM library_skill_links
		WHERE library_item_id=$1::uuid ORDER BY relation_type,skill_id
	`, itemID)
	if err != nil {
		return nil, nil, err
	}
	skills := []content.SkillLink{}
	for skillRows.Next() {
		var item content.SkillLink
		if err := skillRows.Scan(&item.SkillID, &item.RelationType); err != nil {
			skillRows.Close()
			return nil, nil, err
		}
		skills = append(skills, item)
	}
	if err := skillRows.Err(); err != nil {
		skillRows.Close()
		return nil, nil, err
	}
	skillRows.Close()

	assetRows, err := r.db.Query(ctx, `
		SELECT asset_id::text,purpose,''::text,sort_order FROM library_item_assets
		WHERE library_item_id=$1::uuid ORDER BY sort_order,asset_id
	`, itemID)
	if err != nil {
		return nil, nil, err
	}
	defer assetRows.Close()
	assets := []content.AssetLink{}
	for assetRows.Next() {
		var item content.AssetLink
		if err := assetRows.Scan(&item.AssetID, &item.Purpose, &item.Title, &item.SortOrder); err != nil {
			return nil, nil, err
		}
		assets = append(assets, item)
	}
	return skills, assets, assetRows.Err()
}
