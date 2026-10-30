package navigation

import (
	"context"
	"encoding/json"
	"errors"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Postgres struct{ db *pgxpool.Pool }

func NewPostgres(db *pgxpool.Pool) *Postgres { return &Postgres{db: db} }

type querier interface {
	Query(context.Context, string, ...any) (pgx.Rows, error)
}

func read(ctx context.Context, q querier, actor string) (Preferences, error) {
	out := Empty()
	rows, err := q.Query(ctx, `SELECT kind,path_id,level_id FROM (
 SELECT 0 AS kind,path_id::text,NULL::text AS level_id,position FROM learning_navigation_paths WHERE user_id=$1::uuid
 UNION ALL SELECT 1 AS kind,path_id::text,level_id::text,position FROM learning_navigation_stages WHERE user_id=$1::uuid
 ) rows ORDER BY kind,position`, actor)
	if err != nil {
		return out, err
	}
	defer rows.Close()
	for rows.Next() {
		var kind int
		var id string
		var level *string
		if err = rows.Scan(&kind, &id, &level); err != nil {
			return out, err
		}
		if kind == 0 {
			out.EnrolledPaths = append(out.EnrolledPaths, id)
		} else if level != nil {
			out.PathStageSelections = append(out.PathStageSelections, Stage{id, *level})
		}
	}
	return out, rows.Err()
}
func (r *Postgres) Get(ctx context.Context, actor string) (Preferences, error) {
	return read(ctx, r.db, actor)
}
func (r *Postgres) Patch(ctx context.Context, actor string, student bool, p Patch) (out Preferences, err error) {
	defer func() {
		var pe *pgconn.PgError
		if errors.As(err, &pe) && (pe.Code == "23503" || pe.Code == "22P02") {
			err = ErrInvalid
		}
	}()
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return Empty(), err
	}
	defer tx.Rollback(ctx)
	// User row lock serializes even first writes and concurrent partial stage patches.
	var locked string
	if err = tx.QueryRow(ctx, `SELECT id::text FROM users WHERE id=$1::uuid FOR UPDATE`, actor).Scan(&locked); err != nil {
		return Empty(), err
	}
	current, err := read(ctx, tx, actor)
	if err != nil {
		return Empty(), err
	}
	if p.EnrolledPaths == nil && p.PathStageSelections == nil {
		return current, nil
	}
	rows, err := tx.Query(ctx, `SELECT id::text,status='active',COALESCE((presentation->>'showInHome')::boolean,true),COALESCE((presentation->>'showInNavbar')::boolean,true),COALESCE(presentation->'settings'->>'stageSelection','auto') FROM paths`)
	if err != nil {
		return Empty(), err
	}
	paths := []Path{}
	for rows.Next() {
		var v Path
		if err = rows.Scan(&v.ID, &v.Active, &v.ShowHome, &v.ShowNavbar, &v.StagePolicy); err != nil {
			rows.Close()
			return Empty(), err
		}
		paths = append(paths, v)
	}
	err = rows.Err()
	rows.Close()
	if err != nil {
		return Empty(), err
	}
	rows, err = tx.Query(ctx, `SELECT id::text,path_id::text,status FROM levels WHERE status='active'`)
	if err != nil {
		return Empty(), err
	}
	levels := []Level{}
	for rows.Next() {
		var v Level
		if err = rows.Scan(&v.ID, &v.PathID, &v.Status); err != nil {
			rows.Close()
			return Empty(), err
		}
		levels = append(levels, v)
	}
	err = rows.Err()
	rows.Close()
	if err != nil {
		return Empty(), err
	}
	out, err = Resolve(current, p, paths, levels, student)
	if err != nil {
		return Empty(), err
	}
	if _, err = tx.Exec(ctx, `DELETE FROM learning_navigation_paths WHERE user_id=$1::uuid`, actor); err != nil {
		return Empty(), err
	}
	for i, id := range out.EnrolledPaths {
		if _, err = tx.Exec(ctx, `INSERT INTO learning_navigation_paths(user_id,path_id,position) VALUES($1::uuid,$2::uuid,$3)`, actor, id, i); err != nil {
			return Empty(), err
		}
	}
	for i, s := range out.PathStageSelections {
		if _, err = tx.Exec(ctx, `INSERT INTO learning_navigation_stages(user_id,path_id,level_id,position) VALUES($1::uuid,$2::uuid,$3::uuid,$4)`, actor, s.PathID, s.LevelID, i); err != nil {
			return Empty(), err
		}
	}
	metadata, _ := json.Marshal(out)
	if _, err = tx.Exec(ctx, `INSERT INTO audit_logs(actor_user_id,action,resource_type,resource_id,metadata) VALUES($1::uuid,'learning.navigation_preferences.updated','learning_navigation_preferences',$1,$2::jsonb)`, actor, metadata); err != nil {
		return Empty(), err
	}
	if err = tx.Commit(ctx); err != nil {
		return Empty(), err
	}
	return out, nil
}
