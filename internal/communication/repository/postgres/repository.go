package postgres

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	communication "github.com/nasef6464/almeaago/internal/communication/domain"
	operations "github.com/nasef6464/almeaago/internal/operations/domain"
)

type AuditWriter interface {
	WriteTx(context.Context, pgx.Tx, operations.AuditEvent) error
}

type Repository struct {
	db    *pgxpool.Pool
	audit AuditWriter
}

func New(db *pgxpool.Pool, audit ...AuditWriter) *Repository {
	var writer AuditWriter
	if len(audit) > 0 {
		writer = audit[0]
	}
	return &Repository{db: db, audit: writer}
}

func (r *Repository) writeAuditTx(ctx context.Context, tx pgx.Tx, event operations.AuditEvent) error {
	if r.audit == nil {
		return nil
	}
	return r.audit.WriteTx(ctx, tx, event)
}

func scanTemplate(row interface{ Scan(...any) error }) (communication.Template, error) {
	var out communication.Template
	err := row.Scan(
		&out.ID, &out.Key, &out.Name, &out.Channel, &out.Subject, &out.Title, &out.Body,
		&out.Variables, &out.IsActive, &out.Revision, &out.CreatedAt, &out.UpdatedAt,
	)
	return out, err
}

func (r *Repository) ListTemplates(ctx context.Context, page, limit int) (communication.TemplatePage, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id::text,key,name,channel,subject,title,body,variables,is_active,revision,created_at,updated_at
		FROM notification_templates
		ORDER BY updated_at DESC,id DESC
		LIMIT $1 OFFSET $2
	`, limit+1, (page-1)*limit)
	if err != nil {
		return communication.TemplatePage{}, err
	}
	defer rows.Close()

	out := communication.TemplatePage{Items: []communication.Template{}, Page: page, Limit: limit}
	for rows.Next() {
		item, scanErr := scanTemplate(rows)
		if scanErr != nil {
			return out, scanErr
		}
		out.Items = append(out.Items, item)
	}
	if err = rows.Err(); err != nil {
		return out, err
	}
	if len(out.Items) > limit {
		out.HasMore = true
		out.Items = out.Items[:limit]
	}
	return out, nil
}

func (r *Repository) TemplateByKey(ctx context.Context, key string, activeOnly bool) (communication.Template, error) {
	query := `
		SELECT id::text,key,name,channel,subject,title,body,variables,is_active,revision,created_at,updated_at
		FROM notification_templates
		WHERE key=$1
	`
	if activeOnly {
		query += " AND is_active=true"
	}
	item, err := scanTemplate(r.db.QueryRow(ctx, query, key))
	if errors.Is(err, pgx.ErrNoRows) {
		return communication.Template{}, communication.ErrNotFound
	}
	return item, err
}

func (r *Repository) UpsertTemplate(
	ctx context.Context,
	actorID string,
	write communication.TemplateWrite,
) (communication.Template, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return communication.Template{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var existingID string
	var currentRevision int
	err = tx.QueryRow(ctx, `
		SELECT id::text,revision
		FROM notification_templates
		WHERE key=$1
		FOR UPDATE
	`, write.Key).Scan(&existingID, &currentRevision)
	switch {
	case errors.Is(err, pgx.ErrNoRows):
		if write.ExpectedRevision != 0 {
			return communication.Template{}, communication.ErrConflict
		}
		var item communication.Template
		err = tx.QueryRow(ctx, `
			INSERT INTO notification_templates(
				key,name,channel,subject,title,body,variables,is_active,created_by,updated_by
			) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::uuid,$9::uuid)
			RETURNING id::text,key,name,channel,subject,title,body,variables,is_active,revision,created_at,updated_at
		`,
			write.Key, write.Name, write.Channel, write.Subject, write.Title, write.Body,
			write.Variables, write.IsActive, actorID,
		).Scan(
			&item.ID, &item.Key, &item.Name, &item.Channel, &item.Subject, &item.Title, &item.Body,
			&item.Variables, &item.IsActive, &item.Revision, &item.CreatedAt, &item.UpdatedAt,
		)
		if err != nil {
			return communication.Template{}, err
		}
		if err = r.writeAuditTx(ctx, tx, operations.AuditEvent{
			ActorUserID: actorID, Action: "notification.template.create",
			ResourceType: "notification_template", ResourceID: item.ID,
			Metadata: map[string]any{"key": item.Key, "channel": item.Channel},
		}); err != nil {
			return communication.Template{}, err
		}
		if err = tx.Commit(ctx); err != nil {
			return communication.Template{}, err
		}
		return item, nil
	case err != nil:
		return communication.Template{}, err
	}

	if write.ExpectedRevision != currentRevision {
		return communication.Template{}, communication.ErrConflict
	}

	var item communication.Template
	err = tx.QueryRow(ctx, `
		UPDATE notification_templates
		SET name=$2,channel=$3,subject=$4,title=$5,body=$6,variables=$7,is_active=$8,
		    revision=revision+1,updated_by=$9::uuid,updated_at=now()
		WHERE id=$1::uuid
		RETURNING id::text,key,name,channel,subject,title,body,variables,is_active,revision,created_at,updated_at
	`,
		existingID, write.Name, write.Channel, write.Subject, write.Title, write.Body,
		write.Variables, write.IsActive, actorID,
	).Scan(
		&item.ID, &item.Key, &item.Name, &item.Channel, &item.Subject, &item.Title, &item.Body,
		&item.Variables, &item.IsActive, &item.Revision, &item.CreatedAt, &item.UpdatedAt,
	)
	if err != nil {
		return communication.Template{}, err
	}
	if err = r.writeAuditTx(ctx, tx, operations.AuditEvent{
		ActorUserID: actorID, Action: "notification.template.update",
		ResourceType: "notification_template", ResourceID: item.ID,
		Metadata: map[string]any{"key": item.Key, "channel": item.Channel, "revision": item.Revision},
	}); err != nil {
		return communication.Template{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return communication.Template{}, err
	}
	return item, nil
}

func (r *Repository) CreateCampaign(
	ctx context.Context,
	command communication.CampaignCommand,
) (communication.CampaignResult, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return communication.CampaignResult{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	channelValues := make([]string, 0, len(command.Message.Channels))
	for _, channel := range command.Message.Channels {
		channelValues = append(channelValues, string(channel))
	}

	var campaignID string
	err = tx.QueryRow(ctx, `
		INSERT INTO notification_campaigns(
			template_id,template_key,title,subject,body,channels,idempotency_key,created_by
		) VALUES(
			NULLIF($1,'')::uuid,$2,$3,$4,$5,$6,NULLIF($7,''),NULLIF($8,'')::uuid
		)
		ON CONFLICT(idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING
		RETURNING id::text
	`,
		command.Message.TemplateID, command.Message.TemplateKey, command.Message.Title,
		command.Message.Subject, command.Message.Body, channelValues,
		command.IdempotencyKey, command.ActorUserID,
	).Scan(&campaignID)
	if errors.Is(err, pgx.ErrNoRows) && command.IdempotencyKey != "" {
		var result communication.CampaignResult
		err = tx.QueryRow(ctx, `
			SELECT
				c.id::text,
				c.recipient_count,
				c.delivery_count,
				COUNT(d.id) FILTER(WHERE d.status IN ('pending','retrying'))::int,
				COUNT(d.id) FILTER(WHERE d.status='sent')::int
			FROM notification_campaigns c
			LEFT JOIN notification_deliveries d ON d.campaign_id=c.id
			WHERE c.idempotency_key=$1
			GROUP BY c.id,c.recipient_count,c.delivery_count
		`, command.IdempotencyKey).Scan(
			&result.CampaignID, &result.Recipients, &result.Created, &result.Pending, &result.Sent,
		)
		if err != nil {
			return communication.CampaignResult{}, err
		}
		result.Reused = true
		if err = tx.Commit(ctx); err != nil {
			return communication.CampaignResult{}, err
		}
		return result, nil
	}
	if err != nil {
		return communication.CampaignResult{}, err
	}

	result := communication.CampaignResult{
		CampaignID: campaignID,
		Recipients: len(command.Recipients),
	}
	now := time.Now().UTC()
	for _, recipient := range command.Recipients {
		for _, channel := range command.Message.Channels {
			status := communication.DeliveryPending
			provider := ""
			var sentAt *time.Time
			if channel == communication.ChannelInApp {
				status = communication.DeliverySent
				provider = "internal"
				value := now
				sentAt = &value
				result.Sent++
			} else {
				result.Pending++
			}
			if _, err = tx.Exec(ctx, `
				INSERT INTO notification_deliveries(
					campaign_id,template_key,channel,status,title,subject,body,
					recipient_user_id,recipient_email,recipient_phone,provider,sent_at,created_by,
					metadata
				) VALUES(
					$1::uuid,$2,$3,$4,$5,$6,$7,$8::uuid,$9,$10,$11,$12,NULLIF($13,'')::uuid,
					jsonb_build_object('recipientName',$14)
				)
			`,
				campaignID, command.Message.TemplateKey, channel, status, command.Message.Title,
				command.Message.Subject, command.Message.Body, recipient.UserID, recipient.Email,
				recipient.Phone, provider, sentAt, command.ActorUserID, recipient.Name,
			); err != nil {
				return communication.CampaignResult{}, err
			}
			result.Created++
		}
	}

	if _, err = tx.Exec(ctx, `
		UPDATE notification_campaigns
		SET recipient_count=$2,delivery_count=$3
		WHERE id=$1::uuid
	`, campaignID, result.Recipients, result.Created); err != nil {
		return communication.CampaignResult{}, err
	}

	if command.ActorUserID != "" {
		if err = r.writeAuditTx(ctx, tx, operations.AuditEvent{
			ActorUserID: command.ActorUserID, Action: "notification.campaign.create",
			ResourceType: "notification_campaign", ResourceID: campaignID,
			Metadata: map[string]any{
				"recipients": result.Recipients,
				"deliveries": result.Created,
				"channels":   channelValues,
			},
		}); err != nil {
			return communication.CampaignResult{}, err
		}
	}

	if err = tx.Commit(ctx); err != nil {
		return communication.CampaignResult{}, err
	}
	return result, nil
}

func scanDelivery(row interface{ Scan(...any) error }) (communication.Delivery, error) {
	var out communication.Delivery
	err := row.Scan(
		&out.ID, &out.CampaignID, &out.TemplateKey, &out.Channel, &out.Status,
		&out.Title, &out.Subject, &out.Body, &out.RecipientUserID, &out.RecipientEmail,
		&out.RecipientPhone, &out.Provider, &out.ProviderMessageID, &out.FailureReason,
		&out.RetryCount, &out.NextAttemptAt, &out.SentAt, &out.ReadAt, &out.CreatedAt, &out.UpdatedAt,
	)
	return out, err
}

const deliverySelect = `
	SELECT
		id::text,campaign_id::text,template_key,channel,status,title,subject,body,
		COALESCE(recipient_user_id::text,''),recipient_email,recipient_phone,provider,
		provider_message_id,failure_reason,retry_count,next_attempt_at,sent_at,read_at,created_at,updated_at
	FROM notification_deliveries
`

func (r *Repository) ListInbox(ctx context.Context, userID string, page, limit int) (communication.DeliveryPage, error) {
	rows, err := r.db.Query(ctx, deliverySelect+`
		WHERE recipient_user_id=$1::uuid AND channel='in_app' AND status='sent'
		ORDER BY created_at DESC,id DESC
		LIMIT $2 OFFSET $3
	`, userID, limit+1, (page-1)*limit)
	if err != nil {
		return communication.DeliveryPage{}, err
	}
	defer rows.Close()

	out := communication.DeliveryPage{Items: []communication.Delivery{}, Page: page, Limit: limit}
	for rows.Next() {
		item, scanErr := scanDelivery(rows)
		if scanErr != nil {
			return out, scanErr
		}
		item.RecipientEmail = ""
		item.RecipientPhone = ""
		out.Items = append(out.Items, item)
	}
	if err = rows.Err(); err != nil {
		return out, err
	}
	if len(out.Items) > limit {
		out.HasMore = true
		out.Items = out.Items[:limit]
	}
	return out, nil
}

func (r *Repository) UnreadCount(ctx context.Context, userID string) (int, error) {
	var count int
	err := r.db.QueryRow(ctx, `
		SELECT count(*)::int
		FROM notification_deliveries
		WHERE recipient_user_id=$1::uuid
		  AND channel='in_app'
		  AND status='sent'
		  AND read_at IS NULL
	`, userID).Scan(&count)
	return count, err
}

func (r *Repository) MarkRead(ctx context.Context, userID, deliveryID string) (communication.Delivery, error) {
	item, err := scanDelivery(r.db.QueryRow(ctx, deliverySelect+`
		WHERE id=$1::uuid AND recipient_user_id=$2::uuid AND channel='in_app'
	`, deliveryID, userID))
	if errors.Is(err, pgx.ErrNoRows) {
		return communication.Delivery{}, communication.ErrNotFound
	}
	if err != nil {
		return communication.Delivery{}, err
	}
	if item.ReadAt == nil {
		now := time.Now().UTC()
		if _, err = r.db.Exec(ctx, `
			UPDATE notification_deliveries
			SET read_at=$3,updated_at=now()
			WHERE id=$1::uuid AND recipient_user_id=$2::uuid AND channel='in_app'
		`, deliveryID, userID, now); err != nil {
			return communication.Delivery{}, err
		}
		item.ReadAt = &now
		item.UpdatedAt = now
	}
	item.RecipientEmail = ""
	item.RecipientPhone = ""
	return item, nil
}

func (r *Repository) MarkAllRead(ctx context.Context, userID string) (int64, error) {
	tag, err := r.db.Exec(ctx, `
		UPDATE notification_deliveries
		SET read_at=now(),updated_at=now()
		WHERE recipient_user_id=$1::uuid
		  AND channel='in_app'
		  AND status='sent'
		  AND read_at IS NULL
	`, userID)
	if err != nil {
		return 0, err
	}
	return tag.RowsAffected(), nil
}

func (r *Repository) ListDeliveries(
	ctx context.Context,
	filter communication.DeliveryFilter,
) (communication.DeliveryPage, error) {
	rows, err := r.db.Query(ctx, deliverySelect+`
		WHERE ($1='' OR status=$1)
		  AND ($2='' OR channel=$2)
		ORDER BY created_at DESC,id DESC
		LIMIT $3 OFFSET $4
	`, filter.Status, filter.Channel, filter.Limit+1, (filter.Page-1)*filter.Limit)
	if err != nil {
		return communication.DeliveryPage{}, err
	}
	defer rows.Close()

	out := communication.DeliveryPage{Items: []communication.Delivery{}, Page: filter.Page, Limit: filter.Limit}
	for rows.Next() {
		item, scanErr := scanDelivery(rows)
		if scanErr != nil {
			return out, scanErr
		}
		out.Items = append(out.Items, item)
	}
	if err = rows.Err(); err != nil {
		return out, err
	}
	if len(out.Items) > filter.Limit {
		out.HasMore = true
		out.Items = out.Items[:filter.Limit]
	}
	return out, nil
}

func (r *Repository) GetPreferences(ctx context.Context, userID string) (communication.Preferences, error) {
	var out communication.Preferences
	err := r.db.QueryRow(ctx, `
		SELECT user_id::text,parent_whatsapp_digest_enabled,revision,updated_at
		FROM notification_preferences
		WHERE user_id=$1::uuid
	`, userID).Scan(
		&out.UserID, &out.ParentWhatsAppDigestEnabled, &out.Revision, &out.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return communication.Preferences{UserID: userID}, nil
	}
	return out, err
}

func (r *Repository) PreferencesForUsers(
	ctx context.Context,
	userIDs []string,
) (map[string]communication.Preferences, error) {
	out := make(map[string]communication.Preferences, len(userIDs))
	for _, userID := range userIDs {
		out[userID] = communication.Preferences{UserID: userID}
	}
	if len(userIDs) == 0 {
		return out, nil
	}
	rows, err := r.db.Query(ctx, `
		SELECT user_id::text,parent_whatsapp_digest_enabled,revision,updated_at
		FROM notification_preferences
		WHERE user_id::text=ANY($1::text[])
	`, userIDs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var item communication.Preferences
		if err = rows.Scan(
			&item.UserID, &item.ParentWhatsAppDigestEnabled, &item.Revision, &item.UpdatedAt,
		); err != nil {
			return nil, err
		}
		out[item.UserID] = item
	}
	return out, rows.Err()
}

func (r *Repository) UpdatePreferences(
	ctx context.Context,
	userID string,
	write communication.PreferencesWrite,
) (communication.Preferences, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return communication.Preferences{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var out communication.Preferences
	if write.ExpectedRevision == 0 {
		err = tx.QueryRow(ctx, `
			INSERT INTO notification_preferences(user_id,parent_whatsapp_digest_enabled)
			VALUES($1::uuid,$2)
			ON CONFLICT(user_id) DO NOTHING
			RETURNING user_id::text,parent_whatsapp_digest_enabled,revision,updated_at
		`, userID, write.ParentWhatsAppDigestEnabled).Scan(
			&out.UserID, &out.ParentWhatsAppDigestEnabled, &out.Revision, &out.UpdatedAt,
		)
	} else {
		err = tx.QueryRow(ctx, `
			UPDATE notification_preferences
			SET parent_whatsapp_digest_enabled=$3,revision=revision+1,updated_at=now()
			WHERE user_id=$1::uuid AND revision=$2
			RETURNING user_id::text,parent_whatsapp_digest_enabled,revision,updated_at
		`, userID, write.ExpectedRevision, write.ParentWhatsAppDigestEnabled).Scan(
			&out.UserID, &out.ParentWhatsAppDigestEnabled, &out.Revision, &out.UpdatedAt,
		)
	}
	if errors.Is(err, pgx.ErrNoRows) {
		return communication.Preferences{}, communication.ErrConflict
	}
	if err != nil {
		return communication.Preferences{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return communication.Preferences{}, err
	}
	return out, nil
}

func (r *Repository) ClaimPending(ctx context.Context, limit int, lease time.Duration) ([]communication.Delivery, error) {
	if limit < 1 {
		limit = 1
	}
	if limit > 50 {
		limit = 50
	}
	rows, err := r.db.Query(ctx, `
		WITH picked AS (
			SELECT id
			FROM notification_deliveries
			WHERE channel IN ('email','whatsapp')
			  AND status IN ('pending','retrying')
			  AND (next_attempt_at IS NULL OR next_attempt_at <= now())
			ORDER BY created_at,id
			FOR UPDATE SKIP LOCKED
			LIMIT $1
		)
		UPDATE notification_deliveries d
		SET status='retrying',next_attempt_at=now()+($2 * interval '1 second'),updated_at=now()
		FROM picked
		WHERE d.id=picked.id
		RETURNING
			d.id::text,d.campaign_id::text,d.template_key,d.channel,d.status,d.title,d.subject,d.body,
			COALESCE(d.recipient_user_id::text,''),d.recipient_email,d.recipient_phone,d.provider,
			d.provider_message_id,d.failure_reason,d.retry_count,d.next_attempt_at,d.sent_at,d.read_at,
			d.created_at,d.updated_at
	`, limit, int(lease.Seconds()))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]communication.Delivery, 0, limit)
	for rows.Next() {
		item, scanErr := scanDelivery(rows)
		if scanErr != nil {
			return nil, scanErr
		}
		out = append(out, item)
	}
	return out, rows.Err()
}

func (r *Repository) CompleteAttempt(
	ctx context.Context,
	deliveryID string,
	success bool,
	result communication.DeliveryAttemptResult,
	now time.Time,
) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var retryCount int
	err = tx.QueryRow(ctx, `
		SELECT retry_count
		FROM notification_deliveries
		WHERE id=$1::uuid AND channel IN ('email','whatsapp')
		FOR UPDATE
	`, deliveryID).Scan(&retryCount)
	if errors.Is(err, pgx.ErrNoRows) {
		return communication.ErrNotFound
	}
	if err != nil {
		return err
	}

	if success {
		_, err = tx.Exec(ctx, `
			UPDATE notification_deliveries
			SET status='sent',provider=$2,provider_message_id=$3,failure_reason='',
			    sent_at=$4,next_attempt_at=NULL,updated_at=$4
			WHERE id=$1::uuid
		`, deliveryID, result.Provider, result.ProviderMessageID, now)
		if err != nil {
			return err
		}
		return tx.Commit(ctx)
	}

	nextRetryCount := retryCount + 1
	if nextRetryCount >= 4 {
		_, err = tx.Exec(ctx, `
			UPDATE notification_deliveries
			SET status='failed',provider=$2,failure_reason=$3,retry_count=$4,
			    next_attempt_at=NULL,updated_at=$5
			WHERE id=$1::uuid
		`, deliveryID, result.Provider, result.FailureReason, nextRetryCount, now)
		if err != nil {
			return err
		}
		return tx.Commit(ctx)
	}

	backoff := time.Minute * time.Duration(1<<(nextRetryCount-1))
	nextAttempt := now.Add(backoff)
	_, err = tx.Exec(ctx, `
		UPDATE notification_deliveries
		SET status='retrying',provider=$2,failure_reason=$3,retry_count=$4,
		    next_attempt_at=$5,updated_at=$6
		WHERE id=$1::uuid
	`, deliveryID, result.Provider, result.FailureReason, nextRetryCount, nextAttempt, now)
	if err != nil {
		return err
	}
	return tx.Commit(ctx)
}
