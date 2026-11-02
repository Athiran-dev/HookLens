package server

import (
	"net/http"
	"strconv"

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
