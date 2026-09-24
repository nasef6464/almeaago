package database
import("context";"fmt";"time";"github.com/jackc/pgx/v5/pgxpool")
func Open(ctx context.Context,url string)(*pgxpool.Pool,error){
	cfg,err:=pgxpool.ParseConfig(url);if err!=nil{return nil,fmt.Errorf("parse postgres config: %w",err)}
	cfg.MaxConns=20;cfg.MinConns=2;cfg.MaxConnLifetime=30*time.Minute;cfg.MaxConnIdleTime=5*time.Minute;cfg.HealthCheckPeriod=30*time.Second
	pool,err:=pgxpool.NewWithConfig(ctx,cfg);if err!=nil{return nil,fmt.Errorf("open postgres pool: %w",err)}
	pingCtx,cancel:=context.WithTimeout(ctx,5*time.Second);defer cancel()
	if err:=pool.Ping(pingCtx);err!=nil{pool.Close();return nil,fmt.Errorf("ping postgres: %w",err)}
	return pool,nil
}
