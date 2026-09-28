.PHONY: all build build-frontend build-backend test test-backend test-frontend docker-build docker-up docker-down docker-logs lint vuln clean

all: test build

build: build-frontend build-backend

build-frontend:
	cd frontend && npm ci && npm run build

build-backend:
	go build -ldflags="-s -w" -o bin/icsexplorer ./cmd/server

test: test-backend test-frontend

test-backend:
	go test -v -race ./internal/...

test-frontend:
	cd frontend && npm test

docker-build:
	docker compose build

docker-up:
	docker compose up -d

docker-down:
	docker compose down

docker-logs:
	docker compose logs -f

lint:
	golangci-lint run ./...
	cd frontend && npm run lint

vuln:
	go run golang.org/x/vuln/cmd/govulncheck@latest ./...
	cd frontend && npm audit --omit=dev --audit-level=high

clean:
	rm -rf bin/ frontend/dist data/output/*.tmp
