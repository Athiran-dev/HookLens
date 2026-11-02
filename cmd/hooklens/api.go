package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// defaultServer can be overridden at build time:
//
//	go build -ldflags "-X main.defaultServer=https://hooklens.example.com -X main.version=1.0.0"
var (
	defaultServer = "http://localhost:8080"
	version       = "dev"
)

type fileConfig struct {
	Server string `json:"server"`
	Token  string `json:"token"`
	Email  string `json:"email"`
}

func configPath() string {
	dir, err := os.UserConfigDir()
	if err != nil {
		dir = "."
	}
	return filepath.Join(dir, "hooklens", "config.json")
}

func loadConfig() fileConfig {
	var c fileConfig
	if b, err := os.ReadFile(configPath()); err == nil {
		_ = json.Unmarshal(b, &c)
	}
	return c
}

func saveConfig(c fileConfig) error {
	p := configPath()
	if err := os.MkdirAll(filepath.Dir(p), 0o700); err != nil {
		return err
	}
	b, _ := json.MarshalIndent(c, "", "  ")
	return os.WriteFile(p, b, 0o600)
}

// resolved returns the effective server URL and token (environment beats the config file).
func resolved() (server, token string) {
	c := loadConfig()
	server, token = c.Server, c.Token
	if v := os.Getenv("HOOKLENS_SERVER"); v != "" {
		server = v
	}
	if v := os.Getenv("HOOKLENS_TOKEN"); v != "" {
		token = v
	}
	if server == "" {
		server = defaultServer
	}
	return strings.TrimRight(server, "/"), token
}

type apiError struct {
	Status  int
	Message string
}

func (e *apiError) Error() string { return e.Message }

type client struct {
	server, token string
	http          *http.Client
}

func newClient() *client {
	s, t := resolved()
	return &client{server: s, token: t, http: &http.Client{Timeout: 30 * time.Second}}
}

func (c *client) requireAuth() error {
	if c.token == "" {
		return errors.New("not logged in. Run `hooklens login` first")
	}
	return nil
}

func (c *client) do(method, path string, in, out any) error {
	var body io.Reader
	if in != nil {
		b, _ := json.Marshal(in)
		body = bytes.NewReader(b)
	}
	req, err := http.NewRequest(method, c.server+path, body)
	if err != nil {
		return err
	}
	if in != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if c.token != "" {
		req.Header.Set("Authorization", "Bearer "+c.token)
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return fmt.Errorf("cannot reach %s: %w", c.server, err)
	}
	defer resp.Body.Close()
	data, _ := io.ReadAll(io.LimitReader(resp.Body, 16<<20))
	if resp.StatusCode >= 400 {
		var e struct{ Error string }
		_ = json.Unmarshal(data, &e)
		msg := e.Error
		if msg == "" {
			msg = resp.Status
		}
		if resp.StatusCode == 401 {
			msg += " (run `hooklens login`)"
		}
		return &apiError{Status: resp.StatusCode, Message: msg}
	}
	if out != nil && len(data) > 0 {
		return json.Unmarshal(data, out)
	}
	return nil
}

// ---- API shapes used by the CLI ----

type endpointInfo struct {
	ID              string `json:"id"`
	Name            string `json:"name"`
	PublicToken     string `json:"public_token"`
	HookURL         string `json:"hook_url"`
	Status          string `json:"status"`
	ForwardURL      string `json:"forward_url"`
	RequestCount    int64  `json:"request_count"`
	TunnelConnected bool   `json:"tunnel_connected"`
}

type deliveryBrief struct {
	ID           string `json:"id"`
	Kind         string `json:"kind"`
	Status       string `json:"status"`
	ResponseCode *int   `json:"response_code"`
	DurationMS   *int   `json:"duration_ms"`
}

type requestSummary struct {
	ID         string         `json:"id"`
	EndpointID string         `json:"endpoint_id"`
	Method     string         `json:"method"`
	Path       string         `json:"path"`
	Query      string         `json:"query"`
	Size       int            `json:"size"`
	ReceivedAt time.Time      `json:"received_at"`
	Delivery   *deliveryBrief `json:"delivery"`
}
