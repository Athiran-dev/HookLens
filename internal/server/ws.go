package server

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"net/http"
	"net/url"
	"time"

	"github.com/Athiran-dev/HookLens/internal/hub"
	"github.com/Athiran-dev/HookLens/internal/proto"
	"github.com/coder/websocket"
	"github.com/coder/websocket/wsjson"
)

// Close code sent to a CLI whose tunnel was taken over by a newer connection to the same endpoint.
const (
	closeReplaced websocket.StatusCode = 4001
	closeKicked   websocket.StatusCode = 4002
)

func (s *Server) wsOrigins() []string {
	if s.cfg.WebOrigin == "" {
		return nil
	}
	if u, err := url.Parse(s.cfg.WebOrigin); err == nil {
		return []string{u.Host}
	}
	return nil
}

// handleDashboardWS streams live events (new requests, delivery results, tunnel up/down) to a logged-in browser.
func (s *Server) handleDashboardWS(w http.ResponseWriter, r *http.Request) {
	u := s.authenticate(r)
	if u == nil {
		writeErr(w, 401, "authentication required")
		return
	}
	c, err := websocket.Accept(w, r, &websocket.AcceptOptions{OriginPatterns: s.wsOrigins()})
	if err != nil {
		return
	}
	defer c.CloseNow()
	ctx := c.CloseRead(context.Background()) // we never read from browsers; this notices when they leave

	events, cancel := s.bus.Subscribe(u.ID)
	defer cancel()
	ping := time.NewTicker(25 * time.Second)
	defer ping.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case data := <-events:
			wctx, wcancel := context.WithTimeout(ctx, 10*time.Second)
			err := c.Write(wctx, websocket.MessageText, data)
			wcancel()
			if err != nil {
				return
			}
		case <-ping.C:
			pctx, pcancel := context.WithTimeout(ctx, 10*time.Second)
			err := c.Ping(pctx)
			pcancel()
			if err != nil {
				return
			}
		}
	}
}

// handleTunnelWS is the CLI's persistent outbound connection. The CLI authenticates with a bearer token
// and names the endpoint it serves; one tunnel per endpoint, newest connection wins.
func (s *Server) handleTunnelWS(w http.ResponseWriter, r *http.Request) {
	u := s.authenticate(r)
	if u == nil {
		writeErr(w, 401, "authentication required (run `hooklens login`)")
		return
	}
	q := r.URL.Query()
	ep, err := s.store.EndpointForUser(r.Context(), u.ID, q.Get("endpoint_id"))
	if err != nil {
		writeErr(w, 404, "endpoint not found")
		return
	}
	if ep.Status != "active" {
		writeErr(w, 403, "endpoint is disabled")
		return
	}
	if s.hub.Get(ep.ID) == nil && s.hub.CountForUser(u.ID) >= s.cfg.MaxTunnelsPerUser {
		writeErr(w, 429, "too many active tunnels for your account")
		return
	}

	c, err := websocket.Accept(w, r, nil) // CLI sends no Origin header; browsers are rejected by default
	if err != nil {
		return
	}
	c.SetReadLimit(8 << 20)

	idb := make([]byte, 8)
	_, _ = rand.Read(idb)
	t := hub.NewTunnel(hex.EncodeToString(idb), ep.ID, u.ID, 64)
	t.Target = q.Get("target")
	if len(t.Target) > 200 {
		t.Target = t.Target[:200]
	}
	if old := s.hub.Register(t); old != nil {
		old.Close()
	}
	s.bus.Publish(u.ID, map[string]any{"type": "tunnel", "endpoint_id": ep.ID, "connected": true})
	s.log.Info("event", "name", "tunnel_connected", "user", u.ID, "endpoint", ep.ID)

	ctx, cancel := context.WithCancel(context.Background())
	defer func() {
		cancel()
		t.Close()
		if s.hub.Unregister(t) { // false when a newer connection already replaced this one
			s.bus.Publish(u.ID, map[string]any{"type": "tunnel", "endpoint_id": ep.ID, "connected": false})
		}
		_ = c.Close(websocket.StatusNormalClosure, "bye")
		s.log.Info("event", "name", "tunnel_disconnected", "user", u.ID, "endpoint", ep.ID)
	}()

	ready := proto.Message{Type: proto.TypeReady, TunnelID: t.ID, EndpointID: ep.ID, EndpointName: ep.Name, PublicURL: s.hookURL(ep.PublicToken)}
	if err := wsjson.Write(ctx, c, ready); err != nil {
		return
	}

	// writer: queued requests + heartbeat pings
	go func() {
		defer cancel()
		ping := time.NewTicker(20 * time.Second)
		defer ping.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-t.Closed():
				// Tell the CLI why before the reader context is cancelled: cancelling a pending read
				// drops the connection without a close frame, and the CLI would just reconnect.
				switch cur := s.hub.Get(ep.ID); {
				case t.Kicked():
					_ = c.Close(closeKicked, "disconnected from the dashboard")
				case cur != nil && cur != t:
					_ = c.Close(closeReplaced, "replaced by a newer connection")
				}
				return
			case m := <-t.Outbound():
				wctx, wcancel := context.WithTimeout(ctx, 10*time.Second)
				err := wsjson.Write(wctx, c, m)
				wcancel()
				if err != nil {
					return
				}
			case <-ping.C:
				pctx, pcancel := context.WithTimeout(ctx, 10*time.Second)
				err := c.Ping(pctx)
				pcancel()
				if err != nil {
					return
				}
			}
		}
	}()

	// reader: responses from the CLI
	for {
		var m proto.Message
		if err := wsjson.Read(ctx, c, &m); err != nil {
			return
		}
		if m.Type == proto.TypeResponse {
			t.HandleResponse(m)
		}
	}
}
