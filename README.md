# HookLens

Inspect, forward and replay webhooks on localhost.

**Live:** https://hooklens-app.onrender.com (free during beta) · **CLI downloads:** [latest release](https://github.com/Athiran-dev/HookLens/releases/latest)

HookLens gives your local server a public webhook URL. Every request is captured and stored, shown live in a dashboard, and forwarded to `localhost` through a small CLI. If your app was down, the request is still saved and you can replay it later without triggering the event again.

- **Web dashboard** (Next.js, static export): create endpoints, watch requests arrive live, inspect headers, raw payload and responses, replay events.
- **Go CLI** (`hooklens`): `hooklens listen 3000` forwards webhooks to your local server.
- **Go backend** (`net/http`, PostgreSQL, WebSockets): one binary serves the API, webhook ingestion, the CLI tunnel and the dashboard.

```
provider --POST /hook/<token>--> HookLens API --(stored in Postgres, 200 returned immediately)
                                     |
                                     +--WebSocket (outbound from your laptop)--> hooklens CLI --HTTP--> localhost:3000
                                     +--WebSocket--> your browser dashboard (live updates)
```

Design rules baked in: capture and forwarding are independent (an offline CLI never loses a request); every forward has a delivery ID so concurrent responses match their requests; the tunnel has a heartbeat, per-request timeout, bounded queue and cleanup on disconnect; raw bodies are stored as `BYTEA` and forwarded byte for byte, so your own signature checks keep working.

## Quick start (hosted)

1. Sign up at https://hooklens-app.onrender.com and create an endpoint.
2. [Install the CLI](#install-the-cli) and run `hooklens login` (your browser opens to approve it).
3. Start your app, then run `hooklens listen 3000`.
4. Paste the endpoint's public URL into your provider's webhook settings, or press **Send test webhook** in the dashboard.

The hosted service runs on a free plan that sleeps when idle. The first request after a quiet period can take up to a minute while it wakes up.

## Install the CLI

Download the file for your system from the [latest release](https://github.com/Athiran-dev/HookLens/releases/latest)
(`hooklens-windows-amd64.exe`, `hooklens-darwin-arm64`, `hooklens-darwin-amd64`, `hooklens-linux-amd64`, `hooklens-linux-arm64`),
rename it to `hooklens` (`hooklens.exe` on Windows) and put it on your PATH. A `checksums.txt` is published with each release.
Or, with Go installed:

```
go install github.com/Athiran-dev/HookLens/cmd/hooklens@latest
```

Then `hooklens login` and `hooklens listen 3000`. Release binaries talk to the hosted service by default; use
`--server` (or `HOOKLENS_SERVER`) to point the CLI at your own deployment, for example `http://localhost:8080`.
Releases are unsigned, so Windows SmartScreen may warn on first run ("More info", then "Run anyway").

```
hooklens login [--server URL] [--token KEY]   authenticate (browser flow, or an API key)
hooklens logout                               remove local credentials
hooklens listen <port|url> [--endpoint NAME]  forward webhooks to localhost
hooklens endpoints [create NAME]              list or create endpoints
hooklens requests [--endpoint NAME] [-n 20]   recent requests with results
hooklens replay <request-id>                  re-send a stored request through your tunnel
hooklens status                               connection status
hooklens version
```

## Run it yourself

Prerequisites: Go 1.26+, Node 20+, PostgreSQL (or Docker).

```powershell
# 1. one-time DB + .env setup (asks for your Postgres superuser password in the terminal)
powershell -ExecutionPolicy Bypass -File scripts\setup-db.ps1

# 2. dashboard (static export served by the Go server)
cd web; npm install; npm run build; cd ..

# 3. server  ->  http://localhost:8080
go run ./cmd/api

# 4. CLI
go run ./cmd/hooklens login --server http://localhost:8080
go run ./cmd/hooklens listen 3000
```

No Postgres installed? `docker compose up --build` runs the whole stack.

Frontend hot reload: run `npm run dev` in `web/` (port 3000) with `WEB_ORIGIN=http://localhost:3000` in `.env`.

Tests: `go test ./...` (the end-to-end test needs `TEST_DATABASE_URL`, written to `.env` by the setup script).

To receive real webhooks into a local HookLens, a provider needs a public URL to your HookLens server. For development use a free tunnel such as `cloudflared tunnel --url http://localhost:8080` and set `PUBLIC_URL` to the printed `https://*.trycloudflare.com` address.

### Configuration

Copy `.env.example` to `.env`. All values are optional except `DATABASE_URL`.

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | none (required) | PostgreSQL connection string |
| `ADDR` / `PORT` | `:8080` | listen address (`ADDR` wins, then `PORT`, which most hosts inject) |
| `PUBLIC_URL` | `http://localhost:8080` | base URL used to build the webhook URLs shown to users (defaults to `RENDER_EXTERNAL_URL` on Render) |
| `WEB_ORIGIN` | empty | origin of `next dev`, for local frontend work only |
| `STATIC_DIR` | `web/out` | folder of the exported dashboard |
| `MAX_BODY_BYTES` | `1048576` | largest accepted payload |
| `RETENTION_DAYS` | `7` | default retention (users can choose 1 to 30 in Settings) |
| `MAX_ENDPOINTS_PER_USER` | `10` | endpoints per account |
| `MAX_TUNNELS_PER_USER` | `5` | simultaneous tunnels per account |
| `FORWARD_TIMEOUT_SECONDS` | `30` | wait for your local server's response |
| `TRUST_PROXY` | `false` | set `true` behind a proxy or PaaS to trust `X-Forwarded-For` |
| `SECURE_COOKIES` | `false` | set `true` when served over HTTPS |
| `ALLOW_SIGNUP` | `true` | allow new accounts |
| `ADMIN_EMAILS` | empty | comma-separated emails allowed to read feedback at `/admin/` |

## Deploy for free

The hosted service runs on **Render** (free web service, Docker) with **Neon** (free PostgreSQL). Both work without a card or a custom domain.

1. Create a Neon project and copy the **direct** (not pooled) connection string.
2. In Render choose **New > Blueprint**, pick this repository (it reads [`render.yaml`](render.yaml)) and paste `DATABASE_URL` and `ADMIN_EMAILS` when asked. The region is Singapore to sit next to the database; change both together if you move.
3. In the service settings make sure **Health Check Path** is `/healthz`.
4. Publish CLI binaries by pushing a tag (for example `v0.1.0`). The `release-cli` workflow builds five binaries; they default to `https://hooklens-app.onrender.com` unless you set the `HOOKLENS_SERVER` repository variable.

Any host that gives you an HTTPS URL and runs a Docker image will also work. Set `DATABASE_URL`, `PUBLIC_URL`, `TRUST_PROXY=true` and `SECURE_COOKIES=true`.

Free plans sleep after a period of inactivity, so the first request after a quiet spell is slow. Render's free plan sleeps after 15 minutes idle and wakes in about a minute.

## Troubleshooting

| Symptom | What to check |
|---|---|
| `Connection refused: nothing is listening on localhost:3000` | Your app is not running on that port. Start it, or pass the right port to `hooklens listen`. The request is saved; replay it from the dashboard. |
| Requests show **Not forwarded** | No CLI is connected for that endpoint. Run `hooklens listen`, and check the Tunnels page. |
| First request is very slow | The free host was asleep. Retry, or resend from your provider's dashboard. |
| `invalid email or password` | Check the email and password, and make sure you have signed up on this server. There is no password reset yet. |
| Signature check fails locally | HookLens forwards the exact bytes. Verify against the raw body, before any JSON parsing, with the secret for that provider. |
| Windows SmartScreen warns about the CLI | Releases are unsigned. Choose **More info**, then **Run anyway**. |

## Not built yet

Email password reset, email verification, GitHub sign-in, teams, billing, a Redis-backed durable dispatch queue, provider signature verification, and Privacy and Terms pages. Dispatch is an in-memory bounded queue; a server restart marks in-flight deliveries failed (the request itself is always stored and replayable).

## Feedback and contributing

Open an [issue](https://github.com/Athiran-dev/HookLens/issues) for bugs and ideas, or use **Send feedback** inside the dashboard. Pull requests are welcome; please run `go test ./...` and `npm run typecheck` in `web/` first.

## License

[MIT](LICENSE)
