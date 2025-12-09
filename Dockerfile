# === Build Stage ===
FROM ubuntu:22.04 AS build

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl git wget build-essential clang llvm pkg-config \
    bash sed unzip tzdata gcc libc6-dev make golang-go \
    && rm -rf /var/lib/apt/lists/*

# TinyGo
RUN curl -sSfL https://tinygo.org/get.sh | sh

WORKDIR /app
COPY server/ ./server/
COPY web/ ./web/

WORKDIR /app/server
RUN go mod tidy
RUN CGO_ENABLED=0 GOOS=linux go build -o /app/server_bin server.go

# === Runtime Stage ===
FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl clang llvm \
    && rm -rf /var/lib/apt/lists/*

# TinyGo
RUN curl -sSfL https://tinygo.org/get.sh | sh

WORKDIR /app
COPY --from=build /app/server_bin /app/server_bin
COPY --from=build /app/web /app/web

ENV PORT=8080
EXPOSE 8080
CMD ["/app/server_bin"]