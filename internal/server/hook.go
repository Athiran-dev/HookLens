package server

import (
	"context"
	"errors"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/hooklens/hooklens/internal/hub"
	"github.com/hooklens/hooklens/internal/proto"
	"github.com/hooklens/hooklens/internal/store"
)

// handleHook is the public ingestion endpoint. It captures first, acknowledges quickly, and
// forwards asynchronously: the provider never waits on a slow local dev server.
func (s *Server) handleHook(w http.ResponseWriter, r *http.Request) {
	token := r.PathValue("token")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	ep, ownerID, err := s.store.EndpointByToken(ctx, token)
	if err != nil {
		writeErr(w, 404, "unknown webhook endpoint")
		return
	}
	if ep.Status != "active" {
		writeErr(w, 403, "this webhook endpoint is disabled")
		return
	}
	if !s.limiter.Allow("hook:"+token, 20, 60) {
		w.Header().Set("Retry-After", "1")
		writeErr(w, 429, "rate limit exceeded for this endpoint")
		return
	}

	body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, s.cfg.MaxBodyBytes))
	if err != nil {
		var mbe *http.MaxBytesError
		if errors.As(err, &mbe) {
			writeErr(w, 413, "payload too large")
		} else {
			writeErr(w, 400, "could not read request body")
		}
		return
	}

	headers := make(map[string][]string, len(r.Header)+1)
	for k, v := range r.Header {
		headers[k] = append([]string(nil), v...)
	}
	if r.Host != "" {
		headers["Host"] = []string{r.Host}
	}
	path := "/" + r.PathValue("rest")
	req := &store.Request{
		EndpointID:  ep.ID,
		Method:      r.Method,
		Path:        path,
		Query:       r.URL.RawQuery,
		Headers:     headers,
		Body:        body,
		ContentType: r.Header.Get("Content-Type"),
		SourceIP:    s.clientIP(r),
		Size:        len(body),
	}
	if err := s.store.InsertRequest(ctx, req); err != nil {
		s.log.Error("store request", "err", err)
		writeErr(w, 500, "could not store request")
		return
	}
	s.log.Info("event", "name", "webhook_received", "endpoint", ep.ID)
	s.bus.Publish(ownerID, map[string]any{"type": "request", "request": store.RequestSummary{
		ID: req.ID, EndpointID: ep.ID, Method: req.Method, Path: req.Path, Query: req.Query,
		ContentType: req.ContentType, Size: req.Size, SourceIP: req.SourceIP, ReceivedAt: req.ReceivedAt,
	}})

	s.deliver(ctx, ep, ownerID, req, "forward")

	writeJSON(w, 200, map[string]string{"status": "received", "id": req.ID})
}

// Hop-by-hop and connection-specific headers are not forwarded to localhost.
var skipForward = map[string]bool{
	"connection": true, "keep-alive": true, "proxy-authenticate": true, "proxy-authorization": true,
	"te": true, "trailer": true, "transfer-encoding": true, "upgrade": true,
	"host": true, "content-length": true,
}

// deliver records a delivery attempt and, when a CLI tunnel is connected, dispatches the request to it
// asynchronously. It returns the delivery as stored at call time (pending, or already terminal).
func (s *Server) deliver(ctx context.Context, ep *store.Endpoint, ownerID string, req *store.Request, kind string) *store.Delivery {
	t := s.hub.Get(ep.ID)
	if t == nil {
		d, err := s.store.CreateDelivery(ctx, req.ID, kind, "no_tunnel", "", "No CLI tunnel is connected for this endpoint. Run `hooklens listen <port>`, then replay.")
		if err != nil {
			s.log.Error("create delivery", "err", err)
			return nil
		}
		s.publishDelivery(ownerID, req, d)
		return d
	}

	d, err := s.store.CreateDelivery(ctx, req.ID, kind, "pending", t.Target, "")
	if err != nil {
		s.log.Error("create delivery", "err", err)
		return nil
	}
	s.publishDelivery(ownerID, req, d)

	fwd := make(map[string][]string, len(req.Headers)+2)
	for k, v := range req.Headers {
		if !skipForward[strings.ToLower(k)] {
			fwd[k] = v
		}
	}
	fwd["X-Forwarded-Host"] = []string{firstOr(req.Headers["Host"], "")}
	fwd["X-HookLens-Delivery-Id"] = []string{d.ID}
	if kind == "replay" {
		fwd["X-HookLens-Replay"] = []string{"true"}
	}
	msg := proto.Message{
		Type: proto.TypeRequest, DeliveryID: d.ID,
		Method: req.Method, Path: req.Path, Query: req.Query, Headers: fwd, Body: req.Body,
	}
	derr := t.Dispatch(msg, s.cfg.ForwardTimeout, func(resp proto.Message, err error) {
		s.finishDelivery(ownerID, req, d.ID, resp, err)
	})
	if derr != nil {
		s.finishDelivery(ownerID, req, d.ID, proto.Message{}, derr)
		d.Status = "failed"
		d.Error = derr.Error()
	}
	return d
}

func (s *Server) finishDelivery(ownerID string, req *store.Request, deliveryID string, resp proto.Message, err error) {
	status, errMsg := "delivered", ""
	switch {
	case errors.Is(err, hub.ErrTimeout):
		status, errMsg = "failed", "The local server did not respond within "+s.cfg.ForwardTimeout.String()
	case err != nil:
		status, errMsg = "failed", err.Error()
	case resp.Error != "":
		status, errMsg = "failed", resp.Error
	case resp.Status >= 400:
		status, errMsg = "failed", "Local server returned HTTP "+itoa(resp.Status)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	d, derr := s.store.CompleteDelivery(ctx, deliveryID, status, resp.Status, resp.Headers, resp.Body, resp.DurationMS, errMsg)
	if derr != nil {
		if !errors.Is(derr, store.ErrNotFound) {
			s.log.Error("complete delivery", "err", derr)
		}
		return
	}
	if status == "delivered" {
		s.log.Info("event", "name", "request_forwarded")
	}
	s.publishDelivery(ownerID, req, d)
}

func (s *Server) publishDelivery(ownerID string, req *store.Request, d *store.Delivery) {
	s.bus.Publish(ownerID, map[string]any{
		"type": "delivery", "request_id": req.ID, "endpoint_id": req.EndpointID,
		"delivery": store.DeliveryBrief{ID: d.ID, Kind: d.Kind, Status: d.Status, ResponseCode: d.ResponseCode, DurationMS: d.DurationMS},
		"error":    d.Error,
	})
}

func firstOr(v []string, def string) string {
	if len(v) > 0 {
		return v[0]
	}
	return def
}

func itoa(n int) string {
	const digits = "0123456789"
	if n == 0 {
		return "0"
	}
	var b [12]byte
	i := len(b)
	for n > 0 {
		i--
		b[i] = digits[n%10]
		n /= 10
	}
	return string(b[i:])
}
