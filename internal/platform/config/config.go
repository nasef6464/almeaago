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

	NotificationWorkerBatch       int
	NotificationWorkerPollSeconds int
	EmailProvider                 string
	EmailFrom                     string
	ResendAPIKey                  string
	EmailWebhookURL               string
	EmailWebhookToken             string
	WhatsAppProvider              string
	WhatsAppAccessToken           string
	WhatsAppPhoneNumberID         string
	WhatsAppWebhookURL            string
	WhatsAppWebhookToken          string

	ClassroomPINSecret string

	AIRequestTimeoutSeconds int
	AIQuestionCacheMinutes  int
	AIInteractionRetentionDays int

	GeminiAPIKey      string
	GeminiModel       string
	OpenRouterAPIKey  string
	OpenRouterModel   string
	QwenAPIKey        string
	QwenModel         string
	QwenBaseURL       string
	DeepSeekAPIKey    string
	DeepSeekModel     string
	OpenAIAPIKey      string
	OpenAIModel       string
	OllamaBaseURL     string
	OllamaModel       string
	LMStudioBaseURL   string
	LMStudioModel     string
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

		EmailProvider:         os.Getenv("EMAIL_PROVIDER"),
		EmailFrom:             os.Getenv("EMAIL_FROM"),
		ResendAPIKey:          os.Getenv("RESEND_API_KEY"),
		EmailWebhookURL:       os.Getenv("EMAIL_WEBHOOK_URL"),
		EmailWebhookToken:     os.Getenv("EMAIL_WEBHOOK_TOKEN"),
		WhatsAppProvider:      os.Getenv("WHATSAPP_PROVIDER"),
		WhatsAppAccessToken:   os.Getenv("WHATSAPP_ACCESS_TOKEN"),
		WhatsAppPhoneNumberID: os.Getenv("WHATSAPP_PHONE_NUMBER_ID"),
		WhatsAppWebhookURL:    os.Getenv("WHATSAPP_WEBHOOK_URL"),
		WhatsAppWebhookToken:  os.Getenv("WHATSAPP_WEBHOOK_TOKEN"),

		ClassroomPINSecret: os.Getenv("CLASSROOM_PIN_SECRET"),

		GeminiAPIKey:     os.Getenv("GEMINI_API_KEY"),
		GeminiModel:      value("GEMINI_MODEL", "gemini-2.5-flash"),
		OpenRouterAPIKey: os.Getenv("OPENROUTER_API_KEY"),
		OpenRouterModel:  value("OPENROUTER_MODEL", "qwen/qwen3-235b-a22b:free"),
		QwenAPIKey:       os.Getenv("QWEN_API_KEY"),
		QwenModel:        value("QWEN_MODEL", "qwen-plus"),
		QwenBaseURL:      value("QWEN_BASE_URL", "https://dashscope-intl.aliyuncs.com/compatible-mode/v1"),
		DeepSeekAPIKey:   os.Getenv("DEEPSEEK_API_KEY"),
		DeepSeekModel:    value("DEEPSEEK_MODEL", "deepseek-chat"),
		OpenAIAPIKey:     os.Getenv("OPENAI_API_KEY"),
		OpenAIModel:      value("OPENAI_MODEL", "gpt-4.1-mini"),
		OllamaBaseURL:    value("OLLAMA_BASE_URL", "http://127.0.0.1:11434"),
		OllamaModel:      value("OLLAMA_MODEL", "gemma3:4b"),
		LMStudioBaseURL:  value("LMSTUDIO_BASE_URL", "http://127.0.0.1:1234/v1"),
		LMStudioModel:    value("LMSTUDIO_MODEL", "local-model"),
	}

	if cfg.DatabaseURL == "" {
		return Config{}, fmt.Errorf("DATABASE_URL is required")
	}
	if cfg.RedisURL == "" {
		return Config{}, fmt.Errorf("REDIS_URL is required")
	}
	if cfg.ClassroomPINSecret == "" {
		return Config{}, fmt.Errorf("CLASSROOM_PIN_SECRET is required")
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

	notificationBatch, err := intValue("NOTIFICATION_WORKER_BATCH", 25)
	if err != nil || notificationBatch < 1 || notificationBatch > 50 {
		return Config{}, fmt.Errorf("NOTIFICATION_WORKER_BATCH must be between 1 and 50")
	}
	notificationPoll, err := intValue("NOTIFICATION_WORKER_POLL_SECONDS", 5)
	if err != nil || notificationPoll < 1 || notificationPoll > 300 {
		return Config{}, fmt.Errorf("NOTIFICATION_WORKER_POLL_SECONDS must be between 1 and 300")
	}
	cfg.NotificationWorkerBatch = notificationBatch
	cfg.NotificationWorkerPollSeconds = notificationPoll

	aiTimeout, err := intValue("AI_REQUEST_TIMEOUT_SECONDS", 15)
	if err != nil || aiTimeout < 1 || aiTimeout > 60 {
		return Config{}, fmt.Errorf("AI_REQUEST_TIMEOUT_SECONDS must be between 1 and 60")
	}
	aiCacheMinutes, err := intValue("AI_QUESTION_CACHE_MINUTES", 30)
	if err != nil || aiCacheMinutes < 1 || aiCacheMinutes > 1440 {
		return Config{}, fmt.Errorf("AI_QUESTION_CACHE_MINUTES must be between 1 and 1440")
	}
	aiRetentionDays, err := intValue("AI_INTERACTION_RETENTION_DAYS", 30)
	if err != nil || aiRetentionDays < 1 || aiRetentionDays > 365 {
		return Config{}, fmt.Errorf("AI_INTERACTION_RETENTION_DAYS must be between 1 and 365")
	}
	cfg.AIRequestTimeoutSeconds = aiTimeout
	cfg.AIQuestionCacheMinutes = aiCacheMinutes
	cfg.AIInteractionRetentionDays = aiRetentionDays

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
