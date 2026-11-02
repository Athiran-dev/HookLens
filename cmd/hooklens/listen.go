package main

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"math/rand"
	"net"
	"net/http"
	"net/url"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"time"

	"github.com/coder/websocket"
	"github.com/coder/websocket/wsjson"
	"github.com/hooklens/hooklens/internal/proto"
)

const (
	closeReplaced websocket.StatusCode = 4001
	closeKicked   websocket.StatusCode = 4002
)

func parseTarget(arg string) (*url.URL, error) {
	if _, err := strconv.Atoi(arg); err == nil {
		arg = "http://localhost:" + arg
	} else if !strings.Contains(arg, "://") {
		arg = "http://" + arg
	}
	u, err := url.Parse(arg)
	if err != nil || u.Host == "" || (u.Scheme != "http" && u.Scheme != "https") {
		return nil, fmt.Errorf("invalid target %q (use a port like 3000 or a URL like http://localhost:3000)", arg)
	}
	return u, nil
}

func pickEndpoint(c *client, want string) (*endpointInfo, error) {
	var eps []endpointInfo
	if err := c.do("GET", "/api/v1/endpoints", nil, &eps); err != nil {
		return nil, err
	}
	if want != "" {
		for i := range eps {
			e := &eps[i]
			if e.ID == want || e.PublicToken == want || strings.EqualFold(e.Name, want) {
				return e, nil
			}
		}
		return nil, fmt.Errorf("no endpoint matches %q (see `hooklens endpoints`)", want)
	}
	switch len(eps) {
	case 0:
		var e endpointInfo
		if err := c.do("POST", "/api/v1/endpoints", map[string]string{"name": "default"}, &e); err != nil {
			return nil, err
		}
		fmt.Println("Created your first endpoint: default")
		return &e, nil
	case 1:
		return &eps[0], nil
	}
	var b strings.Builder
	b.WriteString("you have several endpoints; choose one with --endpoint <name>:\n")
	for _, e := range eps {
		fmt.Fprintf(&b, "  - %s\n", e.Name)
	}
	return nil, errors.New(strings.TrimRight(b.String(), "\n"))
}

func cmdListen(args []string) error {
	fs := newFlagSet("listen")
	endpointFlag := fs.String("endpoint", "", "endpoint name, id or token (default: your only endpoint)")
	pos := parseInterspersed(fs, args)

	c := newClient()
	if err := c.requireAuth(); err != nil {
		return err
	}
	ep, err := pickEndpoint(c, *endpointFlag)
	if err != nil {
		return err
	}
	targetArg := ""
	if len(pos) > 0 {
		targetArg = pos[0]
	} else if ep.ForwardURL != "" {
		targetArg = ep.ForwardURL
	} else {
		return errors.New("usage: hooklens listen <port|url> [--endpoint name]   e.g. hooklens listen 3000")
	}
	target, err := parseTarget(targetArg)
	if err != nil {
		return err
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt)
	defer stop()

	printLogo("CLI " + version)
	fmt.Println("  ✓ Authenticated")
	if conn, err := net.DialTimeout("tcp", target.Host, time.Second); err == nil {
		conn.Close()
		fmt.Println("  ✓ Local server detected")
	} else {
		fmt.Printf("  ! Nothing is listening on %s yet; start your app (requests will fail until you do)\n", target.Host)
	}

	runner := &tunnelRunner{client: c, endpoint: ep, target: target, fwd: &http.Client{
		Timeout:       25 * time.Second,
		CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse },
	}}
	return runner.run(ctx)
}

type tunnelRunner struct {
	client   *client
	endpoint *endpointInfo
	target   *url.URL
	fwd      *http.Client
	sem      chan struct{}
}

func (t *tunnelRunner) run(ctx context.Context) error {
	t.sem = make(chan struct{}, 32)
	backoff := time.Second
	first := true
	for ctx.Err() == nil {
		started := time.Now()
		err := t.session(ctx, first)
		first = false
		if ctx.Err() != nil {
			break
		}
		var fatal *fatalError
		if errors.As(err, &fatal) {
			return fatal
		}
		if time.Since(started) > time.Minute {
			backoff = time.Second // the connection was healthy; start the ladder over
		}
		wait := time.Duration(float64(backoff) * (0.8 + 0.4*rand.Float64()))
		fmt.Printf("  ✗ Disconnected (%v). Reconnecting in %s...\n", shortErr(err), wait.Round(100*time.Millisecond))
		select {
		case <-ctx.Done():
		case <-time.After(wait):
		}
		if backoff < 30*time.Second {
			backoff *= 2
		}
	}
	fmt.Println("\n  Tunnel closed.")
	return nil
}

type fatalError struct{ msg string }

func (e *fatalError) Error() string { return e.msg }

func shortErr(err error) string {
	if err == nil {
		return "connection closed"
	}
	s := err.Error()
	if len(s) > 80 {
		s = s[:80] + "…"
	}
	return s
}

func (t *tunnelRunner) session(ctx context.Context, first bool) error {
	wsURL := strings.Replace(t.client.server, "http", "ws", 1) + "/api/v1/ws/tunnel?" + url.Values{
		"endpoint_id": {t.endpoint.ID},
		"target":      {t.target.String()},
	}.Encode()
	dctx, cancel := context.WithTimeout(ctx, 15*time.Second)
	conn, resp, err := websocket.Dial(dctx, wsURL, &websocket.DialOptions{
		HTTPHeader: http.Header{"Authorization": {"Bearer " + t.client.token}},
	})
	cancel()
	if err != nil {
		if resp != nil {
			switch resp.StatusCode {
			case 401:
				return &fatalError{"authentication failed. Run `hooklens login` again"}
			case 403, 404:
				return &fatalError{"the server refused this tunnel (endpoint disabled or deleted)"}
			case 429:
				return &fatalError{"too many active tunnels for your account; stop another `hooklens listen`"}
			}
		}
		return err
	}
	defer conn.CloseNow()
	conn.SetReadLimit(8 << 20)

	var ready proto.Message
	if err := wsjson.Read(ctx, conn, &ready); err != nil || ready.Type != proto.TypeReady {
		return fmt.Errorf("handshake failed: %v", err)
	}
	if first {
		fmt.Println("  ✓ Connected to HookLens")
	} else {
		fmt.Println("  ✓ Reconnected")
	}
	fmt.Printf("\n  Local URL:\n  %s\n\n  Public URL (give this to your webhook provider):\n  %s\n\n  Endpoint: %s\n  Status:   Connected\n\n  Waiting for incoming webhooks...  (Ctrl+C to stop)\n\n",
		t.target, ready.PublicURL, ready.EndpointName)

	for {
		var m proto.Message
		if err := wsjson.Read(ctx, conn, &m); err != nil {
			if websocket.CloseStatus(err) == closeKicked {
				return &fatalError{"this tunnel was disconnected from the HookLens dashboard"}
			}
			if websocket.CloseStatus(err) == closeReplaced {
				return &fatalError{"another `hooklens listen` took over this endpoint; this one has stopped"}
			}
			return err
		}
		if m.Type != proto.TypeRequest {
			continue
		}
		t.sem <- struct{}{}
		go func(m proto.Message) {
			defer func() { <-t.sem }()
			out := t.forward(ctx, m)
			wctx, wcancel := context.WithTimeout(context.Background(), 10*time.Second)
			defer wcancel()
			if err := wsjson.Write(wctx, conn, out); err != nil {
				fmt.Printf("  ! could not send response upstream: %v\n", shortErr(err))
			}
		}(m)
	}
}

// forward replays one webhook against the local server and builds the response message.
func (t *tunnelRunner) forward(ctx context.Context, m proto.Message) proto.Message {
	target := *t.target
	target.Path = strings.TrimRight(target.Path, "/") + m.Path
	target.RawQuery = m.Query
	start := time.Now()

	req, err := http.NewRequestWithContext(ctx, m.Method, target.String(), bytes.NewReader(m.Body))
	out := proto.Message{Type: proto.TypeResponse, DeliveryID: m.DeliveryID}
	if err == nil {
		for k, vs := range m.Headers {
			for _, v := range vs {
				req.Header.Add(k, v)
			}
		}
		var resp *http.Response
		resp, err = t.fwd.Do(req)
		if err == nil {
			body, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
			resp.Body.Close()
			out.Status, out.Headers, out.Body = resp.StatusCode, resp.Header, body
		}
	}
	out.DurationMS = int(time.Since(start).Milliseconds())
	if err != nil {
		out.Error = "could not reach " + t.target.Host + ": " + shortErr(unwrapURLError(err))
	}
	printRequestLine(m.Method, m.Path, out)
	return out
}

func unwrapURLError(err error) error {
	var ue *url.Error
	if errors.As(err, &ue) {
		return ue.Err
	}
	return err
}

func printRequestLine(method, path string, r proto.Message) {
	status := fmt.Sprintf("%d", r.Status)
	color := "32"
	switch {
	case r.Error != "":
		status, color = "ERR", "31"
	case r.Status >= 500:
		color = "31"
	case r.Status >= 400:
		color = "33"
	}
	fmt.Printf("  %s  %-6s %-40s → %s  (%dms)\n", time.Now().Format("15:04:05"), method, truncate(path, 40), paint(status, color), r.DurationMS)
	if r.Error != "" {
		fmt.Printf("            %s\n", r.Error)
	}
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n-1] + "…"
}
