// Package proto defines the JSON messages exchanged over the CLI tunnel WebSocket.
package proto

const (
	TypeReady    = "ready"    // server -> CLI, sent once after the handshake
	TypeRequest  = "request"  // server -> CLI, a webhook to forward to localhost
	TypeResponse = "response" // CLI -> server, the local server's answer (or an error)
)

// Message is the single envelope used in both directions. []byte fields are base64 in JSON,
// so raw bodies survive the trip byte-for-byte.
type Message struct {
	Type string `json:"type"`

	// ready
	TunnelID     string `json:"tunnel_id,omitempty"`
	EndpointID   string `json:"endpoint_id,omitempty"`
	EndpointName string `json:"endpoint_name,omitempty"`
	PublicURL    string `json:"public_url,omitempty"`

	// request / response correlation
	DeliveryID string `json:"delivery_id,omitempty"`

	// request
	Method  string              `json:"method,omitempty"`
	Path    string              `json:"path,omitempty"`
	Query   string              `json:"query,omitempty"`
	Headers map[string][]string `json:"headers,omitempty"`
	Body    []byte              `json:"body,omitempty"`

	// response
	Status     int    `json:"status,omitempty"`
	DurationMS int    `json:"duration_ms,omitempty"`
	Error      string `json:"error,omitempty"`
}
