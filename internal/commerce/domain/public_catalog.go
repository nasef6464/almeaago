package domain

// PublicProduct is a storefront projection. Package grants, internal codes,
// revisions, entitlements and operational metadata never leave this boundary.
type PublicProduct struct {
	ContentTypes     []ContentType `json:"contentTypes,omitempty"`
	ID               string        `json:"id"`
	ProductType      ProductType   `json:"productType"`
	Name             string        `json:"name"`
	Description      string        `json:"description"`
	PriceMinor       int64         `json:"priceMinor"`
	Currency         string        `json:"currency"`
	PublicMembership bool          `json:"publicMembership"`
}
type PublicCatalogPage struct {
	Items   []PublicProduct `json:"items"`
	Page    int             `json:"page"`
	Limit   int             `json:"limit"`
	HasMore bool            `json:"hasMore"`
}
