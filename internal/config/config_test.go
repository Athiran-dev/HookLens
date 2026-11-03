package config

import "testing"

func TestListenAddr(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://x")
	cases := []struct{ addr, port, want string }{
		{"", "", ":8080"},
		{"", "9999", ":9999"},
		{":7000", "9999", ":7000"}, // an explicit ADDR wins
	}
	for _, c := range cases {
		t.Setenv("ADDR", c.addr)
		t.Setenv("PORT", c.port)
		cfg, err := Load()
		if err != nil {
			t.Fatal(err)
		}
		if cfg.Addr != c.want {
			t.Errorf("ADDR=%q PORT=%q: got %q, want %q", c.addr, c.port, cfg.Addr, c.want)
		}
	}
}

func TestPublicURLDefaults(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://x")
	t.Setenv("PUBLIC_URL", "")
	t.Setenv("RENDER_EXTERNAL_URL", "")
	cfg, _ := Load()
	if cfg.PublicURL != "http://localhost:8080" {
		t.Errorf("local default: got %q", cfg.PublicURL)
	}
	t.Setenv("RENDER_EXTERNAL_URL", "https://hooklens.onrender.com/")
	cfg, _ = Load()
	if cfg.PublicURL != "https://hooklens.onrender.com" {
		t.Errorf("Render default (trailing slash trimmed): got %q", cfg.PublicURL)
	}
	t.Setenv("PUBLIC_URL", "https://hooklens.example.com")
	cfg, _ = Load()
	if cfg.PublicURL != "https://hooklens.example.com" {
		t.Errorf("explicit PUBLIC_URL must win: got %q", cfg.PublicURL)
	}
}
