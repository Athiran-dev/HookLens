# --- dashboard (static export) ---
FROM node:22-alpine AS web
WORKDIR /web
COPY web/package*.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

# --- Go server ---
FROM golang:1.26-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -ldflags "-s -w" -o /out/hooklens-api ./cmd/api

FROM alpine:3.20
RUN adduser -D -u 10001 app && apk add --no-cache ca-certificates
WORKDIR /app
COPY --from=build /out/hooklens-api /app/hooklens-api
COPY --from=web /web/out /app/web/out
ENV STATIC_DIR=/app/web/out ADDR=:8080
USER app
EXPOSE 8080
CMD ["/app/hooklens-api"]
