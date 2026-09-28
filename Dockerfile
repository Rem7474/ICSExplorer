# syntax=docker/dockerfile:1

# ==========================================
# Stage 1: Build Frontend (Vue 3 + Vite)
# ==========================================
# Built once on the native build platform: the output is platform-independent,
# so there is no need to run npm under QEMU for every target architecture.
FROM --platform=$BUILDPLATFORM node:26-alpine AS frontend-builder
WORKDIR /app/frontend

ARG VERSION=dev
ENV VITE_APP_VERSION=${VERSION}

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY frontend/ ./
RUN npm run build

# ==========================================
# Stage 2: Build Backend (Go, static, cross-compiled)
# ==========================================
FROM --platform=$BUILDPLATFORM golang:1.27-alpine AS backend-builder
WORKDIR /app

ARG VERSION=dev
ARG BUILD_TIME=dev
ARG TARGETOS
ARG TARGETARCH

COPY go.mod go.sum ./
RUN go mod download

COPY cmd/ ./cmd/
COPY internal/ ./internal/

RUN CGO_ENABLED=0 GOOS=${TARGETOS} GOARCH=${TARGETARCH} go build -trimpath \
    -ldflags="-s -w -X main.version=${VERSION} -X main.buildTime=${BUILD_TIME}" \
    -o /app/icsexplorer ./cmd/server

# ==========================================
# Stage 3: Minimal Production Image
# ==========================================
FROM alpine:3.24

RUN apk add --no-cache ca-certificates tzdata su-exec \
    && addgroup -g 10001 -S appgroup \
    && adduser -u 10001 -S appuser -G appgroup

WORKDIR /app

# Copy binary, entrypoint and frontend assets
COPY --from=backend-builder /app/icsexplorer /usr/local/bin/icsexplorer
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# Create data directories with appropriate permissions
RUN mkdir -p /app/data/output /app/data/rooms \
    && chown -R appuser:appgroup /app/data

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
