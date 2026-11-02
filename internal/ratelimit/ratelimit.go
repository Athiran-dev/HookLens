// Package ratelimit is a small in-memory token-bucket limiter keyed by string.
package ratelimit

import (
	"sync"
	"time"
)

type bucket struct {
	tokens float64
	last   time.Time
}

type Limiter struct {
	mu      sync.Mutex
	buckets map[string]*bucket
}

func New() *Limiter {
	l := &Limiter{buckets: make(map[string]*bucket)}
	go l.janitor()
	return l
}

// Allow consumes one token from the bucket for key. rate is tokens/second, burst is the bucket size.
func (l *Limiter) Allow(key string, rate float64, burst int) bool {
	now := time.Now()
	l.mu.Lock()
	defer l.mu.Unlock()
	b, ok := l.buckets[key]
	if !ok {
		b = &bucket{tokens: float64(burst), last: now}
		l.buckets[key] = b
	}
	b.tokens += now.Sub(b.last).Seconds() * rate
	if b.tokens > float64(burst) {
		b.tokens = float64(burst)
	}
	b.last = now
	if b.tokens < 1 {
		return false
	}
	b.tokens--
	return true
}

func (l *Limiter) janitor() {
	for range time.Tick(5 * time.Minute) {
		cutoff := time.Now().Add(-15 * time.Minute)
		l.mu.Lock()
		for k, b := range l.buckets {
			if b.last.Before(cutoff) {
				delete(l.buckets, k)
			}
		}
		l.mu.Unlock()
	}
}
