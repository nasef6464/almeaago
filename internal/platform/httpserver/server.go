package httpserver

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"time"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
)
type Dependencies struct{Logger *slog.Logger;DB *pgxpool.Pool;Redis *redis.Client}
func New(addr string,d Dependencies)*http.Server{
	r:=chi.NewRouter();r.Use(middleware.RequestID,middleware.RealIP,middleware.Recoverer,middleware.Compress(5),requestLogger(d.Logger))
	r.Get("/health/live",func(w http.ResponseWriter,_ *http.Request){writeJSON(w,200,map[string]any{"status":"ok","service":"almeaa-api"})})
	r.Get("/health/ready",func(w http.ResponseWriter,req *http.Request){
		ctx,cancel:=context.WithTimeout(req.Context(),2*time.Second);defer cancel()
		if err:=d.DB.Ping(ctx);err!=nil{writeJSON(w,503,map[string]any{"status":"not_ready","dependency":"postgres"});return}
		if err:=d.Redis.Ping(ctx).Err();err!=nil{writeJSON(w,503,map[string]any{"status":"not_ready","dependency":"redis"});return}
		writeJSON(w,200,map[string]any{"status":"ready"})
	})
	return &http.Server{Addr:addr,Handler:r,ReadHeaderTimeout:5*time.Second,ReadTimeout:15*time.Second,WriteTimeout:30*time.Second,IdleTimeout:60*time.Second}
}
func writeJSON(w http.ResponseWriter,status int,b any){w.Header().Set("Content-Type","application/json; charset=utf-8");w.WriteHeader(status);_ = json.NewEncoder(w).Encode(b)}
func requestLogger(l *slog.Logger)func(http.Handler)http.Handler{return func(next http.Handler)http.Handler{return http.HandlerFunc(func(w http.ResponseWriter,r *http.Request){s:=time.Now();next.ServeHTTP(w,r);l.Info("http_request","method",r.Method,"path",r.URL.Path,"request_id",middleware.GetReqID(r.Context()),"duration_ms",time.Since(s).Milliseconds())})}}
