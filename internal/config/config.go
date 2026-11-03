// Package config loads HookLens server settings from the environment (and an optional .env file).
package config

import (
	"bufio"
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	Addr                string
	DatabaseURL         string
	PublicURL           string
	WebOrigin           string
	StaticDir           string
	MaxBodyBytes        int64
	RetentionDays       int
	MaxEndpointsPerUser int
	MaxTunnelsPerUser   int
	ForwardTimeout      time.Duration
	TrustProxy          bool
	SecureCookies       bool
	AllowSignup         bool
	AdminEmails         []string // accounts that can read feedback in the dashboard
}

// Load reads .env (if present) without overriding real environment variables, then builds the Config.
func Load() (*Config, error) {
	LoadDotEnv(".env")
	c := &Config{
		Addr:                str("ADDR", ":8080"),
		DatabaseURL:         str("DATABASE_URL", ""),
		PublicURL:           strings.TrimRight(str("PUBLIC_URL", "http://localhost:8080"), "/"),
		WebOrigin:           strings.TrimRight(str("WEB_ORIGIN", ""), "/"),
		StaticDir:           str("STATIC_DIR", "web/out"),
		MaxBodyBytes:        int64(num("MAX_BODY_BYTES", 1<<20)),
		RetentionDays:       num("RETENTION_DAYS", 7),
		MaxEndpointsPerUser: num("MAX_ENDPOINTS_PER_USER", 10),
		MaxTunnelsPerUser:   num("MAX_TUNNELS_PER_USER", 5),
		ForwardTimeout:      time.Duration(num("FORWARD_TIMEOUT_SECONDS", 30)) * time.Second,
		TrustProxy:          boolean("TRUST_PROXY", false),
		SecureCookies:       boolean("SECURE_COOKIES", false),
		AllowSignup:         boolean("ALLOW_SIGNUP", true),
		AdminEmails:         splitList(str("ADMIN_EMAILS", "")),
	}
	if c.DatabaseURL == "" {
		return nil, fmt.Errorf("DATABASE_URL is required (see .env.example)")
	}
	return c, nil
}

func str(k, def string) string {
	if v, ok := os.LookupEnv(k); ok && v != "" {
		return v
	}
	return def
}

func num(k string, def int) int {
	if v, ok := os.LookupEnv(k); ok {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return def
}

func boolean(k string, def bool) bool {
	if v, ok := os.LookupEnv(k); ok {
		if b, err := strconv.ParseBool(v); err == nil {
			return b
		}
	}
	return def
}

func LoadDotEnv(path string) {
	f, err := os.Open(path)
	if err != nil {
		return
	}
	defer f.Close()
	sc := bufio.NewScanner(f)
	for sc.Scan() {
		line := strings.TrimSpace(sc.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		k, v, ok := strings.Cut(line, "=")
		if !ok {
			continue
		}
		k, v = strings.TrimSpace(k), strings.Trim(strings.TrimSpace(v), `"'`)
		if _, set := os.LookupEnv(k); !set {
			os.Setenv(k, v)
		}
	}
}

func splitList(v string) []string {
	var out []string
	for _, p := range strings.Split(v, ",") {
		if p = strings.ToLower(strings.TrimSpace(p)); p != "" {
			out = append(out, p)
		}
	}
	return out
}
