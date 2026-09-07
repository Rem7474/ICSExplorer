# ==========================================
# Stage 1: Build Frontend (Vue 3 + Vite)
# ==========================================
FROM node:22-alpine AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install

COPY frontend/ ./
RUN npm run build

# ==========================================
# Stage 2: Build Backend (Go 1.24 static)
# ==========================================
FROM golang:alpine AS backend-builder
WORKDIR /app

RUN apk add --no-cache git

COPY go.mod go.sum ./
RUN go mod download

COPY cmd/ ./cmd/
COPY internal/ ./internal/

RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /app/icsexplorer ./cmd/server

# ==========================================
# Stage 3: Minimal Production Image (~20MB)
# ==========================================
FROM alpine:3.21

RUN apk add --no-cache ca-certificates tzdata su-exec \
    && addgroup -g 10001 -S appgroup \
    && adduser -u 10001 -S appuser -G appgroup

WORKDIR /app

# Copy binary, entrypoint and frontend assets
COPY --from=backend-builder /app/icsexplorer /usr/local/bin/icsexplorer
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# Copy seed data if present, or create default directories
COPY .gitattributes data* /tmp/seed/
RUN mkdir -p /app/seed-data /app/data/output /app/data/rooms \
    && if [ -d /tmp/seed/data ]; then cp /tmp/seed/data/*.txt /app/seed-data/ 2>/dev/null || true; cp /tmp/seed/data/*.txt /app/data/ 2>/dev/null || true; fi \
    && rm -rf /tmp/seed \
    && chown -R appuser:appgroup /app/data /app/seed-data

ENV PORT=8080 \
    DATA_DIR=/app/data \
    OUTPUT_DIR=/app/data/output \
    ROOMS_OUTPUT_DIR=/app/data/rooms \
    STATIC_DIR=/app/frontend/dist \
    LOG_FORMAT=json

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/api/health || exit 1

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["/usr/local/bin/icsexplorer"]
