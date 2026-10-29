package postgres

import (
 "context"
 "os"
 "testing"
 "time"
 "github.com/jackc/pgx/v5/pgxpool"
)

// Runs only with an explicitly isolated test DB. All fixtures are TEMP tables,
// so even a failed assertion cannot publish or alter actual course records.
func TestPublicCoursesPublicationIsolationPostgres(t *testing.T){
 if os.Getenv("ALMEAA_ISOLATED_POSTGRES")!="1" || os.Getenv("DATABASE_URL")=="" {t.Skip("isolated PostgreSQL required")}
 ctx,cancel:=context.WithTimeout(context.Background(),30*time.Second);defer cancel()
 cfg,err:=pgxpool.ParseConfig(os.Getenv("DATABASE_URL"));if err!=nil{t.Fatal(err)}
 cfg.MaxConns=1
 db,err:=pgxpool.NewWithConfig(ctx,cfg);if err!=nil{t.Fatal(err)};defer db.Close()
 statements:=[]string{
  `CREATE TEMP TABLE paths(id uuid PRIMARY KEY,status text)`,
  `CREATE TEMP TABLE subjects(id uuid PRIMARY KEY,path_id uuid,status text)`,
  `CREATE TEMP TABLE assets(id uuid PRIMARY KEY,status text,public_url text)`,
  `CREATE TEMP TABLE courses(id uuid PRIMARY KEY,path_id uuid,subject_id uuid,title text,instructor_name text,thumbnail_asset_id uuid,workflow_status text,is_published boolean,is_visible boolean,owner_type text,published_at timestamptz,updated_at timestamptz)`,
  `INSERT INTO paths VALUES ('00000000-0000-4000-8000-000000000001','active'),('00000000-0000-4000-8000-000000000002','inactive')`,
  `INSERT INTO subjects VALUES ('00000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-000000000001','active'),('00000000-0000-4000-8000-000000000012','00000000-0000-4000-8000-000000000002','active'),('00000000-0000-4000-8000-000000000013','00000000-0000-4000-8000-000000000001','inactive')`,
  `INSERT INTO assets VALUES ('00000000-0000-4000-8000-000000000021','active','https://cdn.example.test/real.webp'),('00000000-0000-4000-8000-000000000022','archived','https://cdn.example.test/hidden.webp')`,
  `INSERT INTO courses SELECT ('00000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'00000000-0000-4000-8000-000000000001'::uuid,'00000000-0000-4000-8000-000000000011'::uuid,'course-'||n,'Teacher','00000000-0000-4000-8000-000000000021'::uuid,CASE WHEN n=2 THEN 'draft' ELSE 'approved' END,n<>3,n<>4,CASE WHEN n=5 THEN 'school' ELSE 'platform' END,now(),now() FROM generate_series(1,5) n`,
  `INSERT INTO courses VALUES ('00000000-0000-4000-8000-000000000006','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000012','hidden-path','Teacher',NULL,'approved',true,true,'platform',now(),now()),('00000000-0000-4000-8000-000000000007','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000013','hidden-subject','Teacher',NULL,'approved',true,true,'platform',now(),now())`,
 }
 for _,sql:=range statements{if _,err:=db.Exec(ctx,sql);err!=nil{t.Fatalf("setup: %v",err)}}
 rows,err:=New(db,nil).ListPublicCourses(ctx,10)
 if err!=nil{t.Fatal(err)}
 if len(rows)!=1 || rows[0].Title!="course-1" || rows[0].ThumbnailURL!="https://cdn.example.test/real.webp"{t.Fatalf("published leak or missing card: %+v",rows)}
}
