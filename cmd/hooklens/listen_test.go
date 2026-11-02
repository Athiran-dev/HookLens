package main

import (
	"context"
	"net/http"
	"net/url"
	"strings"
	"testing"
	"time"
)

func TestDescribeForwardErrorRefused(t *testing.T) {
	target, _ := url.Parse("http://127.0.0.1:1") // nothing listens on port 1
	_, err := http.Get(target.String())
	if err == nil {
		t.Skip("something is listening on port 1")
	}
	got := describeForwardError(target, err)
	if !strings.Contains(got, "nothing is listening on 127.0.0.1:1") {
		t.Fatalf("unfriendly message: %q", got)
	}
}

func TestDescribeForwardErrorTimeout(t *testing.T) {
	target, _ := url.Parse("http://localhost:3000")
	ctx, cancel := context.WithTimeout(context.Background(), time.Nanosecond)
	defer cancel()
	time.Sleep(time.Millisecond)
	if got := describeForwardError(target, ctx.Err()); !strings.Contains(got, "did not respond in time") {
		t.Fatalf("unfriendly message: %q", got)
	}
}
