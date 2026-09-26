package postgres

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	commerce "github.com/nasef6464/almeaago/internal/commerce/domain"
	operations "github.com/nasef6464/almeaago/internal/operations/domain"
)

type AuditWriter interface {
	WriteTx(context.Context, pgx.Tx, operations.AuditEvent) error
}

type Repository struct {
	db *pgxpool.Pool
	audit AuditWriter
}

func New(db *pgxpool.Pool, audit AuditWriter) *Repository { return &Repository{db:db,audit:audit} }

func mapError(err error) error {
	if errors.Is(err,pgx.ErrNoRows){return commerce.ErrNotFound}
	var pgErr *pgconn.PgError
	if errors.As(err,&pgErr) {
		if pgErr.Code=="23505"||pgErr.Code=="23503"||pgErr.Code=="23514"{return commerce.ErrConflict}
	}
	return err
}

func (r *Repository) auditTx(ctx context.Context, tx pgx.Tx, e operations.AuditEvent) error {
	if r.audit==nil{return errors.New("commerce audit writer is not configured")}
	return r.audit.WriteTx(ctx,tx,e)
}

type scanner interface{ Scan(...any) error }

func scanProduct(row scanner) (commerce.Product,error) {
	var p commerce.Product
	var packageID string
	var kind *commerce.PackageKind
	var seat,days *int
	err:=row.Scan(&p.ID,&p.Code,&p.ProductType,&p.Name,&p.Description,&p.Status,&p.AccessMode,&p.PriceMinor,&p.Currency,&p.CourseID,&p.IsVisible,&p.Revision,&p.CreatedAt,&p.UpdatedAt,&packageID,&kind,&seat,&days)
	if err!=nil{return p,mapError(err)}
	if packageID!=""&&kind!=nil{p.Package=&commerce.Package{ID:packageID,ProductID:p.ID,PackageKind:*kind,SeatCapacity:seat,ValidityDays:days}}
	return p,nil
}

const productSelect = `
SELECT p.id::text,p.code,p.product_type,p.name,p.description,p.status,p.access_mode,p.price_minor,p.currency,
       COALESCE(p.course_id::text,''),p.is_visible,p.revision,p.created_at,p.updated_at,
       COALESCE(pk.id::text,''),pk.package_kind,pk.seat_capacity,pk.validity_days
FROM commerce_products p
LEFT JOIN commerce_packages pk ON pk.product_id=p.id
`

func (r *Repository) ListProducts(ctx context.Context,page,limit int,kind commerce.ProductType,status commerce.ProductStatus,search string)(commerce.ProductPage,error){
	rows,err:=r.db.Query(ctx,productSelect+`
WHERE ($1='' OR p.product_type=$1)
  AND ($2='' OR p.status=$2)
  AND ($3='' OR p.code ILIKE '%'||$3||'%' OR p.name ILIKE '%'||$3||'%')
ORDER BY p.updated_at DESC,p.id DESC
LIMIT $4 OFFSET $5
`,string(kind),string(status),search,limit+1,(page-1)*limit)
	if err!=nil{return commerce.ProductPage{},err}
	defer rows.Close()
	out:=commerce.ProductPage{Page:page,Limit:limit}
	for rows.Next(){p,e:=scanProduct(rows);if e!=nil{return out,e};out.Items=append(out.Items,p)}
	if err=rows.Err();err!=nil{return out,err}
	if len(out.Items)>limit{out.HasMore=true;out.Items=out.Items[:limit]}
	return out,nil
}

func (r *Repository) GetProduct(ctx context.Context,id string)(commerce.Product,error){
	p,err:=scanProduct(r.db.QueryRow(ctx,productSelect+` WHERE p.id=$1::uuid`,id))
	if err!=nil{return p,err}
	if p.Package!=nil {
		rows,e:=r.db.Query(ctx,`
SELECT scope_type,COALESCE(course_id::text,''),COALESCE(path_id::text,''),COALESCE(subject_id::text,''),COALESCE(content_type,'')
FROM commerce_package_items WHERE package_id=$1::uuid ORDER BY scope_type,course_id,path_id,subject_id,content_type
`,p.Package.ID)
		if e!=nil{return commerce.Product{},e}
		defer rows.Close()
		for rows.Next(){var item commerce.PackageItem;if e=rows.Scan(&item.ScopeType,&item.CourseID,&item.PathID,&item.SubjectID,&item.ContentType);e!=nil{return commerce.Product{},e};p.Package.Items=append(p.Package.Items,item)}
		if e=rows.Err();e!=nil{return commerce.Product{},e}
	}
	return p,nil
}

func insertPackage(ctx context.Context,tx pgx.Tx,productID string,w commerce.ProductWrite) error {
	if w.Package==nil{return nil}
	var packageID string
	err:=tx.QueryRow(ctx,`
INSERT INTO commerce_packages(product_id,package_kind,seat_capacity,validity_days)
VALUES($1::uuid,$2,$3,$4) RETURNING id::text
`,productID,string(w.Package.PackageKind),w.Package.SeatCapacity,w.Package.ValidityDays).Scan(&packageID)
	if err!=nil{return mapError(err)}
	for _,item:=range w.Package.Items{
		_,err=tx.Exec(ctx,`
INSERT INTO commerce_package_items(package_id,scope_type,course_id,path_id,subject_id,content_type)
VALUES($1::uuid,$2,NULLIF($3,'')::uuid,NULLIF($4,'')::uuid,NULLIF($5,'')::uuid,NULLIF($6,''))
`,packageID,string(item.ScopeType),item.CourseID,item.PathID,item.SubjectID,string(item.ContentType))
		if err!=nil{return mapError(err)}
	}
	return nil
}

func (r *Repository) CreateProduct(ctx context.Context,actor string,w commerce.ProductWrite)(commerce.Product,error){
	tx,err:=r.db.Begin(ctx);if err!=nil{return commerce.Product{},err};defer tx.Rollback(ctx)
	var id string
	err=tx.QueryRow(ctx,`
INSERT INTO commerce_products(code,product_type,name,description,status,access_mode,price_minor,currency,course_id,is_visible,created_by)
VALUES($1,$2,$3,$4,$5,$6,$7,$8,NULLIF($9,'')::uuid,$10,$11::uuid)
RETURNING id::text
`,w.Code,string(w.ProductType),w.Name,w.Description,string(w.Status),string(w.AccessMode),w.PriceMinor,w.Currency,w.CourseID,w.IsVisible,actor).Scan(&id)
	if err!=nil{return commerce.Product{},mapError(err)}
	if err=insertPackage(ctx,tx,id,w);err!=nil{return commerce.Product{},err}
	if err=r.auditTx(ctx,tx,operations.AuditEvent{ActorUserID:actor,Action:"commerce.product.create",ResourceType:"commerce_product",ResourceID:id,Metadata:map[string]any{"type":w.ProductType,"courseId":w.CourseID}});err!=nil{return commerce.Product{},err}
	if err=tx.Commit(ctx);err!=nil{return commerce.Product{},err}
	return r.GetProduct(ctx,id)
}

func (r *Repository) UpdateProduct(ctx context.Context,actor,id string,expected int,w commerce.ProductWrite)(commerce.Product,error){
	tx,err:=r.db.Begin(ctx);if err!=nil{return commerce.Product{},err};defer tx.Rollback(ctx)
	tag,err:=tx.Exec(ctx,`
UPDATE commerce_products SET code=$3,name=$4,description=$5,status=$6,access_mode=$7,price_minor=$8,currency=$9,is_visible=$10,revision=revision+1,updated_at=now()
WHERE id=$1::uuid AND revision=$2 AND product_type=$11 AND COALESCE(course_id::text,'')=$12
`,id,expected,w.Code,w.Name,w.Description,string(w.Status),string(w.AccessMode),w.PriceMinor,w.Currency,w.IsVisible,string(w.ProductType),w.CourseID)
	if err!=nil{return commerce.Product{},mapError(err)}
	if tag.RowsAffected()==0{return commerce.Product{},commerce.ErrVersionConflict}
	if w.Package!=nil{
		var packageID string
		err=tx.QueryRow(ctx,`
UPDATE commerce_packages SET package_kind=$2,seat_capacity=$3,validity_days=$4,updated_at=now()
WHERE product_id=$1::uuid RETURNING id::text
`,id,string(w.Package.PackageKind),w.Package.SeatCapacity,w.Package.ValidityDays).Scan(&packageID)
		if err!=nil{return commerce.Product{},mapError(err)}
		if _,err=tx.Exec(ctx,`DELETE FROM commerce_package_items WHERE package_id=$1::uuid`,packageID);err!=nil{return commerce.Product{},err}
		for _,item:=range w.Package.Items{
			_,err=tx.Exec(ctx,`
INSERT INTO commerce_package_items(package_id,scope_type,course_id,path_id,subject_id,content_type)
VALUES($1::uuid,$2,NULLIF($3,'')::uuid,NULLIF($4,'')::uuid,NULLIF($5,'')::uuid,NULLIF($6,''))
`,packageID,string(item.ScopeType),item.CourseID,item.PathID,item.SubjectID,string(item.ContentType))
			if err!=nil{return commerce.Product{},mapError(err)}
		}
	}
	if err=r.auditTx(ctx,tx,operations.AuditEvent{ActorUserID:actor,Action:"commerce.product.update",ResourceType:"commerce_product",ResourceID:id,Metadata:map[string]any{"revision":expected+1,"status":w.Status,"accessMode":w.AccessMode}});err!=nil{return commerce.Product{},err}
	if err=tx.Commit(ctx);err!=nil{return commerce.Product{},err}
	return r.GetProduct(ctx,id)
}

func scanEntitlement(row scanner)(commerce.Entitlement,error){
	var e commerce.Entitlement
	err:=row.Scan(&e.ID,&e.SubjectType,&e.UserID,&e.SchoolID,&e.ProductID,&e.SourceType,&e.SourceID,&e.Status,&e.GrantedByUserID,&e.StartsAt,&e.ExpiresAt,&e.RevokedAt,&e.RevokeReason,&e.IdempotencyKey,&e.Revision,&e.CreatedAt,&e.UpdatedAt)
	if err!=nil{return e,mapError(err)}
	return e,nil
}

const entitlementSelect=`
SELECT id::text,subject_type,COALESCE(user_id::text,''),COALESCE(school_id::text,''),product_id::text,source_type,source_id,status,COALESCE(granted_by_user_id::text,''),starts_at,expires_at,revoked_at,revoke_reason,idempotency_key,revision,created_at,updated_at
FROM commerce_entitlements
`

func (r *Repository) ListEntitlements(ctx context.Context,page,limit int,subjectType commerce.SubjectType,subjectID string)(commerce.EntitlementPage,error){
	rows,err:=r.db.Query(ctx,entitlementSelect+`
WHERE ($1='' OR subject_type=$1)
  AND ($2='' OR user_id::text=$2 OR school_id::text=$2)
ORDER BY created_at DESC,id DESC LIMIT $3 OFFSET $4
`,string(subjectType),subjectID,limit+1,(page-1)*limit)
	if err!=nil{return commerce.EntitlementPage{},err}
	defer rows.Close();out:=commerce.EntitlementPage{Page:page,Limit:limit}
	for rows.Next(){e,x:=scanEntitlement(rows);if x!=nil{return out,x};out.Items=append(out.Items,e)}
	if err=rows.Err();err!=nil{return out,err}
	if len(out.Items)>limit{out.HasMore=true;out.Items=out.Items[:limit]}
	return out,nil
}

func (r *Repository) GrantEntitlement(ctx context.Context,actor string,in commerce.EntitlementGrant)(commerce.Entitlement,error){
	tx,err:=r.db.Begin(ctx);if err!=nil{return commerce.Entitlement{},err};defer tx.Rollback(ctx)
	var id string
	err=tx.QueryRow(ctx,`
INSERT INTO commerce_entitlements(subject_type,user_id,school_id,product_id,source_type,source_id,status,granted_by_user_id,starts_at,expires_at,idempotency_key)
VALUES($1,NULLIF($2,'')::uuid,NULLIF($3,'')::uuid,$4::uuid,'admin_manual',$5,'active',$6::uuid,$7,$8,$5)
ON CONFLICT(idempotency_key) DO UPDATE SET idempotency_key=EXCLUDED.idempotency_key
RETURNING id::text
`,string(in.SubjectType),in.UserID,in.SchoolID,in.ProductID,in.IdempotencyKey,actor,*in.StartsAt,in.ExpiresAt).Scan(&id)
	if err!=nil{return commerce.Entitlement{},mapError(err)}
	if err=r.auditTx(ctx,tx,operations.AuditEvent{ActorUserID:actor,Action:"commerce.entitlement.grant",ResourceType:"commerce_entitlement",ResourceID:id,Metadata:map[string]any{"subjectType":in.SubjectType,"userId":in.UserID,"schoolId":in.SchoolID,"productId":in.ProductID}});err!=nil{return commerce.Entitlement{},err}
	if err=tx.Commit(ctx);err!=nil{return commerce.Entitlement{},err}
	return scanEntitlement(r.db.QueryRow(ctx,entitlementSelect+` WHERE id=$1::uuid`,id))
}

func (r *Repository) RevokeEntitlement(ctx context.Context,actor,id string,expected int,reason string)(commerce.Entitlement,error){
	tx,err:=r.db.Begin(ctx);if err!=nil{return commerce.Entitlement{},err};defer tx.Rollback(ctx)
	tag,err:=tx.Exec(ctx,`
UPDATE commerce_entitlements SET status='revoked',revoked_at=now(),revoked_by_user_id=$3::uuid,revoke_reason=$4,revision=revision+1,updated_at=now()
WHERE id=$1::uuid AND revision=$2 AND status='active'
`,id,expected,actor,reason)
	if err!=nil{return commerce.Entitlement{},mapError(err)}
	if tag.RowsAffected()==0{return commerce.Entitlement{},commerce.ErrVersionConflict}
	if err=r.auditTx(ctx,tx,operations.AuditEvent{ActorUserID:actor,Action:"commerce.entitlement.revoke",ResourceType:"commerce_entitlement",ResourceID:id,Metadata:map[string]any{"reason":reason}});err!=nil{return commerce.Entitlement{},err}
	if err=tx.Commit(ctx);err!=nil{return commerce.Entitlement{},err}
	return scanEntitlement(r.db.QueryRow(ctx,entitlementSelect+` WHERE id=$1::uuid`,id))
}

func (r *Repository) ResolveCourseAccess(ctx context.Context,userID string,schoolIDs []string,courseID,pathID,subjectID string)(commerce.AccessDecision,error){
	var decision commerce.AccessDecision
	var mode commerce.AccessMode
	err:=r.db.QueryRow(ctx,`
SELECT id::text,access_mode FROM commerce_products
WHERE product_type='course' AND course_id=$1::uuid AND status='active' AND is_visible=true
`,courseID).Scan(&decision.ProductID,&mode)
	if errors.Is(err,pgx.ErrNoRows){return commerce.AccessDecision{Configured:false,Allowed:false,Reason:"commerce_unconfigured"},nil}
	if err!=nil{return decision,err}
	decision.Configured=true
	if mode==commerce.AccessFree{decision.Allowed=true;decision.Reason="free_product";return decision,nil}

	var entitlementID,subjectType string
	err=r.db.QueryRow(ctx,`
WITH active_entitlements AS (
  SELECT e.id,e.subject_type,e.product_id,e.created_at
  FROM commerce_entitlements e
  JOIN commerce_products granted_product ON granted_product.id=e.product_id
  LEFT JOIN commerce_packages pkg ON pkg.product_id=granted_product.id
  WHERE e.status='active'
    AND e.starts_at<=now()
    AND (e.expires_at IS NULL OR e.expires_at>now())
    AND (
      (e.subject_type='user' AND e.user_id=$1::uuid)
      OR
      (e.subject_type='school' AND e.school_id::text = ANY($2::text[]))
    )
    AND (
      e.product_id=$3::uuid
      OR (
        granted_product.product_type IN ('package','membership')
        AND granted_product.status='active'
        AND granted_product.is_visible=true
        AND (e.subject_type='user' OR pkg.seat_capacity IS NULL)
        AND EXISTS(
          SELECT 1
          FROM commerce_package_items pi
          WHERE pi.package_id=pkg.id
            AND (
              pi.scope_type='all'
              OR (pi.scope_type='course' AND pi.course_id=$4::uuid)
              OR (pi.scope_type='path' AND pi.path_id=$5::uuid)
              OR (pi.scope_type='subject' AND pi.subject_id=$6::uuid)
              OR (pi.scope_type='content_type' AND pi.content_type IN ('courses','all'))
            )
        )
      )
    )
)
SELECT id::text,subject_type
FROM active_entitlements
ORDER BY CASE WHEN subject_type='user' THEN 0 ELSE 1 END,created_at DESC,id
LIMIT 1
`,userID,schoolIDs,decision.ProductID,courseID,pathID,subjectID).Scan(&entitlementID,&subjectType)
	if errors.Is(err,pgx.ErrNoRows){decision.Allowed=false;decision.Reason="paid_required";return decision,nil}
	if err!=nil{return decision,err}
	decision.Allowed=true;decision.EntitlementID=entitlementID;decision.EntitlementSource=subjectType
	if subjectType=="school"{decision.Reason="school_entitlement"}else{decision.Reason="user_entitlement"}
	return decision,nil
}

var _ = strings.TrimSpace
var _ = time.Now
