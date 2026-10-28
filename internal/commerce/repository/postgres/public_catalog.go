package postgres

import (
	"context"
	commerce "github.com/nasef6464/almeaago/internal/commerce/domain"
)

func (r *Repository) ListPublicCatalog(ctx context.Context, page, limit int, pathID string) (commerce.PublicCatalogPage, error) {
	rows, err := r.db.Query(ctx, `SELECT p.id::text,p.product_type,p.name,p.description,p.price_minor,p.currency,
 COALESCE(pk.package_kind='membership' AND EXISTS(SELECT 1 FROM commerce_package_items i WHERE i.package_id=pk.id) AND NOT EXISTS(SELECT 1 FROM commerce_package_items i WHERE i.package_id=pk.id AND i.scope_type NOT IN ('all','content_type')),false)
 FROM commerce_products p LEFT JOIN commerce_packages pk ON pk.product_id=p.id
 WHERE p.status='active' AND p.is_visible=true AND p.access_mode='paid' AND p.price_minor>0 AND (pk.package_kind IS NULL OR pk.package_kind<>'school')
 AND ($3='' OR EXISTS(SELECT 1 FROM courses c WHERE c.id=p.course_id AND c.path_id::text=$3)
  OR EXISTS(SELECT 1 FROM commerce_package_items i
    LEFT JOIN subjects s ON i.scope_type='subject' AND s.id=i.subject_id
    LEFT JOIN courses c ON i.scope_type='course' AND c.id=i.course_id
    WHERE i.package_id=pk.id AND ((i.scope_type='path' AND i.path_id::text=$3) OR (i.scope_type='subject' AND s.path_id::text=$3) OR (i.scope_type='course' AND c.path_id::text=$3))))
 ORDER BY p.price_minor,p.id LIMIT $1 OFFSET $2`, limit+1, (page-1)*limit, pathID)
	if err != nil {
		return commerce.PublicCatalogPage{}, err
	}
	defer rows.Close()
	out := commerce.PublicCatalogPage{Items: []commerce.PublicProduct{}, Page: page, Limit: limit}
	for rows.Next() {
		var p commerce.PublicProduct
		if err = rows.Scan(&p.ID, &p.ProductType, &p.Name, &p.Description, &p.PriceMinor, &p.Currency, &p.PublicMembership); err != nil {
			return out, err
		}
		out.Items = append(out.Items, p)
	}
	if err = rows.Err(); err != nil {
		return out, err
	}
	if len(out.Items) > limit {
		out.HasMore = true
		out.Items = out.Items[:limit]
	}
	return out, nil
}
