package hub

import (
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/hooklens/hooklens/internal/proto"
)

func TestDispatchAndResponseMatchesDeliveryID(t *testing.T) {
	tun := NewTunnel("t1", "e1", "u1", 8)
	var wg sync.WaitGroup
	got := make(map[string]int)
	var mu sync.Mutex
	for _, id := range []string{"a", "b", "c"} {
		id := id
		wg.Add(1)
		err := tun.Dispatch(proto.Message{Type: proto.TypeRequest, DeliveryID: id}, time.Second, func(m proto.Message, err error) {
			defer wg.Done()
			mu.Lock()
			got[id] = m.Status
			mu.Unlock()
		})
		if err != nil {
			t.Fatal(err)
		}
	}
	// answer out of order
	tun.HandleResponse(proto.Message{DeliveryID: "c", Status: 203})
	tun.HandleResponse(proto.Message{DeliveryID: "a", Status: 201})
	tun.HandleResponse(proto.Message{DeliveryID: "b", Status: 202})
	wg.Wait()
	if got["a"] != 201 || got["b"] != 202 || got["c"] != 203 {
		t.Fatalf("responses mismatched: %v", got)
	}
}

func TestQueueBounded(t *testing.T) {
	tun := NewTunnel("t1", "e1", "u1", 2)
	noop := func(proto.Message, error) {}
	for _, id := range []string{"a", "b"} {
		if err := tun.Dispatch(proto.Message{DeliveryID: id}, time.Minute, noop); err != nil {
			t.Fatal(err)
		}
	}
	if err := tun.Dispatch(proto.Message{DeliveryID: "c"}, time.Minute, noop); !errors.Is(err, ErrQueueFull) {
		t.Fatalf("want ErrQueueFull, got %v", err)
	}
}

func TestTimeout(t *testing.T) {
	tun := NewTunnel("t1", "e1", "u1", 2)
	ch := make(chan error, 1)
	_ = tun.Dispatch(proto.Message{DeliveryID: "a"}, 30*time.Millisecond, func(_ proto.Message, err error) { ch <- err })
	select {
	case err := <-ch:
		if !errors.Is(err, ErrTimeout) {
			t.Fatalf("want ErrTimeout, got %v", err)
		}
	case <-time.After(time.Second):
		t.Fatal("no timeout callback")
	}
}

func TestCloseFailsPendingExactlyOnce(t *testing.T) {
	tun := NewTunnel("t1", "e1", "u1", 4)
	calls := 0
	var mu sync.Mutex
	_ = tun.Dispatch(proto.Message{DeliveryID: "a"}, time.Minute, func(_ proto.Message, err error) {
		mu.Lock()
		calls++
		mu.Unlock()
		if !errors.Is(err, ErrDisconnected) {
			t.Errorf("want ErrDisconnected, got %v", err)
		}
	})
	tun.Close()
	tun.Close()
	tun.HandleResponse(proto.Message{DeliveryID: "a"}) // late response must be ignored
	mu.Lock()
	defer mu.Unlock()
	if calls != 1 {
		t.Fatalf("done called %d times", calls)
	}
	if err := tun.Dispatch(proto.Message{DeliveryID: "b"}, time.Second, func(proto.Message, error) {}); !errors.Is(err, ErrNoTunnel) {
		t.Fatalf("want ErrNoTunnel after close, got %v", err)
	}
}

func TestHubReplaceAndUnregister(t *testing.T) {
	h := New()
	a := NewTunnel("a", "e1", "u1", 1)
	b := NewTunnel("b", "e1", "u1", 1)
	if old := h.Register(a); old != nil {
		t.Fatal("unexpected old tunnel")
	}
	if old := h.Register(b); old != a {
		t.Fatal("expected a to be replaced")
	}
	if h.Unregister(a) {
		t.Fatal("stale tunnel must not unregister the current one")
	}
	if h.Get("e1") != b || h.CountForUser("u1") != 1 {
		t.Fatal("current tunnel lost")
	}
}

func TestBusPublishAndCancel(t *testing.T) {
	b := NewBus()
	ch, cancel := b.Subscribe("u1")
	b.Publish("u1", map[string]string{"type": "x"})
	b.Publish("u2", map[string]string{"type": "other"})
	select {
	case m := <-ch:
		if string(m) != `{"type":"x"}` {
			t.Fatalf("got %s", m)
		}
	case <-time.After(time.Second):
		t.Fatal("no event")
	}
	cancel()
	b.Publish("u1", "after-cancel") // must not panic or block
}
