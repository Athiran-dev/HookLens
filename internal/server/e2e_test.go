package server

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/cookiejar"
	"net/http/httptest"
	"net/url"
	"os"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/coder/websocket"
	"github.com/coder/websocket/wsjson"
	"github.com/hooklens/hooklens/internal/config"
	"github.com/hooklens/hooklens/internal/proto"
	"github.com/hooklens/hooklens/internal/store"
)

// Full-system test: real Postgres, real HTTP server, a fake CLI tunnel and a fake "localhost" app.
// Needs TEST_DATABASE_URL (see scripts/setup-db.ps1); skipped otherwise.

type env struct {
	t   *testing.T
	ts  *httptest.Server
	cfg *config.Config
}

func newEnv(t *testing.T) *env {
	config.LoadDotEnv("../../.env")
	dsn := os.Getenv("TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("TEST_DATABASE_URL not set")
	}
	ctx := context.Background()
	st, err := store.New(ctx, dsn)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(st.Close)
	if err := st.Migrate(ctx); err != nil {
		t.Fatal(err)
	}
	cfg := &config.Config{MaxBodyBytes: 2048, MaxEndpointsPerUser: 10, MaxTunnelsPerUser: 5, ForwardTimeout: 5 * time.Second, AllowSignup: true, RetentionDays: 7}
	s := New(cfg, st, slog.New(slog.NewTextHandler(io.Discard, nil)))
	ts := httptest.NewServer(s.Handler())
	t.Cleanup(ts.Close)
	cfg.PublicURL = ts.URL
	return &env{t: t, ts: ts, cfg: cfg}
}

type user struct {
	e      *env
	http   *http.Client
	apiKey string
}

func (e *env) signup() *user {
	jar, _ := cookiejar.New(nil)
	u := &user{e: e, http: &http.Client{Jar: jar}}
	email := fmt.Sprintf("t%d@example.com", time.Now().UnixNano())
	if code, body := u.call("POST", "/api/v1/auth/signup", map[string]string{"email": email, "password": "correct horse"}); code != 201 {
		e.t.Fatalf("signup: %d %v", code, body)
	}
	_, tok := u.call("POST", "/api/v1/tokens", map[string]string{"name": "test"})
	u.apiKey = tok["token"].(string)
	return u
}

func (u *user) call(method, path string, in any) (int, map[string]any) {
	var body io.Reader
	if in != nil {
		b, _ := json.Marshal(in)
		body = bytes.NewReader(b)
	}
	req, _ := http.NewRequest(method, u.e.ts.URL+path, body)
	req.Header.Set("Content-Type", "application/json")
	resp, err := u.http.Do(req)
	if err != nil {
		u.e.t.Fatal(err)
	}
	defer resp.Body.Close()
	var out map[string]any
	_ = json.NewDecoder(resp.Body).Decode(&out)
	return resp.StatusCode, out
}

func (u *user) createEndpoint(name string) (id, hookURL string) {
	code, ep := u.call("POST", "/api/v1/endpoints", map[string]string{"name": name})
	if code != 201 {
		u.e.t.Fatalf("create endpoint: %d %v", code, ep)
	}
	return ep["id"].(string), ep["hook_url"].(string)
}

// fakeCLI connects a tunnel that forwards to localURL, like `hooklens listen`.
func (u *user) fakeCLI(endpointID, localURL string) (stop func()) {
	ctx, cancel := context.WithCancel(context.Background())
	wsURL := "ws" + strings.TrimPrefix(u.e.ts.URL, "http") + "/api/v1/ws/tunnel?endpoint_id=" + endpointID + "&target=" + localURL
	conn, _, err := websocket.Dial(ctx, wsURL, &websocket.DialOptions{HTTPHeader: http.Header{"Authorization": {"Bearer " + u.apiKey}}})
	if err != nil {
		u.e.t.Fatal(err)
	}
	var ready proto.Message
	if err := wsjson.Read(ctx, conn, &ready); err != nil || ready.Type != proto.TypeReady {
		u.e.t.Fatalf("no ready: %v", err)
	}
	go func() {
		for {
			var m proto.Message
			if wsjson.Read(ctx, conn, &m) != nil {
				return
			}
			go func(m proto.Message) {
				req, _ := http.NewRequest(m.Method, localURL+m.Path+"?"+m.Query, bytes.NewReader(m.Body))
				for k, vs := range m.Headers {
					for _, v := range vs {
						req.Header.Add(k, v)
					}
				}
				out := proto.Message{Type: proto.TypeResponse, DeliveryID: m.DeliveryID}
				resp, err := http.DefaultClient.Do(req)
				if err != nil {
					out.Error = err.Error()
				} else {
					out.Status, out.Headers = resp.StatusCode, resp.Header
					out.Body, _ = io.ReadAll(resp.Body)
					resp.Body.Close()
				}
				_ = wsjson.Write(ctx, conn, out)
			}(m)
		}
	}()
	return func() { cancel(); conn.CloseNow() }
}

func (u *user) waitDelivery(reqID, want string) map[string]any {
	u.e.t.Helper()
	deadline := time.Now().Add(5 * time.Second)
	for time.Now().Before(deadline) {
		_, r := u.call("GET", "/api/v1/requests/"+reqID, nil)
		if ds, _ := r["deliveries"].([]any); len(ds) > 0 {
			d := ds[0].(map[string]any)
			if d["status"] == want {
				return r
			}
		}
		time.Sleep(50 * time.Millisecond)
	}
	u.e.t.Fatalf("delivery for %s never reached %q", reqID, want)
	return nil
}

func post(url, body string, hdr map[string]string) (*http.Response, map[string]any) {
	req, _ := http.NewRequest("POST", url, strings.NewReader(body))
	for k, v := range hdr {
		req.Header.Set(k, v)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		panic(err)
	}
	defer resp.Body.Close()
	var out map[string]any
	_ = json.NewDecoder(resp.Body).Decode(&out)
	return resp, out
}

func TestWebhookLifecycle(t *testing.T) {
	e := newEnv(t)
	alice := e.signup()
	epID, hook := alice.createEndpoint("Razorpay Testing")

	// the developer's "localhost app"
	var mu sync.Mutex
	var seen []*http.Request
	var seenBody [][]byte
	status := 201
	local := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		b, _ := io.ReadAll(r.Body)
		mu.Lock()
		seen = append(seen, r)
		seenBody = append(seenBody, b)
		code := status
		mu.Unlock()
		w.WriteHeader(code)
		w.Write([]byte("handled"))
	}))
	defer local.Close()

	payload := `{"event":"payment.captured","payment":{"id":"pay_123","amount":50000}}`

	// 1. capture works even with no tunnel: received, stored, delivery = no_tunnel
	resp, out := post(hook+"/webhooks/razorpay?x=1", payload, map[string]string{"Content-Type": "application/json", "X-Razorpay-Event": "payment.captured", "Authorization": "Bearer secret"})
	if resp.StatusCode != 200 || out["status"] != "received" {
		t.Fatalf("ingest: %d %v", resp.StatusCode, out)
	}
	firstID := out["id"].(string)
	r := alice.waitDelivery(firstID, "no_tunnel")
	if r["path"] != "/webhooks/razorpay" || r["query"] != "x=1" || r["method"] != "POST" {
		t.Fatalf("request not captured faithfully: %v", r)
	}
	if got := r["body"].(map[string]any)["body_text"]; got != payload {
		t.Fatalf("raw body changed: %v", got)
	}
	if h := r["headers"].(map[string]any)["Authorization"].([]any)[0]; h != "[redacted]" {
		t.Fatalf("Authorization not redacted in API output: %v", h)
	}

	// 2. connect the tunnel; a new webhook is forwarded to localhost and the response recorded
	stop := alice.fakeCLI(epID, local.URL)
	defer stop()
	ws, _ := websocketDashboard(t, e, alice)
	defer ws.CloseNow()

	_, out = post(hook+"/webhooks/razorpay?x=2", payload, map[string]string{"Content-Type": "application/json", "X-Razorpay-Event": "payment.captured"})
	id2 := out["id"].(string)
	r = alice.waitDelivery(id2, "delivered")
	d := r["deliveries"].([]any)[0].(map[string]any)
	if d["response_code"].(float64) != 201 || d["response_body"].(map[string]any)["body_text"] != "handled" {
		t.Fatalf("local response not recorded: %v", d)
	}
	mu.Lock()
	if len(seen) != 1 || string(seenBody[0]) != payload || seen[0].URL.Path != "/webhooks/razorpay" || seen[0].URL.RawQuery != "x=2" || seen[0].Header.Get("X-Razorpay-Event") != "payment.captured" {
		t.Fatalf("local app received something different: %+v %s", seen, seenBody)
	}
	mu.Unlock()
	sawRequestEvent := false
	for i := 0; i < 6 && !sawRequestEvent; i++ { // live dashboard got the request event
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		_, data, err := ws.Read(ctx)
		cancel()
		if err != nil {
			break
		}
		sawRequestEvent = strings.Contains(string(data), `"type":"request"`)
	}
	if !sawRequestEvent {
		t.Fatal("dashboard websocket never received the request event")
	}

	// 3. local server failing => delivery failed, status code preserved
	mu.Lock()
	status = 500
	mu.Unlock()
	_, out = post(hook, `{"x":1}`, nil)
	r = alice.waitDelivery(out["id"].(string), "failed")
	if r["deliveries"].([]any)[0].(map[string]any)["response_code"].(float64) != 500 {
		t.Fatalf("expected 500 recorded: %v", r)
	}

	// 4. replay re-sends the stored request and is labelled as a replay
	mu.Lock()
	status = 200
	mu.Unlock()
	code, rd := alice.call("POST", "/api/v1/requests/"+id2+"/replay", nil)
	if code != 202 || rd["kind"] != "replay" {
		t.Fatalf("replay: %d %v", code, rd)
	}
	deadline := time.Now().Add(5 * time.Second)
	var replayed bool
	for time.Now().Before(deadline) && !replayed {
		_, rr := alice.call("GET", "/api/v1/requests/"+id2, nil)
		for _, x := range rr["deliveries"].([]any) {
			dm := x.(map[string]any)
			replayed = replayed || (dm["kind"] == "replay" && dm["status"] == "delivered")
		}
		time.Sleep(50 * time.Millisecond)
	}
	if !replayed {
		t.Fatal("replay never delivered")
	}
	mu.Lock()
	last := seen[len(seen)-1]
	if last.Header.Get("X-HookLens-Replay") != "true" || string(seenBody[len(seenBody)-1]) != payload {
		t.Fatalf("replay not labelled or body changed: %v", last.Header)
	}
	mu.Unlock()

	// 5. isolation: another user cannot see alice's data
	bob := e.signup()
	if code, _ := bob.call("GET", "/api/v1/requests/"+id2, nil); code != 404 {
		t.Fatalf("cross-user read must 404, got %d", code)
	}
	if code, _ := bob.call("POST", "/api/v1/requests/"+id2+"/replay", nil); code != 404 {
		t.Fatalf("cross-user replay must 404, got %d", code)
	}
	if code, _ := bob.call("GET", "/api/v1/endpoints/"+epID, nil); code != 404 {
		t.Fatalf("cross-user endpoint read must 404, got %d", code)
	}

	// 6. guardrails: oversized payload, unknown token, disabled endpoint
	if resp, _ := post(hook, strings.Repeat("a", 5000), nil); resp.StatusCode != 413 {
		t.Fatalf("oversize: want 413 got %d", resp.StatusCode)
	}
	if resp, _ := post(e.ts.URL+"/hook/doesnotexist", "x", nil); resp.StatusCode != 404 {
		t.Fatalf("unknown token: want 404 got %d", resp.StatusCode)
	}
	inactive := "inactive"
	alice.call("PATCH", "/api/v1/endpoints/"+epID, map[string]*string{"status": &inactive})
	if resp, _ := post(hook, "x", nil); resp.StatusCode != 403 {
		t.Fatalf("disabled endpoint: want 403 got %d", resp.StatusCode)
	}

	// 7. unauthenticated API access is refused
	anon := &user{e: e, http: &http.Client{}}
	if code, _ := anon.call("GET", "/api/v1/endpoints", nil); code != 401 {
		t.Fatalf("anon: want 401 got %d", code)
	}
}

func websocketDashboard(t *testing.T, e *env, u *user) (*websocket.Conn, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	url := "ws" + strings.TrimPrefix(e.ts.URL, "http") + "/api/v1/ws/dashboard"
	cookies := u.http.Jar.Cookies(mustURL(e.ts.URL))
	var parts []string
	for _, c := range cookies {
		parts = append(parts, c.Name+"="+c.Value)
	}
	conn, _, err := websocket.Dial(ctx, url, &websocket.DialOptions{HTTPHeader: http.Header{"Cookie": {strings.Join(parts, "; ")}}})
	if err != nil {
		t.Fatal(err)
	}
	return conn, nil
}

func TestDeliveryFailsWhenCLIDisconnects(t *testing.T) {
	e := newEnv(t)
	u := e.signup()
	epID, hook := u.createEndpoint("hang")
	// a local app that never answers within the test
	block := make(chan struct{})
	local := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { <-block }))
	defer local.Close()
	defer close(block)
	stop := u.fakeCLI(epID, local.URL)

	_, out := post(hook, "{}", nil)
	time.Sleep(200 * time.Millisecond)
	stop() // CLI dies mid-request
	r := u.waitDelivery(out["id"].(string), "failed")
	if msg := r["deliveries"].([]any)[0].(map[string]any)["error"].(string); !strings.Contains(msg, "disconnected") {
		t.Fatalf("expected disconnect error, got %q", msg)
	}
}

func mustURL(s string) *url.URL {
	u, err := url.Parse(s)
	if err != nil {
		panic(err)
	}
	return u
}

// dialTunnel opens a raw tunnel connection and consumes the ready message.
func (u *user) dialTunnel(endpointID string) *websocket.Conn {
	ctx := context.Background()
	wsURL := "ws" + strings.TrimPrefix(u.e.ts.URL, "http") + "/api/v1/ws/tunnel?endpoint_id=" + endpointID + "&target=http://localhost:1"
	conn, _, err := websocket.Dial(ctx, wsURL, &websocket.DialOptions{HTTPHeader: http.Header{"Authorization": {"Bearer " + u.apiKey}}})
	if err != nil {
		u.e.t.Fatal(err)
	}
	var ready proto.Message
	if err := wsjson.Read(ctx, conn, &ready); err != nil || ready.Type != proto.TypeReady {
		u.e.t.Fatalf("no ready: %v", err)
	}
	return conn
}

func closeCodeOf(t *testing.T, conn *websocket.Conn) websocket.StatusCode {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	var m proto.Message
	err := wsjson.Read(ctx, conn, &m)
	if err == nil {
		t.Fatal("expected the connection to close")
	}
	return websocket.CloseStatus(err)
}

// The CLI must be told *why* it was disconnected so it stops instead of reconnecting in a loop.
func TestTunnelCloseReasons(t *testing.T) {
	e := newEnv(t)
	u := e.signup()
	epID, _ := u.createEndpoint("reasons")

	// disconnect from the dashboard -> 4002
	c1 := u.dialTunnel(epID)
	if code, _ := u.call("DELETE", "/api/v1/tunnels/"+epID, nil); code != 200 {
		t.Fatalf("disconnect: %d", code)
	}
	if got := closeCodeOf(t, c1); got != 4002 {
		t.Fatalf("dashboard disconnect: want close code 4002, got %d", got)
	}
	if code, _ := u.call("DELETE", "/api/v1/tunnels/"+epID, nil); code != 404 {
		t.Fatalf("disconnect with no tunnel: want 404, got %d", code)
	}

	// a newer connection replaces the older one -> 4001 for the old one
	c2 := u.dialTunnel(epID)
	c3 := u.dialTunnel(epID)
	if got := closeCodeOf(t, c2); got != 4001 {
		t.Fatalf("replaced tunnel: want close code 4001, got %d", got)
	}
	c3.CloseNow()

	// another user cannot disconnect it
	bob := e.signup()
	if code, _ := bob.call("DELETE", "/api/v1/tunnels/"+epID, nil); code != 404 {
		t.Fatalf("cross-user disconnect: want 404, got %d", code)
	}
}

// New analytics endpoints return well-formed, zero-filled data for a fresh account.
func TestAnalyticsEndpoints(t *testing.T) {
	e := newEnv(t)
	u := e.signup()
	for rng, n := range map[string]int{"1h": 12, "24h": 24, "7d": 28, "30d": 30} {
		req, _ := http.NewRequest("GET", e.ts.URL+"/api/v1/stats/activity?range="+rng, nil)
		req.Header.Set("Authorization", "Bearer "+u.apiKey)
		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		var pts []map[string]any
		_ = json.NewDecoder(resp.Body).Decode(&pts)
		resp.Body.Close()
		if resp.StatusCode != 200 || len(pts) != n {
			t.Fatalf("range %s: status %d, %d buckets (want %d)", rng, resp.StatusCode, len(pts), n)
		}
	}
	if code, body := u.call("GET", "/api/v1/stats", nil); code != 200 || body["window"] == nil {
		t.Fatalf("stats: %d %v", code, body)
	}
	if code, _ := u.call("GET", "/api/v1/deliveries?kind=bogus", nil); code != 400 {
		t.Fatalf("bad kind: want 400, got %d", code)
	}
}
