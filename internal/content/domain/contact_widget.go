package domain

type PublicContactWidgetSettings struct {
	Enabled              bool   `json:"enabled"`
	Channel              string `json:"channel"`
	WhatsAppNumber       string `json:"whatsappNumber"`
	WhatsAppMessage      string `json:"whatsappMessage"`
	OpenInNewTab         bool   `json:"openInNewTab"`
	ShowOnPublicPages    bool   `json:"showOnPublicPages"`
	ShowOnDashboardPages bool   `json:"showOnDashboardPages"`
}

func DefaultContactWidgetSettings() PublicContactWidgetSettings {
	return PublicContactWidgetSettings{
		Enabled:              true,
		Channel:              "whatsapp",
		WhatsAppNumber:       "+966500000000",
		WhatsAppMessage:      "مرحبا، أرغب في الاستفسار عن منصة المعا",
		OpenInNewTab:         true,
		ShowOnPublicPages:    true,
		ShowOnDashboardPages: true,
	}
}
