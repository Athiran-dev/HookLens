package server

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/hooklens/hooklens/internal/auth"
	"github.com/hooklens/hooklens/internal/store"
)

func (s *Server) handleStats(w http.ResponseWriter, r *http.Request, u *store.User) {
	st, err := s.store.Stats(r.Context(), u.ID)
	if err != nil {
		writeErr(w, 500, "could not load stats")
		return
	}
	win, err := s.store.WindowStats(r.Context(), u.ID)
	if err != nil {
		writeErr(w, 500, "could not load stats")
		return
	}
	writeJSON(w, 200, map[string]any{"stats": st, "window": win, "active_tunnels": len(s.hub.ListForUser(u.ID))})
}

func (s *Server) handleActivity(w http.ResponseWriter, r *http.Request, u *store.User) {
	pts, err := s.store.Activity(r.Context(), u.ID, r.URL.Query().Get("range"))
	if err != nil {
		s.log.Error("activity", "err", err)
		writeErr(w, 500, "could not load activity")
		return
	}
	writeJSON(w, 200, pts)
}

func (s *Server) handleDeliveries(w http.ResponseWriter, r *http.Request, u *store.User) {
	q := r.URL.Query()
	kind := q.Get("kind")
	if kind != "" && kind != "forward" && kind != "replay" {
		writeErr(w, 400, "kind must be forward or replay")
		return
	}
	limit, _ := strconv.Atoi(q.Get("limit"))
	rows, err := s.store.ListDeliveries(r.Context(), u.ID, kind, limit)
	if err != nil {
		s.log.Error("deliveries", "err", err)
		writeErr(w, 500, "could not load deliveries")
		return
	}
	writeJSON(w, 200, rows)
}

// handleDisconnectTunnel lets a user cut their own tunnel from the dashboard.
func (s *Server) handleDisconnectTunnel(w http.ResponseWriter, r *http.Request, u *store.User) {
	ep, err := s.store.EndpointForUser(r.Context(), u.ID, r.PathValue("endpoint_id"))
	if err != nil {
		writeErr(w, 404, "endpoint not found")
		return
	}
	t := s.hub.Get(ep.ID)
	if t == nil {
		writeErr(w, 404, "no tunnel is connected for this endpoint")
		return
	}
	t.Kick()
	writeJSON(w, 200, map[string]bool{"ok": true})
}

// handleSendTest captures a sample webhook on the user's own endpoint so they can try the product
// (inspect, forward, replay) without needing curl or a real provider.
func (s *Server) handleSendTest(w http.ResponseWriter, r *http.Request, u *store.User) {
	if !s.limiter.Allow("test:"+u.ID, 20.0/60, 10) {
		writeErr(w, 429, "sending test webhooks too fast, wait a moment")
		return
	}
	ep, err := s.store.EndpointForUser(r.Context(), u.ID, r.PathValue("id"))
	if err != nil {
		writeErr(w, 404, "endpoint not found")
		return
	}
	if ep.Status != "active" {
		writeErr(w, 409, "this endpoint is disabled; enable it first")
		return
	}
	body, _ := json.MarshalIndent(map[string]any{
		"event":   "payment.captured",
		"id":      "evt_" + auth.NewPublicToken()[:12],
		"created": time.Now().Unix(),
		"payment": map[string]any{"id": "pay_" + auth.NewPublicToken()[:10], "amount": 50000, "currency": "INR", "status": "captured"},
		"note":    "Sample webhook sent from the HookLens dashboard",
	}, "", "  ")
	req := &store.Request{
		EndpointID: ep.ID, Method: "POST", Path: "/test",
		Headers: map[string][]string{
			"Content-Type":    {"application/json"},
			"User-Agent":      {"HookLens-Dashboard/1.0"},
			"X-HookLens-Test": {"true"},
			"Host":            {r.Host},
		},
		Body: body, ContentType: "application/json", SourceIP: "HookLens dashboard", Size: len(body),
	}
	if err := s.ingest(r.Context(), ep, u.ID, req); err != nil {
		s.log.Error("send test", "err", err)
		writeErr(w, 500, "could not send test webhook")
		return
	}
	writeJSON(w, 201, map[string]string{"id": req.ID})
}
