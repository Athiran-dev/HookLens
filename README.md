# HookLens

Webhook inspection, replay and local tunneling for developers.

- **Web dashboard** (Next.js, static export): create endpoints, watch requests arrive live, inspect headers / raw payload / responses, replay events.
- **Go CLI** (`hooklens`): `hooklens listen 3000` gives your local server a public webhook URL.
- **Go backend** (`net/http`, PostgreSQL, WebSockets): one binary serves the API, webhook ingestion, the CLI tunnel and the dashboard.

```
provider --POST /hook/<token>--> HookLens API --(stored in Postgres, 200 returned immediately)
                                     |
                                     +--WebSocket (outbound from your laptop)--> hooklens CLI --HTTP--> localhost:3000
                                     +--WebSocket--> your browser dashboard (live updates)
```

Design rules baked in: capture and forwarding are independent (offline CLI never loses a request); every forward has a delivery ID so concurrent responses match their requests; the tunnel has heartbeat, per-request timeout, bounded queue and cleanup on disconnect; raw bodies are stored as `BYTEA` and forwarded byte-for-byte.

## Run locally

Prereqs: Go 1.22+, Node 20+, PostgreSQL.

```powershell
# 1. one-time DB + .env setup (asks for your Postgres superuser password in the terminal)
powershell -ExecutionPolicy Bypass -File scripts\setup-db.ps1

# 2. dashboard (static export served by the Go server)
cd web; npm install; npm run build; cd ..

# 3. server  ->  http://localhost:8080
go run ./cmd/api

# 4. CLI
go run ./cmd/hooklens login
go run ./cmd/hooklens listen 3000
```

Frontend hot-reload: run `npm run dev` in `web/` (port 3000) with `WEB_ORIGIN=http://localhost:3000` in `.env`.

No Postgres installed? `docker compose up --build` runs the whole stack.

Tests: `go test ./...` (the end-to-end test needs `TEST_DATABASE_URL`, written to `.env` by the setup script).

## Get real webhooks into a local HookLens

Providers need a public URL to *your HookLens server*. For development use a free tunnel such as `cloudflared tunnel --url http://localhost:8080` and set `PUBLIC_URL` to the printed `https://*.trycloudflare.com` address. For real users, deploy (below).

## Deploy for free (no custom domain required)

The app is a single Docker image + Postgres. Any host that gives you an HTTPS URL works (Fly.io, Render, Railway). Set:

| Variable | Value |
|---|---|
| `DATABASE_URL` | your Postgres URL (managed free tier, e.g. Neon/Supabase/Fly Postgres) |
| `PUBLIC_URL` | the host's HTTPS URL, e.g. `https://hooklens.fly.dev` |
| `TRUST_PROXY` | `true` (use the platform's `X-Forwarded-For`) |
| `SECURE_COOKIES` | `true` |

Then publish CLI binaries with the `release-cli` GitHub workflow (tag `v0.1.0`; set the repo variable `HOOKLENS_SERVER` to your `PUBLIC_URL` so downloaded binaries log in to your server by default).

## Scope / not built yet

Email password reset and GitHub sign-in (need an email provider / OAuth app), teams, billing, Redis-backed durable dispatch queue, provider signature verification. Dispatch is an in-memory bounded queue; a server restart marks in-flight deliveries failed (the request itself is always stored and replayable).

## Install the CLI

Download the file for your system from the [latest release](https://github.com/Athiran-dev/HookLens/releases/latest)
(`hooklens-windows-amd64.exe`, `hooklens-darwin-arm64`, `hooklens-linux-amd64`, ...), rename it to `hooklens`
(`hooklens.exe` on Windows) and put it on your PATH. Or, with Go installed:

```
go install github.com/Athiran-dev/HookLens/cmd/hooklens@latest
```

Then `hooklens login` and `hooklens listen 3000`. Release binaries talk to the hosted service by default; use
`--server` (or `HOOKLENS_SERVER`) to point the CLI at your own deployment, for example `http://localhost:8080`.
Releases are unsigned, so Windows SmartScreen may warn on first run ("More info", then "Run anyway").
