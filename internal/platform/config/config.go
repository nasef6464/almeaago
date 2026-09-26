package config

import (
	"fmt"
	"os"
	"strconv"
)

type Config struct {
	Environment string
	HTTPAddr    string
	DatabaseURL string
	RedisURL    string
	WebOrigin   string
	LogLevel    string

	OTPPepper           string
	WhatsAppOTPEndpoint string
	WhatsAppOTPToken    string

	GoogleClientID     string
	GoogleClientSecret string
	GoogleRedirectURI  string

	R2AccountID            string
	R2Bucket               string
	R2PublicBaseURL        string
	R2AccessKeyID          string
	R2SecretAccessKey      string
	MediaMaxUploadBytes    int64
	MediaPresignTTLSeconds int

	CommerceWebhookSecret string
}

func Load() (Config, error) {
	cfg := Config{
		Environment: value("APP_ENV", "development"),
		HTTPAddr:    value("HTTP_ADDR", ":8080"),
		DatabaseURL: os.Getenv("DATABASE_URL"),
		RedisURL:    os.Getenv("REDIS_URL"),
		WebOrigin:   value("WEB_ORIGIN", "http://localhost:5173"),
		LogLevel:    value("LOG_LEVEL", "info"),

		OTPPepper:           os.Getenv("AUTH_OTP_PEPPER"),
		WhatsAppOTPEndpoint: os.Getenv("WHATSAPP_OTP_ENDPOINT"),
		WhatsAppOTPToken:    os.Getenv("WHATSAPP_OTP_TOKEN"),

		GoogleClientID:     os.Getenv("GOOGLE_CLIENT_ID"),
		GoogleClientSecret: os.Getenv("GOOGLE_CLIENT_SECRET"),
		GoogleRedirectURI:  os.Getenv("GOOGLE_REDIRECT_URI"),

		R2AccountID:       os.Getenv("R2_ACCOUNT_ID"),
		R2Bucket:          os.Getenv("R2_BUCKET"),
		R2PublicBaseURL:   os.Getenv("R2_PUBLIC_BASE_URL"),
		R2AccessKeyID:     os.Getenv("R2_ACCESS_KEY_ID"),
		R2SecretAccessKey: os.Getenv("R2_SECRET_ACCESS_KEY"),

		CommerceWebhookSecret: os.Getenv("COMMERCE_WEBHOOK_SECRET"),
	}

	if cfg.DatabaseURL == "" {
		return Config{}, fmt.Errorf("DATABASE_URL is required")
	}
	if cfg.RedisURL == "" {
		return Config{}, fmt.Errorf("REDIS_URL is required")
	}

	maxUpload, err := int64Value("MEDIA_MAX_UPLOAD_BYTES", 15*1024*1024)
	if err != nil || maxUpload <= 0 {
		return Config{}, fmt.Errorf("MEDIA_MAX_UPLOAD_BYTES must be a positive integer")
	}
	presignTTL, err := intValue("R2_PRESIGN_TTL_SECONDS", 900)
	if err != nil || presignTTL < 60 || presignTTL > 3600 {
		return Config{}, fmt.Errorf("R2_PRESIGN_TTL_SECONDS must be between 60 and 3600")
	}
	cfg.MediaMaxUploadBytes = maxUpload
	cfg.MediaPresignTTLSeconds = presignTTL

	return cfg, nil
}

func (c Config) IsProduction() bool {
	return c.Environment == "production"
}

func value(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func int64Value(key string, fallback int64) (int64, error) {
	raw := os.Getenv(key)
	if raw == "" {
		return fallback, nil
	}
	return strconv.ParseInt(raw, 10, 64)
}

func intValue(key string, fallback int) (int, error) {
	raw := os.Getenv(key)
	if raw == "" {
		return fallback, nil
	}
	value, err := strconv.Atoi(raw)
	if err != nil {
		return 0, err
	}
	return value, nil
}
