package postgres

import (
	"context"
	"encoding/json"

	"github.com/jackc/pgx/v5"

	operations "github.com/nasef6464/almeaago/internal/operations/domain"
)

type AuditWriter struct{}

func NewAuditWriter() *AuditWriter {
	return &AuditWriter{}
}

func (w *AuditWriter) WriteTx(
	ctx context.Context,
	tx pgx.Tx,
	event operations.AuditEvent,
) error {
	raw, err := json.Marshal(event.Metadata)
	if err != nil {
		return err
	}
	status := event.Status
	if status == "" {
		status = "success"
	}
	_, err = tx.Exec(ctx, `
		INSERT INTO audit_logs (
			actor_user_id,
			action,
			resource_type,
			resource_id,
			status,
			metadata
		)
		SELECT
			u.id,
			$2,
			$3,
			$4,
			$5,
			$6::jsonb
		FROM users u
		WHERE u.id = $1::uuid
	`,
		event.ActorUserID,
		event.Action,
		event.ResourceType,
		event.ResourceID,
		status,
		string(raw),
	)
	return err
}
