// Package server wires HookLens' HTTP API, webhook ingestion and WebSocket endpoints together.
package server

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/hooklens/hooklens/internal/auth"
	"github.com/hooklens/hooklens/internal/config"
	"github.com/hooklens/hooklens/internal/hub"
	"github.com/hooklens/hooklens/internal/ratelimit"
	"github.com/hooklens/hooklens/internal/store"
)

const sessionCookie = "hl_session"

type Server struct {
	cfg     *config.Config
	store   *store.Store
	hub     *hub.Hub
	bus     *hub.Bus
	limiter *ratelimit.Limiter
	log     *slog.Logger
	mux     *http.ServeMux
}

func New(cfg *config.Config, st *store.Store, log *slog.Logger) *Server {
	s := &Server{cfg: cfg, store: st, hub: hub.New(), bus: hub.NewBus(), limiter: ratelimit.New(), log: log, mux: http.NewServeMux()}
	s.routes()
	return s
}

func (s *Server) routes() {
	m := s.mux
	m.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) { writeJSON(w, 200, map[string]string{"status": "ok"}) })

	// auth
	m.HandleFunc("POST /api/v1/auth/signup", s.handleSignup)
	m.HandleFunc("POST /api/v1/auth/login", s.handleLogin)
	m.HandleFunc("POST /api/v1/auth/logout", s.handleLogout)
	m.HandleFunc("POST /api/v1/auth/logout-all", s.authed(s.handleLogoutAll))

	// account
	m.HandleFunc("GET /api/v1/me", s.authed(s.handleMe))
	m.HandleFunc("PATCH /api/v1/me", s.authed(s.handleUpdateMe))
	m.HandleFunc("DELETE /api/v1/me", s.authed(s.handleDeleteMe))
	m.HandleFunc("GET /api/v1/tokens", s.authed(s.handleListTokens))
	m.HandleFunc("POST /api/v1/tokens", s.authed(s.handleCreateToken))
	m.HandleFunc("DELETE /api/v1/tokens/{id}", s.authed(s.handleDeleteToken))

	// CLI device login
	m.HandleFunc("POST /api/v1/cli/auth/start", s.handleCLIStart)
	m.HandleFunc("POST /api/v1/cli/auth/approve", s.authed(s.handleCLIApprove))
	m.HandleFunc("POST /api/v1/cli/auth/poll", s.handleCLIPoll)

	// endpoints / requests
	m.HandleFunc("GET /api/v1/endpoints", s.authed(s.handleListEndpoints))
	m.HandleFunc("POST /api/v1/endpoints", s.authed(s.handleCreateEndpoint))
	m.HandleFunc("GET /api/v1/endpoints/{id}", s.authed(s.handleGetEndpoint))
	m.HandleFunc("PATCH /api/v1/endpoints/{id}", s.authed(s.handleUpdateEndpoint))
	m.HandleFunc("DELETE /api/v1/endpoints/{id}", s.authed(s.handleDeleteEndpoint))
	m.HandleFunc("GET /api/v1/endpoints/{id}/requests", s.authed(s.handleListRequests))
	m.HandleFunc("GET /api/v1/requests", s.authed(s.handleListRequests))
	m.HandleFunc("GET /api/v1/requests/{id}", s.authed(s.handleGetRequest))
	m.HandleFunc("POST /api/v1/requests/{id}/replay", s.authed(s.handleReplay))
	m.HandleFunc("GET /api/v1/stats", s.authed(s.handleStats))
	m.HandleFunc("GET /api/v1/stats/activity", s.authed(s.handleActivity))
	m.HandleFunc("GET /api/v1/tunnels", s.authed(s.handleTunnels))

	// realtime
	m.HandleFunc("GET /api/v1/ws/dashboard", s.handleDashboardWS)
	m.HandleFunc("GET /api/v1/ws/tunnel", s.handleTunnelWS)

	// public webhook ingestion (any method)
	m.HandleFunc("/hook/{token}", s.handleHook)
	m.HandleFunc("/hook/{token}/{rest...}", s.handleHook)

	// dashboard (static export) for everything else
	m.Handle("/", s.staticHandler())
}

func (s *Server) Handler() http.Handler {
	return s.recoverer(s.securityHeaders(s.cors(s.mux)))
}

// Run starts the HTTP server and background janitors until ctx is cancelled.
func (s *Server) Run(ctx context.Context) error {
	if err := s.store.FailStalePending(ctx); err != nil {
		s.log.Warn("could not fail stale deliveries", "err", err)
	}
	go s.janitor(ctx)
	srv := &http.Server{
		Addr:              s.cfg.Addr,
		Handler:           s.Handler(),
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       30 * time.Second,
		IdleTimeout:       120 * time.Second,
	}
	errCh := make(chan error, 1)
	go func() { errCh <- srv.ListenAndServe() }()
	s.log.Info("HookLens listening", "addr", s.cfg.Addr, "public_url", s.cfg.PublicURL)
	select {
	case <-ctx.Done():
		shutCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		return srv.Shutdown(shutCtx)
	case err := <-errCh:
		return err
	}
}

func (s *Server) janitor(ctx context.Context) {
	t := time.NewTicker(time.Hour)
	defer t.Stop()
	for {
		n, err := s.store.Cleanup(ctx)
		if err != nil {
			s.log.Warn("cleanup failed", "err", err)
		} else if n > 0 {
			s.log.Info("retention cleanup", "requests_deleted", n)
		}
		select {
		case <-ctx.Done():
			return
		case <-t.C:
		}
	}
}

// ---------- middleware ----------

func (s *Server) recoverer(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if rec := recover(); rec != nil {
				s.log.Error("panic", "path", r.URL.Path, "panic", rec)
				writeErr(w, 500, "internal error")
			}
		}()
		next.ServeHTTP(w, r)
	})
}

func (s *Server) securityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		if !strings.HasPrefix(r.URL.Path, "/hook/") {
			w.Header().Set("X-Frame-Options", "DENY")
			w.Header().Set("Referrer-Policy", "same-origin")
		}
		next.ServeHTTP(w, r)
	})
}

// cors only opens the API to the configured dev web origin (credentials included).
func (s *Server) cors(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if s.cfg.WebOrigin != "" && origin == s.cfg.WebOrigin {
			h := w.Header()
			h.Set("Access-Control-Allow-Origin", origin)
			h.Set("Access-Control-Allow-Credentials", "true")
			h.Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
			h.Set("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS")
			h.Add("Vary", "Origin")
			if r.Method == http.MethodOptions {
				w.WriteHeader(http.StatusNoContent)
				return
			}
		}
		next.ServeHTTP(w, r)
	})
}

type authedHandler func(w http.ResponseWriter, r *http.Request, u *store.User)

// authed accepts either the browser session cookie or an `Authorization: Bearer` token (CLI / API key).
func (s *Server) authed(h authedHandler) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		u := s.authenticate(r)
		if u == nil {
			writeErr(w, 401, "authentication required")
			return
		}
		h(w, r, u)
	}
}

func (s *Server) authenticate(r *http.Request) *store.User {
	raw := bearerToken(r)
	if raw == "" {
		if c, err := r.Cookie(sessionCookie); err == nil {
			raw = c.Value
		}
	}
	if raw == "" {
		return nil
	}
	u, err := s.store.UserByToken(r.Context(), auth.HashToken(raw), auth.KindSession, auth.KindCLI, auth.KindAPI)
	if err != nil {
		return nil
	}
	return u
}

func bearerToken(r *http.Request) string {
	h := r.Header.Get("Authorization")
	if len(h) > 7 && strings.EqualFold(h[:7], "bearer ") {
		return strings.TrimSpace(h[7:])
	}
	return ""
}

// ---------- helpers ----------

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeErr(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

func decode(w http.ResponseWriter, r *http.Request, v any) bool {
	r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
	dec := json.NewDecoder(r.Body)
	if err := dec.Decode(v); err != nil {
		writeErr(w, 400, "invalid JSON body")
		return false
	}
	return true
}

func (s *Server) clientIP(r *http.Request) string {
	if s.cfg.TrustProxy {
		if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
			first, _, _ := strings.Cut(xff, ",")
			return strings.TrimSpace(first)
		}
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

func (s *Server) hookURL(token string) string { return s.cfg.PublicURL + "/hook/" + token }

func (s *Server) decorate(e *store.Endpoint) *store.Endpoint {
	e.HookURL = s.hookURL(e.PublicToken)
	e.TunnelConnected = s.hub.Get(e.ID) != nil
	return e
}

func validForwardURL(raw string) bool {
	if raw == "" {
		return true
	}
	u, err := url.Parse(raw)
	return err == nil && (u.Scheme == "http" || u.Scheme == "https") && u.Host != "" && len(raw) <= 300
}

var errNotFound = errors.New("not found")
