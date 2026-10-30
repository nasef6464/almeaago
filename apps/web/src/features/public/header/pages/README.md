# Original header destinations

Exports `MockExamsPage` and `BlogPage`; both require StudentNavigationProvider.
Original source presentation is reused from pinned ALMEAA pages/MockExams.tsx,
pages/Blog.tsx, components/ui/Card.tsx, components/ArticleReaderModal.tsx,
data/defaultArticles.ts and educationalIcons.ts. Static article bodies are the
source's explicit empty-catalog fallback, never substitutes for a failed request.

Mock page reads `/api/v1/public/mock-exams` summaries. Blog reads all explicit
pages from `/api/v1/public/articles?page=N&limit=100`, whose Content-owned guards
exclude hidden/locked/paid bodies. Dynamic article descriptions are metadata only;
the source `description || content` body-derived fallback is deliberately absent.
Dynamic actions retain original category subject/tab or courses routes.

Loading/error/retry use real transport state. Article search/filter, source
static reader/share/Escape/close, source path ordering, count details and original
links/classes are retained. Blog uses unscoped catalog as the source Blog does;
MockExams applies the source student scoped content projection.

Known dependent evidence: category/cart/course/start routes and runtime screenshot
parity remain separate. Source static article track IDs (`qudrat`, `tahsili`) need
canonical category alias resolution by the destination. Taxonomy currently has no
path icon/iconUrl persistence; the source resolver renders any actual supplied
values and retains source name-based icons otherwise. No metadata response grants
assessment start or learning content access.

`PathMockExamsPage({pathId})` is the category mock-tab destination. It reuses the
original GenericPathPage mock selector header/cards and LearningCatalogCounters,
with exact-path/scoped public metadata, genuine loading/error/empty states, and
canonical `MockSummary.id` as assessment identity. Student start delegates to the
existing attemptClient/Go AttemptService, keeping CSRF and idempotency; account or
path changes prevent late starts/navigation. Guests use the existing same-route
`auth=login` modal so path/tab context is retained. Other roles browse only.

This remains PARTIAL: public metadata has no section names, completion evidence,
free/paid price/eligibility, display priority or hub personal analytics. Those
source controls/badges are omitted instead of fabricated. Start is authorized by
the current Go service; denied/failed starts show its real error. The destination
carries source returnTo/source query context into the existing attempt route, but
AssessmentAttemptPage does not yet consume it for completion navigation. Existing
results/history flows remain the assessment owner's responsibility.
