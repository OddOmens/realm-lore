# syntax=docker/dockerfile:1

# The web UI and the Go binary are built on the build machine's own platform
# and cross-compiled, so multi-arch images don't run compilers under emulation.

# 1. Web UI
FROM --platform=$BUILDPLATFORM node:22-alpine AS web
WORKDIR /web
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

# 2. Server (static binary, web UI embedded)
FROM --platform=$BUILDPLATFORM golang:1.27-alpine AS build
WORKDIR /src
COPY backend/go.mod backend/go.sum ./
RUN go mod download
COPY backend/ ./
COPY --from=web /web/dist ./internal/webui/dist
ARG VERSION=dev
ARG TARGETOS TARGETARCH
RUN CGO_ENABLED=0 go test ./... && \
    CGO_ENABLED=0 GOOS=$TARGETOS GOARCH=$TARGETARCH \
      go build -trimpath -ldflags="-s -w -X main.version=${VERSION}" -o /out/realmlore ./cmd/realmlore

# 3. Runtime: no shell, no package manager, non-root by default
FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /out/realmlore /realmlore
ENV REALMLORE_DATA_DIR=/data \
    REALMLORE_ADDR=:8080
EXPOSE 8080
VOLUME /data
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s CMD ["/realmlore", "healthcheck"]
ENTRYPOINT ["/realmlore"]
CMD ["serve"]
