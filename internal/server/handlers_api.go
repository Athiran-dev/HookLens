package server

import (
	"encoding/base64"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/hooklens/hooklens/internal/auth"
	"github.com/hooklens/hooklens/internal/store"
)

// ---------- redaction & body rendering ----------

var sensitiveHeaders = map[string]bool{
	"authorization": true, "proxy-authorization": true, "cookie": true, "set-cookie": true,
	"x-api-key": true, "x-auth-token": true,
}

// redactHeaders masks credentials for display. The stored copy stays intact so replays send what the
// provider actually sent.
func redactHeaders(h map[string][]string) map[string][]string {
	out := make(map[string][]string, len(h))
	for k, v := range h {
		if sensitiveHeaders[strings.ToLower(k)] {
			out[k] = []string{"[redacted]"}
		} else {
			out[k] = v
		}
	}
	return out
}

type bodyView struct {
	BodyBase64 string  `json:"body_base64"`
	BodyText   *string `json:"body_text"`
}

func viewBody(b []byte) bodyView {
	v := bodyView{BodyBase64: base64.StdEncoding.EncodeToString(b)}
	if utf8.Valid(b) {
		s := string(b)
		v.BodyText = &s
	}
	return v
}

type deliveryView struct {
	store.Delivery
	ResponseHeaders map[string][]string `json:"response_headers"`
	ResponseBody    bodyView            `json:"response_body"`
}

type requestView struct {
	store.Request
	Headers    map[string][]string `json:"headers"`
	Body       bodyView            `json:"body"`
	Deliveries []deliveryView      `json:"deliveries"`
}

func (s *Server) buildRequestView(req *store.Request, ds []store.Delivery) requestView {
	rv := requestView{Request: *req, Headers: redactHeaders(req.Headers), Body: viewBody(req.Body), Deliveries: []deliveryView{}}
	for _, d := range ds {
		rv.Deliveries = append(rv.Deliveries, deliveryView{Delivery: d, ResponseHeaders: redactHeaders(d.ResponseHeaders), ResponseBody: viewBody(d.ResponseBody)})
	}
	return rv
}

// ---------- endpoints ----------

func (s *Server) handleListEndpoints(w http.ResponseWriter, r *http.Request, u *store.User) {
	eps, err := s.store.ListEndpoints(r.Context(), u.ID)
	if err != nil {
		writeErr(w, 500, "could not list endpoints")
		return
	}
	for _, e := range eps {
		s.decorate(e)
	}
	writeJSON(w, 200, eps)
}

func (s *Server) handleCreateEndpoint(w http.ResponseWriter, r *http.Request, u *store.User) {
	var in struct {
		Name       string `json:"name"`
		ForwardURL string `json:"forward_url"`
	}
	if !decode(w, r, &in) {
		return
	}
	name := strings.TrimSpace(in.Name)
	if name == "" || len(name) > 60 {
		writeErr(w, 400, "name is required (max 60 characters)")
		return
	}
	if !validForwardURL(in.ForwardURL) {
		writeErr(w, 400, "forward_url must be a valid http(s) URL")
		return
	}
	e, err := s.store.CreateEndpoint(r.Context(), u.ID, name, in.ForwardURL, auth.NewPublicToken(), s.cfg.MaxEndpointsPerUser)
	if errors.Is(err, store.ErrLimit) {
		writeErr(w, 409, "endpoint limit reached ("+strconv.Itoa(s.cfg.MaxEndpointsPerUser)+"); delete one first")
		return
	}
	if err != nil {
		s.log.Error("create endpoint", "err", err)
		writeErr(w, 500, "could not create endpoint")
		return
	}
	s.log.Info("event", "name", "endpoint_created", "user", u.ID)
	writeJSON(w, 201, s.decorate(e))
}

func (s *Server) handleGetEndpoint(w http.ResponseWriter, r *http.Request, u *store.User) {
	e, err := s.store.EndpointForUser(r.Context(), u.ID, r.PathValue("id"))
	if err != nil {
		writeErr(w, 404, "endpoint not found")
		return
	}
	writeJSON(w, 200, s.decorate(e))
}

func (s *Server) handleUpdateEndpoint(w http.ResponseWriter, r *http.Request, u *store.User) {
	var in struct {
		Name       *string `json:"name"`
		Status     *string `json:"status"`
		ForwardURL *string `json:"forward_url"`
	}
	if !decode(w, r, &in) {
		return
	}
	if in.Name != nil {
		n := strings.TrimSpace(*in.Name)
		if n == "" || len(n) > 60 {
			writeErr(w, 400, "name must be 1 to 60 characters")
			return
		}
		in.Name = &n
	}
	if in.Status != nil && *in.Status != "active" && *in.Status != "inactive" {
		writeErr(w, 400, "status must be active or inactive")
		return
	}
	if in.ForwardURL != nil && !validForwardURL(*in.ForwardURL) {
		writeErr(w, 400, "forward_url must be a valid http(s) URL")
		return
	}
	e, err := s.store.UpdateEndpoint(r.Context(), u.ID, r.PathValue("id"), in.Name, in.Status, in.ForwardURL)
	if err != nil {
		writeErr(w, 404, "endpoint not found")
		return
	}
	if e.Status == "inactive" {
		if t := s.hub.Get(e.ID); t != nil {
			t.Close()
		}
	}
	writeJSON(w, 200, s.decorate(e))
}

func (s *Server) handleDeleteEndpoint(w http.ResponseWriter, r *http.Request, u *store.User) {
	id := r.PathValue("id")
	if err := s.store.DeleteEndpoint(r.Context(), u.ID, id); err != nil {
		writeErr(w, 404, "endpoint not found")
		return
	}
	if t := s.hub.Get(id); t != nil {
		t.Close()
	}
	writeJSON(w, 200, map[string]bool{"ok": true})
}

// ---------- requests ----------

func (s *Server) handleListRequests(w http.ResponseWriter, r *http.Request, u *store.User) {
	q := r.URL.Query()
	f := store.RequestFilter{
		EndpointID: r.PathValue("id"),
		Method:     q.Get("method"),
		Status:     q.Get("status"),
		Query:      strings.TrimSpace(q.Get("q")),
	}
	if f.EndpointID == "" {
		f.EndpointID = q.Get("endpoint_id")
	}
	if f.EndpointID != "" {
		if _, err := s.store.EndpointForUser(r.Context(), u.ID, f.EndpointID); err != nil {
			writeErr(w, 404, "endpoint not found")
			return
		}
	}
	if n, err := strconv.Atoi(q.Get("limit")); err == nil {
		f.Limit = n
	}
	if b := q.Get("before"); b != "" {
		t, err := time.Parse(time.RFC3339Nano, b)
		if err != nil {
			writeErr(w, 400, "before must be an RFC3339 timestamp")
			return
		}
		f.Before = &t
	}
	reqs, err := s.store.ListRequests(r.Context(), u.ID, f)
	if err != nil {
		s.log.Error("list requests", "err", err)
		writeErr(w, 500, "could not list requests")
		return
	}
	writeJSON(w, 200, reqs)
}

func (s *Server) handleGetRequest(w http.ResponseWriter, r *http.Request, u *store.User) {
	req, err := s.store.RequestForUser(r.Context(), u.ID, r.PathValue("id"))
	if err != nil {
		writeErr(w, 404, "request not found")
		return
	}
	ds, err := s.store.DeliveriesForRequest(r.Context(), req.ID)
	if err != nil {
		writeErr(w, 500, "could not load deliveries")
		return
	}
	writeJSON(w, 200, s.buildRequestView(req, ds))
}

func (s *Server) handleReplay(w http.ResponseWriter, r *http.Request, u *store.User) {
	if !s.limiter.Allow("replay:"+u.ID, 30.0/60, 10) {
		writeErr(w, 429, "replaying too fast, wait a moment")
		return
	}
	req, err := s.store.RequestForUser(r.Context(), u.ID, r.PathValue("id"))
	if err != nil {
		writeErr(w, 404, "request not found")
		return
	}
	ep, err := s.store.EndpointForUser(r.Context(), u.ID, req.EndpointID)
	if err != nil {
		writeErr(w, 404, "endpoint not found")
		return
	}
	d := s.deliver(r.Context(), ep, u.ID, req, "replay")
	if d == nil {
		writeErr(w, 500, "could not create delivery")
		return
	}
	s.log.Info("event", "name", "request_replayed", "user", u.ID)
	status := 202
	if d.Status == "no_tunnel" {
		status = 409
	}
	writeJSON(w, status, d)
}

func (s *Server) handleStats(w http.ResponseWriter, r *http.Request, u *store.User) {
	st, err := s.store.Stats(r.Context(), u.ID)
	if err != nil {
		writeErr(w, 500, "could not load stats")
		return
	}
	writeJSON(w, 200, map[string]any{"stats": st, "active_tunnels": len(s.hub.ListForUser(u.ID))})
}

func (s *Server) handleTunnels(w http.ResponseWriter, r *http.Request, u *store.User) {
	writeJSON(w, 200, s.hub.ListForUser(u.ID))
}

func (s *Server) handleActivity(w http.ResponseWriter, r *http.Request, u *store.User) {
	pts, err := s.store.Activity(r.Context(), u.ID)
	if err != nil {
		s.log.Error("activity", "err", err)
		writeErr(w, 500, "could not load activity")
		return
	}
	writeJSON(w, 200, pts)
}
