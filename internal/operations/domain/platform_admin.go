package domain

import (
	"errors"
	"time"
)

var ErrConflict = errors.New("operations state conflict")

type PlatformAuthSettings struct {
	AllowSelfRegistration    bool   `json:"allowSelfRegistration"`
	AllowEmailPassword       bool   `json:"allowEmailPassword"`
	RequireEmailVerification bool   `json:"requireEmailVerification"`
	RequireAdminApproval     bool   `json:"requireAdminApproval"`
	DefaultRole              string `json:"defaultRole"`
	RegistrationTitle        string `json:"registrationTitle"`
	RegistrationSubtitle     string `json:"registrationSubtitle"`
	TermsLink                string `json:"termsLink"`
	PrivacyLink              string `json:"privacyLink"`
	MaxAccountsPerDevice     int    `json:"maxAccountsPerDevice"`
}

type PlatformProviderSetting struct {
	Enabled bool   `json:"enabled"`
	Mode    string `json:"mode"`
	Note    string `json:"note"`
}

type PlatformSEOSettings struct {
	SiteName           string `json:"siteName"`
	DefaultTitle       string `json:"defaultTitle"`
	DefaultDescription string `json:"defaultDescription"`
	CanonicalBaseUrl   string `json:"canonicalBaseUrl"`
	GoogleAnalyticsId  string `json:"googleAnalyticsId"`
	GoogleTagManagerId string `json:"googleTagManagerId"`
	RobotsIndexing     bool   `json:"robotsIndexing"`
}

type PlatformContactWidgetSettings struct {
	Enabled              bool   `json:"enabled"`
	Channel              string `json:"channel"`
	WhatsAppNumber       string `json:"whatsappNumber"`
	WhatsAppMessage      string `json:"whatsappMessage"`
	OpenInNewTab         bool   `json:"openInNewTab"`
	ShowOnPublicPages    bool   `json:"showOnPublicPages"`
	ShowOnDashboardPages bool   `json:"showOnDashboardPages"`
}

type PlatformIntegrationSettings struct {
	Auth          PlatformAuthSettings               `json:"auth"`
	Providers     map[string]PlatformProviderSetting `json:"providers"`
	SEO           PlatformSEOSettings                `json:"seo"`
	ContactWidget PlatformContactWidgetSettings      `json:"contactWidget"`
}

type IntegrationRuntimeStatus struct {
	Configured bool   `json:"configured"`
	Detail     string `json:"detail"`
}

type PlatformIntegrationState struct {
	Settings      PlatformIntegrationSettings         `json:"settings"`
	Revision      int                                 `json:"revision"`
	UpdatedAt     time.Time                           `json:"updatedAt"`
	RuntimeStatus map[string]IntegrationRuntimeStatus `json:"runtimeStatus"`
}

type PlatformIntegrationPatch struct {
	Auth             *PlatformAuthSettings              `json:"auth"`
	Providers        map[string]PlatformProviderSetting `json:"providers"`
	SEO              *PlatformSEOSettings               `json:"seo"`
	ContactWidget    *PlatformContactWidgetSettings     `json:"contactWidget"`
	ExpectedRevision int                                `json:"expectedRevision"`
}

func DefaultPlatformIntegrationSettings() PlatformIntegrationSettings {
	return PlatformIntegrationSettings{
		Auth: PlatformAuthSettings{
			AllowSelfRegistration:    true,
			AllowEmailPassword:       true,
			RequireEmailVerification: false,
			RequireAdminApproval:     false,
			DefaultRole:              "student",
			RegistrationTitle:        "انضم إلى مجتمع المئة التعليمي",
			RegistrationSubtitle:     "سجّل حسابك للوصول إلى كافة شروحات وتدريبات قياس",
			TermsLink:                "/terms",
			PrivacyLink:              "/privacy",
			MaxAccountsPerDevice:     3,
		},
		Providers: map[string]PlatformProviderSetting{
			"googleMeet":  {Enabled: true, Mode: "oauth", Note: "مربوط للاجتماعات الفردية والجماعية"},
			"zoom":        {Enabled: false, Mode: "oauth", Note: "غير مفعل"},
			"teams":       {Enabled: false, Mode: "oauth", Note: "غير مفعل"},
			"youtubeLive": {Enabled: false, Mode: "api", Note: "بث الحصص العامة"},
			"googleOAuth": {Enabled: true, Mode: "oauth", Note: "تسجيل الدخول السريع عبر Google"},
			"whatsappOTP": {Enabled: false, Mode: "otp", Note: "التحقق عبر الواتساب"},
		},
		SEO: PlatformSEOSettings{
			SiteName:           "منصة المئة - قدرات & تحصيلي",
			DefaultTitle:       "منصة المئة | المنصة المتكاملة للقدرات والتحصيلي ونافس",
			DefaultDescription: "شروحات تأسيسية وبنك أسئلة ذكي ومحاكاة دقيقة لاختبارات قياس مع المعلم الآلي وتتبع دقيق للمهارات.",
			CanonicalBaseUrl:   "https://almeaa.com",
			GoogleAnalyticsId:  "",
			GoogleTagManagerId: "",
			RobotsIndexing:     true,
		},
		ContactWidget: PlatformContactWidgetSettings{
			Enabled:              true,
			Channel:              "whatsapp",
			WhatsAppNumber:       "+966500000000",
			WhatsAppMessage:      "مرحبا، أرغب في الاستفسار عن منصة المعا",
			OpenInNewTab:         true,
			ShowOnPublicPages:    true,
			ShowOnDashboardPages: true,
		},
	}
}

type BackupExportRecord struct {
	ID             string         `json:"id"`
	Title          string         `json:"title"`
	Scope          string         `json:"scope"`
	SchemaVersion  int            `json:"schemaVersion"`
	Summary        map[string]int `json:"summary"`
	TotalRecords   int            `json:"totalRecords"`
	CreatedBy      string         `json:"createdBy"`
	CreatedByEmail string         `json:"createdByEmail"`
	CreatedAt      time.Time      `json:"createdAt"`
}

type BackupExportPayload struct {
	Kind          string           `json:"kind"`
	SchemaVersion int              `json:"schemaVersion"`
	CreatedAt     time.Time        `json:"createdAt"`
	Summary       map[string]int   `json:"summary"`
	Collections   map[string][]any `json:"collections"`
}

type BackupExportResult struct {
	ExportRecord BackupExportRecord  `json:"exportRecord"`
	Payload      BackupExportPayload `json:"payload"`
}

type BackupValidateInput struct {
	Kind          string           `json:"kind"`
	SchemaVersion int              `json:"schemaVersion"`
	Summary       map[string]int   `json:"summary"`
	Collections   map[string][]any `json:"collections"`
}

type BackupValidateResult struct {
	Valid            bool           `json:"valid"`
	CollectionsCount int            `json:"collectionsCount"`
	TotalRecords     int            `json:"totalRecords"`
	Summary          map[string]int `json:"summary"`
}
