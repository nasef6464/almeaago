.PHONY: fmt test vet api worker infra-up infra-down migrate-up migrate-down sqlc web-install web-dev web-build check

fmt:
	gofmt -w ./cmd ./internal
test:
	go test ./...
vet:
	go vet ./...
api:
	go run ./cmd/api
worker:
	go run ./cmd/worker
infra-up:
	docker compose up -d
infra-down:
	docker compose down
migrate-up:
	go run ./cmd/migrate up
migrate-down:
	go run ./cmd/migrate down
sqlc:
	sqlc generate
web-install:
	cd apps/web && npm install
web-dev:
	cd apps/web && npm run dev
web-build:
	cd apps/web && npm run build
check:
	test -z "$$(gofmt -l ./cmd ./internal)"
	go vet ./...
	go test ./...
	cd apps/web && npm run typecheck && npm run build
