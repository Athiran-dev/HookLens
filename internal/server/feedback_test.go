package server

import (
	"fmt"
	"strings"
	"testing"
)

func TestCleanFeedback(t *testing.T) {
	good := []string{
		"The replay button is great, but please add a search box.",
		"यह टूल बहुत अच्छा है धन्यवाद आपका",
		"Bug: the Response tab is empty after I replay a request twice",
		"Line one is fine.\n\n\n\nLine two after blank lines is also fine",
	}
	for _, m := range good {
		if _, err := cleanFeedback(m); err != nil {
			t.Errorf("rejected real feedback %q: %v", m, err)
		}
	}

	bad := map[string]string{
		"too short":          "hi there",
		"empty":              "      ",
		"repeated character": "aaaaaaaaaaaaaaaaaaaa",
		"keyboard mash":      "asdf asdf asdf asdf",
		"two letters":        "ok ok ok ok ok ok ok ok",
		"symbols only":       "!!!! ???? #### @@@@ $$$$ %%%%",
		"one word":           "supercalifragilistic",
		"link spam":          "http://a.com http://b.com http://c.com nice tool",
		"too long":           strings.Repeat("a helpful sentence about the product. ", 30),
	}
	for name, m := range bad {
		if _, err := cleanFeedback(m); err == nil {
			t.Errorf("%s: junk was accepted: %q", name, m)
		}
	}

	// control characters are stripped, length counted in characters not bytes
	got, err := cleanFeedback("Hello\x00 there\x07, this is fine feedback")
	if err != nil || strings.ContainsAny(got, "\x00\x07") {
		t.Errorf("control characters not stripped: %q %v", got, err)
	}
	exactly1000 := strings.Repeat("word ", 199) + "word!"
	if len([]rune(exactly1000)) != 1000 {
		t.Fatalf("test setup: %d runes", len([]rune(exactly1000)))
	}
	if _, err := cleanFeedback(exactly1000); err != nil {
		t.Errorf("exactly 1000 characters should be allowed: %v", err)
	}
	if _, err := cleanFeedback(exactly1000 + "x"); err == nil {
		t.Errorf("1001 characters should be rejected")
	}
}

func TestFeedbackFlow(t *testing.T) {
	e := newEnv(t)
	a := e.signup()
	msg := "The replay button is great, but please add a search box."

	if code, _ := (&user{e: e, http: a.http}).call("POST", "/api/v1/feedback", map[string]string{"category": "idea", "message": msg}); code != 201 {
		// a.http carries the session cookie, so this is an authenticated call
		t.Fatalf("valid feedback: want 201 got %d", code)
	}
	checks := []struct {
		name string
		in   map[string]string
		want int
	}{
		{"too short", map[string]string{"category": "bug", "message": "hi there"}, 400},
		{"junk", map[string]string{"category": "bug", "message": "aaaaaaaaaaaaaaaaaaaa"}, 400},
		{"duplicate", map[string]string{"category": "idea", "message": msg}, 409},
		{"bad category", map[string]string{"category": "spam", "message": "A perfectly fine sentence here"}, 400},
		{"rate limited", map[string]string{"category": "idea", "message": "Another perfectly fine sentence here"}, 429},
	}
	for _, c := range checks {
		if code, body := a.call("POST", "/api/v1/feedback", c.in); code != c.want {
			t.Fatalf("%s: want %d got %d %v", c.name, c.want, code, body)
		}
	}

	anon := &user{e: e, http: e.signup().http}
	anon.http.Jar = nil
	if code, _ := anon.call("POST", "/api/v1/feedback", map[string]string{"category": "idea", "message": msg}); code != 401 {
		t.Fatalf("anonymous feedback: want 401 got %d", code)
	}

	// only admins can read it
	if code, _ := a.call("GET", "/api/v1/admin/feedback", nil); code != 403 {
		t.Fatalf("non-admin list: want 403 got %d", code)
	}
	admin := e.signup()
	e.cfg.AdminEmails = []string{admin.email}
	defer func() { e.cfg.AdminEmails = nil }()
	if code, body := admin.call("POST", "/api/v1/feedback", map[string]string{"category": "bug", "message": strings.Repeat("this is a long message that goes past the limit ", 30)}); code != 400 {
		t.Fatalf("1000+ chars: want 400 got %d %v", code, body)
	}
	if code, _ := admin.call("POST", "/api/v1/feedback", map[string]string{"category": "question", "message": "How do I replay requests to a different port?"}); code != 201 {
		t.Fatalf("admin feedback: want 201")
	}
	_, me := admin.call("GET", "/api/v1/me", nil)
	if me["is_admin"] != true {
		t.Fatalf("is_admin not reported: %v", me)
	}
	rows := admin.list("/api/v1/admin/feedback")
	if len(rows) == 0 || !strings.Contains(fmt.Sprint(rows[0]["message"]), "replay requests") {
		t.Fatalf("admin list missing the message: %v", rows)
	}
	if code, _ := admin.call("DELETE", "/api/v1/admin/feedback/"+rows[0]["id"].(string), nil); code != 200 {
		t.Fatalf("admin delete failed")
	}
}
