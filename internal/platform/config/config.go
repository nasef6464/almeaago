package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
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

	AIRequestTimeoutMS                 int
	AIQuestionAssistantCacheMinutes    int
	AIQuestionAssistantPerMinute       int
	AIQuestionAssistantMaxOutputTokens int
	AIInteractionRetentionDays         int
	AIGlobalDailyLimit                 int
	AIUserDailyLimit                   int

	GeminiAPIKey     string
	OpenRouterAPIKey string
	QwenAPIKey       string
	DeepSeekAPIKey   string
	OpenAIAPIKey     string
	OllamaBaseURL    string
	OllamaModel      string
	LMStudioBaseURL  string
	LMStudioModel    string
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
		OpenRouterAPIKey: os.Getenv("OPENROUTER_API_KEY"),
		QwenAPIKey:       os.Getenv("QWEN_API_KEY"),
		DeepSeekAPIKey:   os.Getenv("DEEPSEEK_API_KEY"),
		OpenAIAPIKey:     os.Getenv("OPENAI_API_KEY"),
		OllamaBaseURL:    strings.TrimSpace(os.Getenv("OLLAMA_BASE_URL")),
		OllamaModel:      value("OLLAMA_MODEL", "gemma3:4b"),
		LMStudioBaseURL:  strings.TrimSpace(os.Getenv("LMSTUDIO_BASE_URL")),
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

	aiTimeoutMS, err := intValue("AI_REQUEST_TIMEOUT_MS", 15000)
	if err != nil || aiTimeoutMS < 1000 || aiTimeoutMS > 60000 {
		return Config{}, fmt.Errorf("AI_REQUEST_TIMEOUT_MS must be between 1000 and 60000")
	}
	aiCacheMinutes, err := intValue("AI_QUESTION_ASSISTANT_CACHE_MINUTES", 30)
	if err != nil || aiCacheMinutes < 1 || aiCacheMinutes > 1440 {
		return Config{}, fmt.Errorf("AI_QUESTION_ASSISTANT_CACHE_MINUTES must be between 1 and 1440")
	}
	aiPerMinute, err := intValue("AI_QUESTION_ASSISTANT_PER_MINUTE", 8)
	if err != nil || aiPerMinute < 1 || aiPerMinute > 60 {
		return Config{}, fmt.Errorf("AI_QUESTION_ASSISTANT_PER_MINUTE must be between 1 and 60")
	}
	aiMaxOutputTokens, err := intValue("AI_QUESTION_ASSISTANT_MAX_OUTPUT_TOKENS", 450)
	if err != nil || aiMaxOutputTokens < 64 || aiMaxOutputTokens > 2000 {
		return Config{}, fmt.Errorf("AI_QUESTION_ASSISTANT_MAX_OUTPUT_TOKENS must be between 64 and 2000")
	}
	aiRetentionDays, err := intValue("AI_INTERACTION_RETENTION_DAYS", 30)
	if err != nil || aiRetentionDays < 1 || aiRetentionDays > 365 {
		return Config{}, fmt.Errorf("AI_INTERACTION_RETENTION_DAYS must be between 1 and 365")
	}
	aiGlobalDailyLimit, err := intValue("AI_DAILY_LIMIT", 800)
	if err != nil || aiGlobalDailyLimit < 1 || aiGlobalDailyLimit > 200000 {
		return Config{}, fmt.Errorf("AI_DAILY_LIMIT must be between 1 and 200000")
	}
	aiUserDailyLimit, err := intValue("AI_PER_USER_DAILY_LIMIT", 80)
	if err != nil || aiUserDailyLimit < 1 || aiUserDailyLimit > 20000 {
		return Config{}, fmt.Errorf("AI_PER_USER_DAILY_LIMIT must be between 1 and 20000")
	}
	cfg.AIRequestTimeoutMS = aiTimeoutMS
	cfg.AIQuestionAssistantCacheMinutes = aiCacheMinutes
	cfg.AIQuestionAssistantPerMinute = aiPerMinute
	cfg.AIQuestionAssistantMaxOutputTokens = aiMaxOutputTokens
	cfg.AIInteractionRetentionDays = aiRetentionDays
	cfg.AIGlobalDailyLimit = aiGlobalDailyLimit
	cfg.AIUserDailyLimit = aiUserDailyLimit

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
