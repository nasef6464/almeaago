package domain

import "time"

type Preferences struct {
	UserID                      string    `json:"userId"`
	ParentWhatsAppDigestEnabled bool      `json:"parentWhatsAppDigestEnabled"`
	Revision                    int       `json:"revision"`
	UpdatedAt                   time.Time `json:"updatedAt"`
}

type PreferencesWrite struct {
	ParentWhatsAppDigestEnabled bool `json:"parentWhatsAppDigestEnabled"`
	ExpectedRevision            int  `json:"expectedRevision"`
}
