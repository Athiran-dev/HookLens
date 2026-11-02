// Command hooklens is the HookLens CLI: log in, expose a local port, inspect and replay webhooks.
package main

import (
	"errors"
	"flag"
	"fmt"
	"io"
	"net/url"
	"os"
	"os/exec"
	"runtime"
	"strings"
	"text/tabwriter"
	"time"
)

const usage = `HookLens - receive, inspect and replay webhooks on localhost

Usage:
  hooklens login [--server URL] [--token TOKEN]   Authenticate (opens your browser)
  hooklens logout                                 Remove local credentials
  hooklens listen <port|url> [--endpoint NAME]    Start a tunnel to your local server
  hooklens endpoints [create NAME [--forward URL]] List or create endpoints
  hooklens requests [--endpoint NAME] [-n 20]     Show recent requests
  hooklens replay <request-id>                    Replay a stored request to your tunnel
  hooklens status                                 Show connection status
  hooklens version                                Print the version

Environment: HOOKLENS_SERVER, HOOKLENS_TOKEN override the saved login.
`

func main() {
	if len(os.Args) < 2 {
		fmt.Print(usage)
		os.Exit(2)
	}
	cmd, args := os.Args[1], os.Args[2:]
	var err error
	switch cmd {
	case "login":
		err = cmdLogin(args)
	case "logout":
		err = cmdLogout()
	case "listen":
		err = cmdListen(args)
	case "endpoints":
		err = cmdEndpoints(args)
	case "requests":
		err = cmdRequests(args)
	case "replay":
		err = cmdReplay(args)
	case "status":
		err = cmdStatus()
	case "version", "--version", "-v":
		fmt.Println("hooklens", version)
	case "help", "--help", "-h":
		fmt.Print(usage)
	default:
		fmt.Fprintf(os.Stderr, "unknown command %q\n\n%s", cmd, usage)
		os.Exit(2)
	}
	if err != nil {
		fmt.Fprintln(os.Stderr, "Error:", err)
		os.Exit(1)
	}
}

// ---------- helpers ----------

func newFlagSet(name string) *flag.FlagSet {
	fs := flag.NewFlagSet(name, flag.ContinueOnError)
	fs.SetOutput(io.Discard)
	return fs
}

// parseInterspersed parses flags that may appear before or after positional arguments.
func parseInterspersed(fs *flag.FlagSet, args []string) []string {
	var pos []string
	for {
		if err := fs.Parse(args); err != nil {
			fmt.Fprintln(os.Stderr, "Error:", err)
			os.Exit(2)
		}
		if fs.NArg() == 0 {
			return pos
		}
		pos = append(pos, fs.Arg(0))
		args = fs.Args()[1:]
	}
}

func paint(s, code string) string {
	if os.Getenv("NO_COLOR") != "" || !isTerminal() || (runtime.GOOS == "windows" && os.Getenv("WT_SESSION") == "" && os.Getenv("TERM") == "") {
		return s
	}
	return "\x1b[" + code + "m" + s + "\x1b[0m"
}

func openBrowser(u string) {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "windows":
		cmd = exec.Command("rundll32", "url.dll,FileProtocolHandler", u)
	case "darwin":
		cmd = exec.Command("open", u)
	default:
		cmd = exec.Command("xdg-open", u)
	}
	_ = cmd.Start()
}

func relTime(t time.Time) string {
	d := time.Since(t)
	switch {
	case d < time.Minute:
		return fmt.Sprintf("%ds ago", int(d.Seconds()))
	case d < time.Hour:
		return fmt.Sprintf("%dm ago", int(d.Minutes()))
	case d < 48*time.Hour:
		return fmt.Sprintf("%dh ago", int(d.Hours()))
	}
	return t.Format("2006-01-02")
}

// ---------- commands ----------

func cmdLogin(args []string) error {
	fs := newFlagSet("login")
	serverFlag := fs.String("server", "", "HookLens server URL")
	tokenFlag := fs.String("token", "", "use an API key instead of the browser flow")
	parseInterspersed(fs, args)

	cfg := loadConfig()
	if *serverFlag != "" {
		cfg.Server = strings.TrimRight(*serverFlag, "/")
	}
	if cfg.Server == "" {
		cfg.Server = defaultServer
	}
	c := &client{server: resolvedServer(cfg), http: newClient().http}

	if *tokenFlag != "" {
		c.token = *tokenFlag
		var me struct{ User struct{ Email string } }
		if err := c.do("GET", "/api/v1/me", nil, &me); err != nil {
			return fmt.Errorf("that token was rejected: %w", err)
		}
		cfg.Token, cfg.Email = *tokenFlag, me.User.Email
		if err := saveConfig(cfg); err != nil {
			return err
		}
		fmt.Printf("✓ Logged in as %s\n", cfg.Email)
		return nil
	}

	var start struct {
		DeviceCode      string `json:"device_code"`
		UserCode        string `json:"user_code"`
		VerificationURL string `json:"verification_url"`
		ExpiresIn       int    `json:"expires_in"`
		Interval        int    `json:"interval"`
	}
	if err := c.do("POST", "/api/v1/cli/auth/start", struct{}{}, &start); err != nil {
		return err
	}
	fmt.Printf("Opening your browser to authenticate.\nIf it doesn't open, visit:\n\n  %s\n\nConfirmation code: %s\n\nWaiting for approval...\n", start.VerificationURL, start.UserCode)
	openBrowser(start.VerificationURL)

	interval := time.Duration(max(start.Interval, 1)) * time.Second
	deadline := time.Now().Add(time.Duration(start.ExpiresIn) * time.Second)
	for time.Now().Before(deadline) {
		time.Sleep(interval)
		var res struct{ Status, Token, Email string }
		err := c.do("POST", "/api/v1/cli/auth/poll", map[string]string{"device_code": start.DeviceCode}, &res)
		var ae *apiError
		if errors.As(err, &ae) && ae.Status == 410 {
			return errors.New("login expired; run `hooklens login` again")
		}
		if err != nil {
			continue // transient network error: keep polling
		}
		if res.Status == "approved" {
			cfg.Token, cfg.Email = res.Token, res.Email
			if err := saveConfig(cfg); err != nil {
				return err
			}
			fmt.Printf("\n✓ Logged in as %s\n", res.Email)
			return nil
		}
	}
	return errors.New("timed out waiting for approval")
}

func resolvedServer(cfg fileConfig) string {
	if v := os.Getenv("HOOKLENS_SERVER"); v != "" {
		return strings.TrimRight(v, "/")
	}
	return strings.TrimRight(cfg.Server, "/")
}

func cmdLogout() error {
	cfg := loadConfig()
	if cfg.Token != "" {
		c := newClient()
		_ = c.do("POST", "/api/v1/auth/logout", struct{}{}, nil) // revokes the bearer token server-side
	}
	cfg.Token, cfg.Email = "", ""
	if err := saveConfig(cfg); err != nil {
		return err
	}
	fmt.Println("✓ Logged out. Local credentials removed.")
	return nil
}

func cmdEndpoints(args []string) error {
	c := newClient()
	if err := c.requireAuth(); err != nil {
		return err
	}
	if len(args) > 0 && args[0] == "create" {
		fs := newFlagSet("endpoints create")
		fwd := fs.String("forward", "", "default local URL for this endpoint")
		pos := parseInterspersed(fs, args[1:])
		if len(pos) != 1 {
			return errors.New("usage: hooklens endpoints create NAME [--forward URL]")
		}
		var e endpointInfo
		if err := c.do("POST", "/api/v1/endpoints", map[string]string{"name": pos[0], "forward_url": *fwd}, &e); err != nil {
			return err
		}
		fmt.Printf("✓ Created %s\n  %s\n", e.Name, e.HookURL)
		return nil
	}
	var eps []endpointInfo
	if err := c.do("GET", "/api/v1/endpoints", nil, &eps); err != nil {
		return err
	}
	if len(eps) == 0 {
		fmt.Println("No endpoints yet. Run `hooklens listen 3000` or `hooklens endpoints create NAME`.")
		return nil
	}
	tw := tabwriter.NewWriter(os.Stdout, 0, 4, 2, ' ', 0)
	fmt.Fprintln(tw, "NAME\tSTATUS\tREQUESTS\tTUNNEL\tURL")
	for _, e := range eps {
		tunnel := "-"
		if e.TunnelConnected {
			tunnel = "connected"
		}
		fmt.Fprintf(tw, "%s\t%s\t%d\t%s\t%s\n", e.Name, e.Status, e.RequestCount, tunnel, e.HookURL)
	}
	return tw.Flush()
}

func cmdRequests(args []string) error {
	fs := newFlagSet("requests")
	endpointFlag := fs.String("endpoint", "", "endpoint name, id or token")
	n := fs.Int("n", 20, "how many requests to show")
	parseInterspersed(fs, args)
	c := newClient()
	if err := c.requireAuth(); err != nil {
		return err
	}
	q := url.Values{"limit": {fmt.Sprint(*n)}}
	if *endpointFlag != "" {
		ep, err := pickEndpoint(c, *endpointFlag)
		if err != nil {
			return err
		}
		q.Set("endpoint_id", ep.ID)
	}
	var reqs []requestSummary
	if err := c.do("GET", "/api/v1/requests?"+q.Encode(), nil, &reqs); err != nil {
		return err
	}
	if len(reqs) == 0 {
		fmt.Println("No requests captured yet.")
		return nil
	}
	tw := tabwriter.NewWriter(os.Stdout, 0, 4, 2, ' ', 0)
	fmt.Fprintln(tw, "RECEIVED\tMETHOD\tPATH\tDELIVERY\tTIME\tID")
	for _, r := range reqs {
		delivery, ms := "-", "-"
		if r.Delivery != nil {
			delivery = r.Delivery.Status
			if r.Delivery.ResponseCode != nil {
				delivery += fmt.Sprintf(" (%d)", *r.Delivery.ResponseCode)
			}
			if r.Delivery.DurationMS != nil {
				ms = fmt.Sprintf("%dms", *r.Delivery.DurationMS)
			}
		}
		fmt.Fprintf(tw, "%s\t%s\t%s\t%s\t%s\t%s\n", relTime(r.ReceivedAt), r.Method, truncate(r.Path, 36), delivery, ms, r.ID)
	}
	return tw.Flush()
}

func cmdReplay(args []string) error {
	if len(args) != 1 {
		return errors.New("usage: hooklens replay <request-id>")
	}
	c := newClient()
	if err := c.requireAuth(); err != nil {
		return err
	}
	fmt.Println("Note: replaying re-sends the original payload; make sure your handler is idempotent.")
	var d struct {
		ID, Status, Error string
	}
	err := c.do("POST", "/api/v1/requests/"+args[0]+"/replay", struct{}{}, &d)
	var ae *apiError
	if errors.As(err, &ae) && ae.Status == 409 {
		return errors.New("no tunnel is connected for this endpoint; start `hooklens listen <port>` and try again")
	}
	if err != nil {
		return err
	}
	for i := 0; i < 30 && d.Status == "pending"; i++ {
		time.Sleep(500 * time.Millisecond)
		var det struct {
			Deliveries []struct {
				ID           string
				Status       string
				ResponseCode *int `json:"response_code"`
				DurationMS   *int `json:"duration_ms"`
				Error        string
			}
		}
		if err := c.do("GET", "/api/v1/requests/"+args[0], nil, &det); err != nil {
			return err
		}
		for _, x := range det.Deliveries {
			if x.ID == d.ID && x.Status != "pending" {
				d.Status, d.Error = x.Status, x.Error
				if x.ResponseCode != nil {
					fmt.Printf("Response: HTTP %d in %dms\n", *x.ResponseCode, derefInt(x.DurationMS))
				}
			}
		}
	}
	if d.Status == "delivered" {
		fmt.Println("✓ Replay delivered")
		return nil
	}
	if d.Status == "pending" {
		fmt.Println("Replay is still pending; check the dashboard for the result.")
		return nil
	}
	return fmt.Errorf("replay %s: %s", d.Status, d.Error)
}

func derefInt(p *int) int {
	if p == nil {
		return 0
	}
	return *p
}

func cmdStatus() error {
	c := newClient()
	fmt.Println("Server:  ", c.server)
	if c.token == "" {
		fmt.Println("Auth:     not logged in (run `hooklens login`)")
		return nil
	}
	var me struct{ User struct{ Email string } }
	if err := c.do("GET", "/api/v1/me", nil, &me); err != nil {
		fmt.Println("Auth:     token rejected -", err)
		return nil
	}
	fmt.Println("Auth:     logged in as", me.User.Email)
	var eps []endpointInfo
	if err := c.do("GET", "/api/v1/endpoints", nil, &eps); err != nil {
		return err
	}
	active := 0
	for _, e := range eps {
		if e.TunnelConnected {
			active++
		}
	}
	fmt.Printf("Endpoints: %d (%d with a connected tunnel)\n", len(eps), active)
	return nil
}

func isTerminal() bool {
	st, err := os.Stdout.Stat()
	return err == nil && st.Mode()&os.ModeCharDevice != 0
}
