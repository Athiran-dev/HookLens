package store

import (
	"context"
	"time"
)

// ActivityPoint is one bucket of traffic for the dashboard chart.
type ActivityPoint struct {
	Bucket    time.Time `json:"bucket"`
	Requests  int       `json:"requests"`
	Delivered int       `json:"delivered"`
	Failed    int       `json:"failed"`
}

// ActivityRanges maps the dashboard range selector to (bucket size, bucket count).
var ActivityRanges = map[string]struct {
	Step string
	N    int
}{
	"1h":  {"5 minutes", 12},
	"24h": {"1 hour", 24},
	"7d":  {"6 hours", 28},
	"30d": {"1 day", 30},
}

const activitySQL = `
WITH p AS (SELECT $2::interval AS step, $3::int AS n),
bounds AS (SELECT date_bin(step, now(), TIMESTAMPTZ 'epoch') AS last, step, n FROM p)
SELECT g.b, coalesce(r.n,0), coalesce(dd.n,0), coalesce(df.n,0)
FROM bounds,
     generate_series(bounds.last - bounds.step * (bounds.n - 1), bounds.last, bounds.step) AS g(b)
LEFT JOIN (
  SELECT date_bin((SELECT step FROM p), r.received_at, TIMESTAMPTZ 'epoch') AS b, count(*) AS n
  FROM requests r JOIN endpoints e ON e.id=r.endpoint_id JOIN workspaces w ON w.id=e.workspace_id
  WHERE w.owner_id=$1 AND r.received_at >= (SELECT last - step * (n - 1) FROM bounds) GROUP BY 1
) r ON r.b = g.b
LEFT JOIN (
  SELECT date_bin((SELECT step FROM p), d.created_at, TIMESTAMPTZ 'epoch') AS b, count(*) AS n
  FROM deliveries d JOIN requests r ON r.id=d.request_id JOIN endpoints e ON e.id=r.endpoint_id JOIN workspaces w ON w.id=e.workspace_id
  WHERE w.owner_id=$1 AND d.status='delivered' AND d.created_at >= (SELECT last - step * (n - 1) FROM bounds) GROUP BY 1
) dd ON dd.b = g.b
LEFT JOIN (
  SELECT date_bin((SELECT step FROM p), d.created_at, TIMESTAMPTZ 'epoch') AS b, count(*) AS n
  FROM deliveries d JOIN requests r ON r.id=d.request_id JOIN endpoints e ON e.id=r.endpoint_id JOIN workspaces w ON w.id=e.workspace_id
  WHERE w.owner_id=$1 AND d.status='failed' AND d.created_at >= (SELECT last - step * (n - 1) FROM bounds) GROUP BY 1
) df ON df.b = g.b
ORDER BY g.b`

// Activity returns zero-filled buckets (oldest first) for the given range key (1h, 24h, 7d, 30d).
func (s *Store) Activity(ctx context.Context, userID, rng string) ([]ActivityPoint, error) {
	cfg, ok := ActivityRanges[rng]
	if !ok {
		cfg = ActivityRanges["24h"]
	}
	rows, err := s.pool.Query(ctx, activitySQL, userID, cfg.Step, cfg.N)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []ActivityPoint{}
	for rows.Next() {
		var p ActivityPoint
		if err := rows.Scan(&p.Bucket, &p.Requests, &p.Delivered, &p.Failed); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

// WindowStats are the last-24h numbers plus the 24h before that (for trend arrows).
type WindowStats struct {
	Requests      int64 `json:"requests"`
	PrevRequests  int64 `json:"prev_requests"`
	Delivered     int64 `json:"delivered"`
	PrevDelivered int64 `json:"prev_delivered"`
	Failed        int64 `json:"failed"`
	PrevFailed    int64 `json:"prev_failed"`
}

func (s *Store) WindowStats(ctx context.Context, userID string) (WindowStats, error) {
	var w WindowStats
	err := s.pool.QueryRow(ctx, `
		SELECT
		  count(*) FILTER (WHERE r.received_at >= now() - interval '24 hours'),
		  count(*) FILTER (WHERE r.received_at <  now() - interval '24 hours')
		FROM requests r JOIN endpoints e ON e.id=r.endpoint_id JOIN workspaces w ON w.id=e.workspace_id
		WHERE w.owner_id=$1 AND r.received_at >= now() - interval '48 hours'`, userID).Scan(&w.Requests, &w.PrevRequests)
	if err != nil {
		return w, err
	}
	err = s.pool.QueryRow(ctx, `
		SELECT
		  count(*) FILTER (WHERE d.status='delivered' AND d.created_at >= now() - interval '24 hours'),
		  count(*) FILTER (WHERE d.status='delivered' AND d.created_at <  now() - interval '24 hours'),
		  count(*) FILTER (WHERE d.status='failed'    AND d.created_at >= now() - interval '24 hours'),
		  count(*) FILTER (WHERE d.status='failed'    AND d.created_at <  now() - interval '24 hours')
		FROM deliveries d JOIN requests r ON r.id=d.request_id JOIN endpoints e ON e.id=r.endpoint_id JOIN workspaces w ON w.id=e.workspace_id
		WHERE w.owner_id=$1 AND d.created_at >= now() - interval '48 hours'`, userID).Scan(&w.Delivered, &w.PrevDelivered, &w.Failed, &w.PrevFailed)
	return w, err
}

// DeliveryRow is one delivery with enough request/endpoint context for list pages.
type DeliveryRow struct {
	ID           string    `json:"id"`
	Kind         string    `json:"kind"`
	Status       string    `json:"status"`
	Destination  string    `json:"destination"`
	ResponseCode *int      `json:"response_code"`
	DurationMS   *int      `json:"duration_ms"`
	Error        string    `json:"error"`
	CreatedAt    time.Time `json:"created_at"`
	RequestID    string    `json:"request_id"`
	EndpointID   string    `json:"endpoint_id"`
	EndpointName string    `json:"endpoint_name"`
	Method       string    `json:"method"`
	Path         string    `json:"path"`
}

// ListDeliveries lists a user's deliveries newest first; kind is "forward", "replay" or "" for all.
func (s *Store) ListDeliveries(ctx context.Context, userID, kind string, limit int) ([]DeliveryRow, error) {
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	rows, err := s.pool.Query(ctx, `
		SELECT d.id, d.kind, d.status, d.destination, d.response_code, d.duration_ms, d.error, d.created_at,
		       r.id, e.id, e.name, r.method, r.path
		FROM deliveries d JOIN requests r ON r.id=d.request_id JOIN endpoints e ON e.id=r.endpoint_id JOIN workspaces w ON w.id=e.workspace_id
		WHERE w.owner_id=$1 AND ($2 = '' OR d.kind=$2)
		ORDER BY d.created_at DESC LIMIT $3`, userID, kind, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []DeliveryRow{}
	for rows.Next() {
		var d DeliveryRow
		if err := rows.Scan(&d.ID, &d.Kind, &d.Status, &d.Destination, &d.ResponseCode, &d.DurationMS, &d.Error, &d.CreatedAt,
			&d.RequestID, &d.EndpointID, &d.EndpointName, &d.Method, &d.Path); err != nil {
			return nil, err
		}
		out = append(out, d)
	}
	return out, rows.Err()
}
