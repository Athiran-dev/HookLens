// Package hub tracks live CLI tunnels and fans out real-time events to dashboard browsers.
//
// The two are deliberately separate: a Tunnel is the CLI<->backend transport, a Bus is the
// browser<->backend live feed.
package hub

import (
	"encoding/json"
	"errors"
	"sync"
	"sync/atomic"
	"time"

	"github.com/Athiran-dev/HookLens/internal/proto"
)

var (
	ErrNoTunnel     = errors.New("no active tunnel")
	ErrQueueFull    = errors.New("tunnel queue is full")
	ErrTimeout      = errors.New("timed out waiting for the local server")
	ErrDisconnected = errors.New("tunnel disconnected before a response arrived")
)

type pendingDelivery struct {
	done  func(proto.Message, error)
	timer *time.Timer
}

// Tunnel is one connected CLI. Requests are queued on a bounded channel; each is tracked in
// `pending` by delivery ID so the right response is matched to the right request even when many
// are in flight at once.
type Tunnel struct {
	ID          string
	EndpointID  string
	UserID      string
	ConnectedAt time.Time
	Target      string // local URL the CLI forwards to (informational)

	send       chan proto.Message
	closed     chan struct{}
	closeOnce  sync.Once
	maxPending int
	kicked     atomic.Bool

	mu      sync.Mutex
	pending map[string]*pendingDelivery
}

func NewTunnel(id, endpointID, userID string, maxPending int) *Tunnel {
	return &Tunnel{
		ID: id, EndpointID: endpointID, UserID: userID, ConnectedAt: time.Now(),
		send:       make(chan proto.Message, maxPending),
		closed:     make(chan struct{}),
		maxPending: maxPending,
		pending:    make(map[string]*pendingDelivery),
	}
}

// Outbound is drained by the connection's writer goroutine.
func (t *Tunnel) Outbound() <-chan proto.Message { return t.send }
func (t *Tunnel) Closed() <-chan struct{}        { return t.closed }

// Dispatch queues msg (type request, with DeliveryID set) for the CLI and arranges for done to be
// called exactly once: with the CLI's response, ErrTimeout, or ErrDisconnected.
// It never blocks; it returns ErrQueueFull / ErrNoTunnel immediately if it cannot enqueue.
func (t *Tunnel) Dispatch(msg proto.Message, timeout time.Duration, done func(proto.Message, error)) error {
	t.mu.Lock()
	select {
	case <-t.closed:
		t.mu.Unlock()
		return ErrNoTunnel
	default:
	}
	if len(t.pending) >= t.maxPending {
		t.mu.Unlock()
		return ErrQueueFull
	}
	id := msg.DeliveryID
	p := &pendingDelivery{done: done}
	t.pending[id] = p
	t.mu.Unlock()

	select {
	case t.send <- msg:
	default:
		t.mu.Lock()
		delete(t.pending, id)
		t.mu.Unlock()
		return ErrQueueFull
	}
	p.timer = time.AfterFunc(timeout, func() { t.complete(id, proto.Message{}, ErrTimeout) })
	return nil
}

// HandleResponse is called by the reader goroutine when the CLI answers.
func (t *Tunnel) HandleResponse(resp proto.Message) {
	t.complete(resp.DeliveryID, resp, nil)
}

func (t *Tunnel) complete(id string, resp proto.Message, err error) {
	t.mu.Lock()
	p, ok := t.pending[id]
	delete(t.pending, id)
	t.mu.Unlock()
	if !ok {
		return
	}
	if p.timer != nil {
		p.timer.Stop()
	}
	p.done(resp, err)
}

// Close marks the tunnel dead and fails everything still in flight.
func (t *Tunnel) Close() {
	t.closeOnce.Do(func() {
		close(t.closed)
		t.mu.Lock()
		drained := t.pending
		t.pending = make(map[string]*pendingDelivery)
		t.mu.Unlock()
		for _, p := range drained {
			if p.timer != nil {
				p.timer.Stop()
			}
			p.done(proto.Message{}, ErrDisconnected)
		}
	})
}

// Kick closes the tunnel on the user's request (dashboard Disconnect); the CLI is told not to reconnect.
func (t *Tunnel) Kick() {
	t.kicked.Store(true)
	t.Close()
}

func (t *Tunnel) Kicked() bool { return t.kicked.Load() }

func (t *Tunnel) PendingCount() int {
	t.mu.Lock()
	defer t.mu.Unlock()
	return len(t.pending)
}

// ---------- Hub ----------

type Hub struct {
	mu      sync.RWMutex
	tunnels map[string]*Tunnel // by endpoint ID
}

func New() *Hub { return &Hub{tunnels: make(map[string]*Tunnel)} }

// Register installs t as the tunnel for its endpoint and returns the one it replaced (caller closes it).
func (h *Hub) Register(t *Tunnel) *Tunnel {
	h.mu.Lock()
	defer h.mu.Unlock()
	old := h.tunnels[t.EndpointID]
	h.tunnels[t.EndpointID] = t
	return old
}

// Unregister removes t only if it is still the current tunnel for its endpoint.
func (h *Hub) Unregister(t *Tunnel) bool {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.tunnels[t.EndpointID] == t {
		delete(h.tunnels, t.EndpointID)
		return true
	}
	return false
}

func (h *Hub) Get(endpointID string) *Tunnel {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return h.tunnels[endpointID]
}

func (h *Hub) CountForUser(userID string) int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	n := 0
	for _, t := range h.tunnels {
		if t.UserID == userID {
			n++
		}
	}
	return n
}

type Info struct {
	Target      string    `json:"target"`
	TunnelID    string    `json:"tunnel_id"`
	EndpointID  string    `json:"endpoint_id"`
	ConnectedAt time.Time `json:"connected_at"`
	Pending     int       `json:"pending"`
}

func (h *Hub) ListForUser(userID string) []Info {
	h.mu.RLock()
	defer h.mu.RUnlock()
	out := []Info{}
	for _, t := range h.tunnels {
		if t.UserID == userID {
			out = append(out, Info{Target: t.Target, TunnelID: t.ID, EndpointID: t.EndpointID, ConnectedAt: t.ConnectedAt, Pending: t.PendingCount()})
		}
	}
	return out
}

// ---------- Bus (dashboard live feed) ----------

type Bus struct {
	mu   sync.RWMutex
	subs map[string]map[chan []byte]struct{} // userID -> subscribers
}

func NewBus() *Bus { return &Bus{subs: make(map[string]map[chan []byte]struct{})} }

// Subscribe returns a channel of JSON-encoded events for userID and a cancel func.
func (b *Bus) Subscribe(userID string) (<-chan []byte, func()) {
	ch := make(chan []byte, 64)
	b.mu.Lock()
	if b.subs[userID] == nil {
		b.subs[userID] = make(map[chan []byte]struct{})
	}
	b.subs[userID][ch] = struct{}{}
	b.mu.Unlock()
	return ch, func() {
		b.mu.Lock()
		delete(b.subs[userID], ch)
		if len(b.subs[userID]) == 0 {
			delete(b.subs, userID)
		}
		b.mu.Unlock()
	}
}

// Publish sends v to every browser of userID. Slow consumers drop events rather than block ingestion.
func (b *Bus) Publish(userID string, v any) {
	data, err := json.Marshal(v)
	if err != nil {
		return
	}
	b.mu.RLock()
	defer b.mu.RUnlock()
	for ch := range b.subs[userID] {
		select {
		case ch <- data:
		default:
		}
	}
}
