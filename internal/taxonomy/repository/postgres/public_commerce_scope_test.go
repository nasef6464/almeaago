package postgres

import (
	"context"
	"testing"
)

func TestPublicCommerceScopeRejectsUnscopedCatalogWithoutDatabase(t *testing.T) {
	ok, err := (&Repository{}).PublicCommerceScopeVisible(context.Background(), "", "")
	if err != nil || ok {
		t.Fatalf("unscoped public catalog accepted: %v %v", ok, err)
	}
}
