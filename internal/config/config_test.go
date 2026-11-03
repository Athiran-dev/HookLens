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
