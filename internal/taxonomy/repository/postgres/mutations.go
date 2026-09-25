package postgres

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	taxonomy "github.com/nasef6464/almeaago/internal/taxonomy/domain"
)

func (r *Repository) CreatePath(ctx context.Context, actor string, write taxonomy.PathWrite) (taxonomy.Path, error) {
	tx, err := r.db.Begin(ctx); if err != nil { return taxonomy.Path{}, err }; defer func(){ _ = tx.Rollback(ctx) }()
	var row taxonomy.Path
	err = tx.QueryRow(ctx, `INSERT INTO paths(code,name,parent_path_id,description,sort_order)
		VALUES($1,$2,NULLIF($3,'')::uuid,$4,$5)
		RETURNING id::text,code,name,COALESCE(parent_path_id::text,''),description,sort_order`,
		write.Code,write.Name,write.ParentPathID,write.Description,write.SortOrder).Scan(&row.ID,&row.Code,&row.Name,&row.ParentPathID,&row.Description,&row.SortOrder)
	if err != nil { return taxonomy.Path{}, mapMutationError(err) }
	if err := writeTaxonomyAudit(ctx, tx, actor, "taxonomy.path.create", "path", row.ID); err != nil { return taxonomy.Path{}, err }
	if err := tx.Commit(ctx); err != nil { return taxonomy.Path{}, err }; return row,nil
}

func (r *Repository) UpdatePath(ctx context.Context, actor,pathID string, patch taxonomy.PathPatch) (taxonomy.Path,error) {
	tx,err:=r.db.Begin(ctx); if err!=nil{return taxonomy.Path{},err}; defer func(){_=tx.Rollback(ctx)}()
	set,args:=[]string{"updated_at=now()"},[]any{pathID}
	add:=func(expr string,v any){args=append(args,v);set=append(set,fmt.Sprintf(expr,len(args)))}
	if patch.Name!=nil{add("name=$%d",*patch.Name)}
	if patch.ParentPathID!=nil{add("parent_path_id=NULLIF($%d,'')::uuid",*patch.ParentPathID)}
	if patch.Description!=nil{add("description=$%d",*patch.Description)}
	if patch.SortOrder!=nil{add("sort_order=$%d",*patch.SortOrder)}
	if patch.Status!=nil{add("status=$%d",string(*patch.Status))}
	var row taxonomy.Path
	q:=`UPDATE paths SET `+strings.Join(set,",")+ ` WHERE id=$1::uuid RETURNING id::text,code,name,COALESCE(parent_path_id::text,''),description,sort_order`
	err=tx.QueryRow(ctx,q,args...).Scan(&row.ID,&row.Code,&row.Name,&row.ParentPathID,&row.Description,&row.SortOrder)
	if err!=nil{return taxonomy.Path{},mapMutationError(err)}
	if err:=writeTaxonomyAudit(ctx,tx,actor,"taxonomy.path.update","path",row.ID);err!=nil{return taxonomy.Path{},err}
	if err:=tx.Commit(ctx);err!=nil{return taxonomy.Path{},err};return row,nil
}

func (r *Repository) CreateLevel(ctx context.Context, actor string, write taxonomy.LevelWrite)(taxonomy.Level,error){
	tx,err:=r.db.Begin(ctx);if err!=nil{return taxonomy.Level{},err};defer func(){_=tx.Rollback(ctx)}()
	var row taxonomy.Level
	err=tx.QueryRow(ctx,`INSERT INTO levels(path_id,code,name,sort_order)
		SELECT p.id,$2,$3,$4 FROM paths p WHERE p.id=$1::uuid AND p.status='active'
		RETURNING id::text,path_id::text,code,name,sort_order`,write.PathID,write.Code,write.Name,write.SortOrder).Scan(&row.ID,&row.PathID,&row.Code,&row.Name,&row.SortOrder)
	if err!=nil{return taxonomy.Level{},mapMutationError(err)}
	if err:=writeTaxonomyAudit(ctx,tx,actor,"taxonomy.level.create","level",row.ID);err!=nil{return taxonomy.Level{},err}
	if err:=tx.Commit(ctx);err!=nil{return taxonomy.Level{},err};return row,nil
}

func (r *Repository) UpdateLevel(ctx context.Context, actor,levelID string,patch taxonomy.LevelPatch)(taxonomy.Level,error){
	tx,err:=r.db.Begin(ctx);if err!=nil{return taxonomy.Level{},err};defer func(){_=tx.Rollback(ctx)}()
	set,args:=[]string{"updated_at=now()"},[]any{levelID};add:=func(expr string,v any){args=append(args,v);set=append(set,fmt.Sprintf(expr,len(args)))}
	if patch.Name!=nil{add("name=$%d",*patch.Name)};if patch.SortOrder!=nil{add("sort_order=$%d",*patch.SortOrder)};if patch.Status!=nil{add("status=$%d",string(*patch.Status))}
	var row taxonomy.Level;q:=`UPDATE levels SET `+strings.Join(set,",")+ ` WHERE id=$1::uuid RETURNING id::text,path_id::text,code,name,sort_order`
	err=tx.QueryRow(ctx,q,args...).Scan(&row.ID,&row.PathID,&row.Code,&row.Name,&row.SortOrder);if err!=nil{return taxonomy.Level{},mapMutationError(err)}
	if err:=writeTaxonomyAudit(ctx,tx,actor,"taxonomy.level.update","level",row.ID);err!=nil{return taxonomy.Level{},err};if err:=tx.Commit(ctx);err!=nil{return taxonomy.Level{},err};return row,nil
}

func (r *Repository) CreateSubject(ctx context.Context,actor string,write taxonomy.SubjectWrite)(taxonomy.Subject,error){
	tx,err:=r.db.Begin(ctx);if err!=nil{return taxonomy.Subject{},err};defer func(){_=tx.Rollback(ctx)}();var row taxonomy.Subject
	err=tx.QueryRow(ctx,`INSERT INTO subjects(path_id,level_id,code,name,sort_order)
		SELECT p.id,l.id,$3,$4,$5 FROM paths p LEFT JOIN levels l ON l.id=NULLIF($2,'')::uuid
		WHERE p.id=$1::uuid AND p.status='active' AND ($2='' OR (l.path_id=p.id AND l.status='active'))
		RETURNING id::text,path_id::text,COALESCE(level_id::text,''),code,name,sort_order`,write.PathID,write.LevelID,write.Code,write.Name,write.SortOrder).Scan(&row.ID,&row.PathID,&row.LevelID,&row.Code,&row.Name,&row.SortOrder)
	if err!=nil{return taxonomy.Subject{},mapMutationError(err)};if err:=writeTaxonomyAudit(ctx,tx,actor,"taxonomy.subject.create","subject",row.ID);err!=nil{return taxonomy.Subject{},err};if err:=tx.Commit(ctx);err!=nil{return taxonomy.Subject{},err};return row,nil
}

func (r *Repository) UpdateSubject(ctx context.Context,actor,subjectID string,patch taxonomy.SubjectPatch)(taxonomy.Subject,error){
	tx,err:=r.db.Begin(ctx);if err!=nil{return taxonomy.Subject{},err};defer func(){_=tx.Rollback(ctx)}()
	if patch.LevelID!=nil && *patch.LevelID!="" { var ok bool;err=tx.QueryRow(ctx,`SELECT EXISTS(SELECT 1 FROM subjects s JOIN levels l ON l.id=$2::uuid AND l.path_id=s.path_id AND l.status='active' WHERE s.id=$1::uuid)`,subjectID,*patch.LevelID).Scan(&ok);if err!=nil{return taxonomy.Subject{},err};if !ok{return taxonomy.Subject{},taxonomy.ErrConflict} }
	set,args:=[]string{"updated_at=now()"},[]any{subjectID};add:=func(expr string,v any){args=append(args,v);set=append(set,fmt.Sprintf(expr,len(args)))}
	if patch.Name!=nil{add("name=$%d",*patch.Name)};if patch.LevelID!=nil{add("level_id=NULLIF($%d,'')::uuid",*patch.LevelID)};if patch.SortOrder!=nil{add("sort_order=$%d",*patch.SortOrder)};if patch.Status!=nil{add("status=$%d",string(*patch.Status))}
	var row taxonomy.Subject;q:=`UPDATE subjects SET `+strings.Join(set,",")+ ` WHERE id=$1::uuid RETURNING id::text,path_id::text,COALESCE(level_id::text,''),code,name,sort_order`
	err=tx.QueryRow(ctx,q,args...).Scan(&row.ID,&row.PathID,&row.LevelID,&row.Code,&row.Name,&row.SortOrder);if err!=nil{return taxonomy.Subject{},mapMutationError(err)}
	if err:=writeTaxonomyAudit(ctx,tx,actor,"taxonomy.subject.update","subject",row.ID);err!=nil{return taxonomy.Subject{},err};if err:=tx.Commit(ctx);err!=nil{return taxonomy.Subject{},err};return row,nil
}

func (r *Repository) CreateSkill(ctx context.Context,actor string,write taxonomy.SkillWrite)(taxonomy.Skill,error){
	tx,err:=r.db.Begin(ctx);if err!=nil{return taxonomy.Skill{},err};defer func(){_=tx.Rollback(ctx)}();var row taxonomy.Skill
	err=tx.QueryRow(ctx,`INSERT INTO skills(subject_id,parent_skill_id,code,name,description,kind,sort_order)
		SELECT s.id,p.id,$3,$4,$5,$6,$7 FROM subjects s LEFT JOIN skills p ON p.id=NULLIF($2,'')::uuid
		JOIN paths path ON path.id=s.path_id AND path.status='active'
		LEFT JOIN levels l ON l.id=s.level_id
		WHERE s.id=$1::uuid AND s.status='active' AND (s.level_id IS NULL OR l.status='active')
		  AND (($6='main' AND $2='') OR ($6='sub' AND p.subject_id=s.id AND p.kind='main' AND p.status='active'))
		RETURNING id::text,subject_id::text,COALESCE(parent_skill_id::text,''),code,name,description,kind,sort_order`,
		write.SubjectID,write.ParentSkillID,write.Code,write.Name,write.Description,write.Kind,write.SortOrder).Scan(&row.ID,&row.SubjectID,&row.ParentSkillID,&row.Code,&row.Name,&row.Description,&row.Kind,&row.SortOrder)
	if err!=nil{return taxonomy.Skill{},mapMutationError(err)};if err:=writeTaxonomyAudit(ctx,tx,actor,"taxonomy.skill.create","skill",row.ID);err!=nil{return taxonomy.Skill{},err};if err:=tx.Commit(ctx);err!=nil{return taxonomy.Skill{},err};return row,nil
}

func (r *Repository) UpdateSkill(ctx context.Context,actor,skillID string,patch taxonomy.SkillPatch)(taxonomy.Skill,error){
	tx,err:=r.db.Begin(ctx);if err!=nil{return taxonomy.Skill{},err};defer func(){_=tx.Rollback(ctx)}()
	if patch.ParentSkillID!=nil { if *patch.ParentSkillID=="" { return taxonomy.Skill{},taxonomy.ErrConflict }; var ok bool;err=tx.QueryRow(ctx,`SELECT EXISTS(SELECT 1 FROM skills child JOIN skills parent ON parent.id=$2::uuid WHERE child.id=$1::uuid AND child.kind='sub' AND parent.kind='main' AND parent.status='active' AND parent.subject_id=child.subject_id)`,skillID,*patch.ParentSkillID).Scan(&ok);if err!=nil{return taxonomy.Skill{},err};if !ok{return taxonomy.Skill{},taxonomy.ErrConflict} }
	set,args:=[]string{"updated_at=now()"},[]any{skillID};add:=func(expr string,v any){args=append(args,v);set=append(set,fmt.Sprintf(expr,len(args)))}
	if patch.Name!=nil{add("name=$%d",*patch.Name)};if patch.ParentSkillID!=nil{add("parent_skill_id=$%d::uuid",*patch.ParentSkillID)};if patch.Description!=nil{add("description=$%d",*patch.Description)};if patch.SortOrder!=nil{add("sort_order=$%d",*patch.SortOrder)};if patch.Status!=nil{add("status=$%d",string(*patch.Status))}
	var row taxonomy.Skill;q:=`UPDATE skills SET `+strings.Join(set,",")+ ` WHERE id=$1::uuid RETURNING id::text,subject_id::text,COALESCE(parent_skill_id::text,''),code,name,description,kind,sort_order`
	err=tx.QueryRow(ctx,q,args...).Scan(&row.ID,&row.SubjectID,&row.ParentSkillID,&row.Code,&row.Name,&row.Description,&row.Kind,&row.SortOrder);if err!=nil{return taxonomy.Skill{},mapMutationError(err)}
	if err:=writeTaxonomyAudit(ctx,tx,actor,"taxonomy.skill.update","skill",row.ID);err!=nil{return taxonomy.Skill{},err};if err:=tx.Commit(ctx);err!=nil{return taxonomy.Skill{},err};return row,nil
}

func writeTaxonomyAudit(ctx context.Context,tx pgx.Tx,actor,action,resourceType,resourceID string)error{
	_,err:=tx.Exec(ctx,`INSERT INTO audit_logs(actor_user_id,action,resource_type,resource_id,status,metadata)
		SELECT id,$2,$3,$4,'success','{}'::jsonb FROM users WHERE id=$1::uuid`,actor,action,resourceType,resourceID);return err
}

func mapMutationError(err error) error {
	if errors.Is(err,pgx.ErrNoRows){return taxonomy.ErrNotFound}
	var pgErr *pgconn.PgError
	if errors.As(err,&pgErr) && (pgErr.Code=="23505" || pgErr.Code=="23503" || pgErr.Code=="23514"){return taxonomy.ErrConflict}
	return err
}
