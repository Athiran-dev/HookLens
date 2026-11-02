package store

import (
	"encoding/json"
	"time"
)

type User struct {
	ID            string    `json:"id"`
	Email         string    `json:"email"`
	PasswordHash  string    `json:"-"`
	RetentionDays int       `json:"retention_days"`
	CreatedAt     time.Time `json:"created_at"`
}

type Endpoint struct {
	ID            string     `json:"id"`
	WorkspaceID   string     `json:"workspace_id"`
	PublicToken   string     `json:"public_token"`
	Name          string     `json:"name"`
	Status        string     `json:"status"`
	ForwardURL    string     `json:"forward_url"`
	RequestCount  int64      `json:"request_count"`
	LastRequestAt *time.Time `json:"last_request_at"`
	CreatedAt     time.Time  `json:"created_at"`
	// filled in by the HTTP layer
	HookURL         string `json:"hook_url"`
	TunnelConnected bool   `json:"tunnel_connected"`
}

type Request struct {
	ID          string              `json:"id"`
	EndpointID  string              `json:"endpoint_id"`
	Method      string              `json:"method"`
	Path        string              `json:"path"`
	Query       string              `json:"query"`
	Headers     map[string][]string `json:"headers"`
	Body        []byte              `json:"-"`
	ContentType string              `json:"content_type"`
	SourceIP    string              `json:"source_ip"`
	Size        int                 `json:"size"`
	ReceivedAt  time.Time           `json:"received_at"`
}

type Delivery struct {
	ID              string              `json:"id"`
	RequestID       string              `json:"request_id"`
	Kind            string              `json:"kind"`
	Status          string              `json:"status"`
	Destination     string              `json:"destination"`
	ResponseCode    *int                `json:"response_code"`
	ResponseHeaders map[string][]string `json:"response_headers"`
	ResponseBody    []byte              `json:"-"`
	DurationMS      *int                `json:"duration_ms"`
	Error           string              `json:"error"`
	CreatedAt       time.Time           `json:"created_at"`
	CompletedAt     *time.Time          `json:"completed_at"`
}

// DeliveryBrief is the latest delivery shown in request lists.
type DeliveryBrief struct {
	ID           string `json:"id"`
	Kind         string `json:"kind"`
	Status       string `json:"status"`
	ResponseCode *int   `json:"response_code"`
	DurationMS   *int   `json:"duration_ms"`
}

type RequestSummary struct {
	ID          string         `json:"id"`
	EndpointID  string         `json:"endpoint_id"`
	Method      string         `json:"method"`
	Path        string         `json:"path"`
	Query       string         `json:"query"`
	ContentType string         `json:"content_type"`
	Size        int            `json:"size"`
	SourceIP    string         `json:"source_ip"`
	ReceivedAt  time.Time      `json:"received_at"`
	Delivery    *DeliveryBrief `json:"delivery"`
}

type Stats struct {
	Endpoints int64 `json:"endpoints"`
	Requests  int64 `json:"requests"`
	Delivered int64 `json:"delivered"`
	Failed    int64 `json:"failed"`
}

func mustJSON(v any) []byte {
	b, err := json.Marshal(v)
	if err != nil {
		return []byte("{}")
	}
	return b
}
