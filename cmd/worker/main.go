package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"syscall"
	"github.com/nasef6464/almeaago/internal/platform/config"
	"github.com/nasef6464/almeaago/internal/platform/observability"
)
func main(){
	cfg,err:=config.Load(); if err!=nil{slog.Error("configuration_error","error",err);os.Exit(1)}
	logger:=observability.NewLogger(cfg.LogLevel)
	ctx,stop:=signal.NotifyContext(context.Background(),syscall.SIGINT,syscall.SIGTERM);defer stop()
	logger.Info("worker_started","env",cfg.Environment);<-ctx.Done();logger.Info("worker_stopped")
}
