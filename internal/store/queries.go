package store

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

var (
	ErrEmailTaken = errors.New("email already registered")
	ErrLimit      = errors.New("limit reached")
)

// ---------- users ----------

func (s *Store) CreateUser(ctx context.Context, email, hash string) (*User, error) {
	var u User
	err := pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		err := tx.QueryRow(ctx,
			`INSERT INTO users(email, password_hash) VALUES($1,$2)
			 RETURNING id, email, password_hash, retention_days, created_at`, email, hash).
			Scan(&u.ID, &u.Email, &u.PasswordHash, &u.RetentionDays, &u.CreatedAt)
		if err != nil {
			return err
		}
		_, err = tx.Exec(ctx, `INSERT INTO workspaces(owner_id, name) VALUES($1,'Personal')`, u.ID)
		return err
	})
	var pe *pgconn.PgError
	if errors.As(err, &pe) && pe.Code == "23505" {
		return nil, ErrEmailTaken
	}
	if err != nil {
		return nil, err
	}
	return &u, nil
}

func (s *Store) UserByEmail(ctx context.Context, email string) (*User, error) {
	var u User
	err := s.pool.QueryRow(ctx,
		`SELECT id, email, password_hash, retention_days, created_at FROM users WHERE email=$1`, email).
		Scan(&u.ID, &u.Email, &u.PasswordHash, &u.RetentionDays, &u.CreatedAt)
	if err != nil {
		return nil, notFound(err)
	}
	return &u, nil
}

func (s *Store) SetRetention(ctx context.Context, userID string, days int) error {
	_, err := s.pool.Exec(ctx, `UPDATE users SET retention_days=$2 WHERE id=$1`, userID, days)
	return err
}

func (s *Store) DeleteUser(ctx context.Context, userID string) error {
	_, err := s.pool.Exec(ctx, `DELETE FROM users WHERE id=$1`, userID)
	return err
}

// ---------- tokens ----------

type TokenInfo struct {
	ID         string     `json:"id"`
	Kind       string     `json:"kind"`
	Name       string     `json:"name"`
	CreatedAt  time.Time  `json:"created_at"`
	LastUsedAt *time.Time `json:"last_used_at"`
}

func (s *Store) CreateToken(ctx context.Context, userID, kind, name string, hash []byte, expires *time.Time) error {
	_, err := s.pool.Exec(ctx,
		`INSERT INTO auth_tokens(user_id, kind, name, token_hash, expires_at) VALUES($1,$2,$3,$4,$5)`,
		userID, kind, name, hash, expires)
	return err
}

// UserByToken resolves a token hash to its user if the token is unexpired and of one of the allowed kinds.
func (s *Store) UserByToken(ctx context.Context, hash []byte, kinds ...string) (*User, error) {
	var u User
	var tokenID string
	var last *time.Time
	err := s.pool.QueryRow(ctx,
		`SELECT u.id, u.email, u.password_hash, u.retention_days, u.created_at, t.id, t.last_used_at
		 FROM auth_tokens t JOIN users u ON u.id = t.user_id
		 WHERE t.token_hash=$1 AND t.kind = ANY($2) AND (t.expires_at IS NULL OR t.expires_at > now())`, hash, kinds).
		Scan(&u.ID, &u.Email, &u.PasswordHash, &u.RetentionDays, &u.CreatedAt, &tokenID, &last)
	if err != nil {
		return nil, notFound(err)
	}
	if last == nil || time.Since(*last) > time.Minute {
		_, _ = s.pool.Exec(ctx, `UPDATE auth_tokens SET last_used_at=now() WHERE id=$1`, tokenID)
	}
	return &u, nil
}

func (s *Store) DeleteTokenByHash(ctx context.Context, hash []byte) error {
	_, err := s.pool.Exec(ctx, `DELETE FROM auth_tokens WHERE token_hash=$1`, hash)
	return err
}

func (s *Store) DeleteUserSessions(ctx context.Context, userID string) error {
	_, err := s.pool.Exec(ctx, `DELETE FROM auth_tokens WHERE user_id=$1 AND kind='session'`, userID)
	return err
}

func (s *Store) ListTokens(ctx context.Context, userID string, kinds ...string) ([]TokenInfo, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT id, kind, name, created_at, last_used_at FROM auth_tokens
		 WHERE user_id=$1 AND kind = ANY($2) ORDER BY created_at DESC`, userID, kinds)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []TokenInfo{}
	for rows.Next() {
		var t TokenInfo
		if err := rows.Scan(&t.ID, &t.Kind, &t.Name, &t.CreatedAt, &t.LastUsedAt); err != nil {
			return nil, err
		}
		out = append(out, t)
	}
	return out, rows.Err()
}

func (s *Store) CountSessions(ctx context.Context, userID string) (n int, err error) {
	err = s.pool.QueryRow(ctx,
		`SELECT count(*) FROM auth_tokens WHERE user_id=$1 AND kind='session' AND (expires_at IS NULL OR expires_at > now())`, userID).Scan(&n)
	return
}

// DeleteTokenByID removes a CLI/API token owned by userID (sessions are managed via logout).
func (s *Store) DeleteTokenByID(ctx context.Context, userID, id string) error {
	tag, err := s.pool.Exec(ctx, `DELETE FROM auth_tokens WHERE id=$1 AND user_id=$2 AND kind <> 'session'`, id, userID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// ---------- device codes (CLI login) ----------

func (s *Store) CreateDeviceCode(ctx context.Context, hash []byte, userCode string, expires time.Time) error {
	_, err := s.pool.Exec(ctx, `INSERT INTO device_codes(device_code_hash, user_code, expires_at) VALUES($1,$2,$3)`, hash, userCode, expires)
	return err
}

func (s *Store) ApproveDeviceCode(ctx context.Context, userCode, userID, rawToken string) error {
	tag, err := s.pool.Exec(ctx,
		`UPDATE device_codes SET user_id=$2, token=$3 WHERE user_code=$1 AND expires_at > now() AND user_id IS NULL`,
		userCode, userID, rawToken)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// PollDeviceCode returns (token, email, done). A finished code is consumed (deleted) on first read.
func (s *Store) PollDeviceCode(ctx context.Context, hash []byte) (token, email string, done bool, err error) {
	var uid *string
	var expires time.Time
	err = s.pool.QueryRow(ctx, `SELECT user_id, token, expires_at FROM device_codes WHERE device_code_hash=$1`, hash).
		Scan(&uid, &token, &expires)
	if err != nil {
		return "", "", false, notFound(err)
	}
	if time.Now().After(expires) {
		_, _ = s.pool.Exec(ctx, `DELETE FROM device_codes WHERE device_code_hash=$1`, hash)
		return "", "", false, ErrNotFound
	}
	if uid == nil {
		return "", "", false, nil
	}
	_ = s.pool.QueryRow(ctx, `SELECT email FROM users WHERE id=$1`, *uid).Scan(&email)
	_, _ = s.pool.Exec(ctx, `DELETE FROM device_codes WHERE device_code_hash=$1`, hash)
	return token, email, true, nil
}

// ---------- endpoints ----------

const endpointCols = `e.id, e.workspace_id, e.public_token, e.name, e.status, e.forward_url, e.request_count, e.last_request_at, e.created_at`

func scanEndpoint(row pgx.Row) (*Endpoint, error) {
	var e Endpoint
	if err := row.Scan(&e.ID, &e.WorkspaceID, &e.PublicToken, &e.Name, &e.Status, &e.ForwardURL, &e.RequestCount, &e.LastRequestAt, &e.CreatedAt); err != nil {
		return nil, notFound(err)
	}
	return &e, nil
}

func (s *Store) CreateEndpoint(ctx context.Context, userID, name, forwardURL, publicToken string, max int) (*Endpoint, error) {
	var out *Endpoint
	err := pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		var wsID string
		if err := tx.QueryRow(ctx, `SELECT id FROM workspaces WHERE owner_id=$1 ORDER BY created_at LIMIT 1 FOR UPDATE`, userID).Scan(&wsID); err != nil {
			return err
		}
		var n int
		if err := tx.QueryRow(ctx, `SELECT count(*) FROM endpoints WHERE workspace_id=$1`, wsID).Scan(&n); err != nil {
			return err
		}
		if n >= max {
			return ErrLimit
		}
		e, err := scanEndpoint(tx.QueryRow(ctx,
			`INSERT INTO endpoints(workspace_id, public_token, name, forward_url) VALUES($1,$2,$3,$4)
			 RETURNING id, workspace_id, public_token, name, status, forward_url, request_count, last_request_at, created_at`,
			wsID, publicToken, name, forwardURL))
		out = e
		return err
	})
	return out, err
}

func (s *Store) ListEndpoints(ctx context.Context, userID string) ([]*Endpoint, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT `+endpointCols+` FROM endpoints e JOIN workspaces w ON w.id=e.workspace_id
		 WHERE w.owner_id=$1 ORDER BY e.created_at`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []*Endpoint{}
	for rows.Next() {
		e, err := scanEndpoint(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, e)
	}
	return out, rows.Err()
}

func (s *Store) EndpointForUser(ctx context.Context, userID, id string) (*Endpoint, error) {
	return scanEndpoint(s.pool.QueryRow(ctx,
		`SELECT `+endpointCols+` FROM endpoints e JOIN workspaces w ON w.id=e.workspace_id
		 WHERE e.id=$1 AND w.owner_id=$2`, id, userID))
}

// EndpointByToken also returns the owning user's id (used for live events).
func (s *Store) EndpointByToken(ctx context.Context, token string) (*Endpoint, string, error) {
	var e Endpoint
	var owner string
	err := s.pool.QueryRow(ctx,
		`SELECT `+endpointCols+`, w.owner_id FROM endpoints e JOIN workspaces w ON w.id=e.workspace_id
		 WHERE e.public_token=$1`, token).
		Scan(&e.ID, &e.WorkspaceID, &e.PublicToken, &e.Name, &e.Status, &e.ForwardURL, &e.RequestCount, &e.LastRequestAt, &e.CreatedAt, &owner)
	if err != nil {
		return nil, "", notFound(err)
	}
	return &e, owner, nil
}

func (s *Store) UpdateEndpoint(ctx context.Context, userID, id string, name, status, forwardURL *string) (*Endpoint, error) {
	return scanEndpoint(s.pool.QueryRow(ctx,
		`UPDATE endpoints e SET name=COALESCE($3,e.name), status=COALESCE($4,e.status), forward_url=COALESCE($5,e.forward_url)
		 FROM workspaces w WHERE e.workspace_id=w.id AND e.id=$1 AND w.owner_id=$2
		 RETURNING `+endpointCols, id, userID, name, status, forwardURL))
}

func (s *Store) DeleteEndpoint(ctx context.Context, userID, id string) error {
	tag, err := s.pool.Exec(ctx,
		`DELETE FROM endpoints e USING workspaces w WHERE e.workspace_id=w.id AND e.id=$1 AND w.owner_id=$2`, id, userID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// ---------- requests ----------

func (s *Store) InsertRequest(ctx context.Context, r *Request) error {
	return pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		err := tx.QueryRow(ctx,
			`INSERT INTO requests(endpoint_id, method, path, query, headers, body, content_type, source_ip, size)
			 VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id, received_at`,
			r.EndpointID, r.Method, r.Path, r.Query, mustJSON(r.Headers), r.Body, r.ContentType, r.SourceIP, r.Size).
			Scan(&r.ID, &r.ReceivedAt)
		if err != nil {
			return err
		}
		_, err = tx.Exec(ctx, `UPDATE endpoints SET request_count=request_count+1, last_request_at=$2 WHERE id=$1`, r.EndpointID, r.ReceivedAt)
		return err
	})
}

type RequestFilter struct {
	EndpointID string
	Limit      int
	Before     *time.Time
	Method     string
	Status     string // latest delivery status
	Query      string // substring match on path/query/headers/body
}

func (s *Store) ListRequests(ctx context.Context, userID string, f RequestFilter) ([]RequestSummary, error) {
	args := []any{userID}
	where := []string{"w.owner_id=$1"}
	add := func(cond string, v any) {
		args = append(args, v)
		where = append(where, strings.ReplaceAll(cond, "?", fmt.Sprintf("$%d", len(args))))
	}
	if f.EndpointID != "" {
		add("r.endpoint_id=?", f.EndpointID)
	}
	if f.Before != nil {
		add("r.received_at < ?", *f.Before)
	}
	if f.Method != "" {
		add("r.method=?", strings.ToUpper(f.Method))
	}
	if f.Status != "" {
		add("d.status=?", f.Status)
	}
	if f.Query != "" {
		args = append(args, "%"+escapeLike(f.Query)+"%")
		where = append(where, fmt.Sprintf(
			"(r.path ILIKE $%[1]d OR r.query ILIKE $%[1]d OR r.headers::text ILIKE $%[1]d OR encode(r.body,'escape') ILIKE $%[1]d)", len(args)))
	}
	if f.Limit <= 0 || f.Limit > 200 {
		f.Limit = 50
	}
	args = append(args, f.Limit)
	q := fmt.Sprintf(`
		SELECT r.id, r.endpoint_id, r.method, r.path, r.query, r.content_type, r.size, r.source_ip, r.received_at,
		       d.id, d.kind, d.status, d.response_code, d.duration_ms
		FROM requests r
		JOIN endpoints e ON e.id=r.endpoint_id
		JOIN workspaces w ON w.id=e.workspace_id
		LEFT JOIN LATERAL (SELECT * FROM deliveries d WHERE d.request_id=r.id ORDER BY d.created_at DESC LIMIT 1) d ON true
		WHERE %s ORDER BY r.received_at DESC LIMIT $%d`, strings.Join(where, " AND "), len(args))
	rows, err := s.pool.Query(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []RequestSummary{}
	for rows.Next() {
		var r RequestSummary
		var did, dkind, dstatus *string
		var dcode, dms *int
		if err := rows.Scan(&r.ID, &r.EndpointID, &r.Method, &r.Path, &r.Query, &r.ContentType, &r.Size, &r.SourceIP, &r.ReceivedAt,
			&did, &dkind, &dstatus, &dcode, &dms); err != nil {
			return nil, err
		}
		if did != nil {
			r.Delivery = &DeliveryBrief{ID: *did, Kind: *dkind, Status: *dstatus, ResponseCode: dcode, DurationMS: dms}
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

func escapeLike(s string) string {
	return strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`).Replace(s)
}

func (s *Store) RequestForUser(ctx context.Context, userID, id string) (*Request, error) {
	var r Request
	var hdr []byte
	err := s.pool.QueryRow(ctx,
		`SELECT r.id, r.endpoint_id, r.method, r.path, r.query, r.headers, r.body, r.content_type, r.source_ip, r.size, r.received_at
		 FROM requests r JOIN endpoints e ON e.id=r.endpoint_id JOIN workspaces w ON w.id=e.workspace_id
		 WHERE r.id=$1 AND w.owner_id=$2`, id, userID).
		Scan(&r.ID, &r.EndpointID, &r.Method, &r.Path, &r.Query, &hdr, &r.Body, &r.ContentType, &r.SourceIP, &r.Size, &r.ReceivedAt)
	if err != nil {
		return nil, notFound(err)
	}
	_ = json.Unmarshal(hdr, &r.Headers)
	return &r, nil
}

// ---------- deliveries ----------

func (s *Store) CreateDelivery(ctx context.Context, requestID, kind, status, destination, errMsg string) (*Delivery, error) {
	d := Delivery{RequestID: requestID, Kind: kind, Status: status, Destination: destination, Error: errMsg}
	var completed *time.Time
	if status != "pending" {
		now := time.Now()
		completed = &now
	}
	err := s.pool.QueryRow(ctx,
		`INSERT INTO deliveries(request_id, kind, status, destination, error, completed_at)
		 VALUES($1,$2,$3,$4,$5,$6) RETURNING id, created_at, completed_at`,
		requestID, kind, status, destination, errMsg, completed).Scan(&d.ID, &d.CreatedAt, &d.CompletedAt)
	if err != nil {
		return nil, err
	}
	return &d, nil
}

// CompleteDelivery finalises a pending delivery. It is a no-op (ErrNotFound) if it already completed.
func (s *Store) CompleteDelivery(ctx context.Context, id, status string, code int, hdr map[string][]string, body []byte, durMS int, errMsg string) (*Delivery, error) {
	var codePtr *int
	if code > 0 {
		codePtr = &code
	}
	var d Delivery
	var hj []byte
	err := s.pool.QueryRow(ctx,
		`UPDATE deliveries SET status=$2, response_code=$3, response_headers=$4, response_body=$5, duration_ms=$6, error=$7, completed_at=now()
		 WHERE id=$1 AND status='pending'
		 RETURNING id, request_id, kind, status, destination, response_code, response_headers, response_body, duration_ms, error, created_at, completed_at`,
		id, status, codePtr, mustJSON(hdr), body, durMS, errMsg).
		Scan(&d.ID, &d.RequestID, &d.Kind, &d.Status, &d.Destination, &d.ResponseCode, &hj, &d.ResponseBody, &d.DurationMS, &d.Error, &d.CreatedAt, &d.CompletedAt)
	if err != nil {
		return nil, notFound(err)
	}
	_ = json.Unmarshal(hj, &d.ResponseHeaders)
	return &d, nil
}

func (s *Store) DeliveriesForRequest(ctx context.Context, requestID string) ([]Delivery, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT id, request_id, kind, status, destination, response_code, response_headers, response_body, duration_ms, error, created_at, completed_at
		 FROM deliveries WHERE request_id=$1 ORDER BY created_at DESC`, requestID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Delivery{}
	for rows.Next() {
		var d Delivery
		var hj []byte
		if err := rows.Scan(&d.ID, &d.RequestID, &d.Kind, &d.Status, &d.Destination, &d.ResponseCode, &hj, &d.ResponseBody, &d.DurationMS, &d.Error, &d.CreatedAt, &d.CompletedAt); err != nil {
			return nil, err
		}
		_ = json.Unmarshal(hj, &d.ResponseHeaders)
		out = append(out, d)
	}
	return out, rows.Err()
}

// ---------- stats & housekeeping ----------

func (s *Store) Stats(ctx context.Context, userID string) (Stats, error) {
	var st Stats
	err := s.pool.QueryRow(ctx, `
		SELECT
		  (SELECT count(*) FROM endpoints e JOIN workspaces w ON w.id=e.workspace_id WHERE w.owner_id=$1),
		  (SELECT coalesce(sum(e.request_count),0) FROM endpoints e JOIN workspaces w ON w.id=e.workspace_id WHERE w.owner_id=$1),
		  (SELECT count(*) FROM deliveries d JOIN requests r ON r.id=d.request_id JOIN endpoints e ON e.id=r.endpoint_id JOIN workspaces w ON w.id=e.workspace_id
		     WHERE w.owner_id=$1 AND d.status='delivered'),
		  (SELECT count(*) FROM deliveries d JOIN requests r ON r.id=d.request_id JOIN endpoints e ON e.id=r.endpoint_id JOIN workspaces w ON w.id=e.workspace_id
		     WHERE w.owner_id=$1 AND d.status='failed')`, userID).
		Scan(&st.Endpoints, &st.Requests, &st.Delivered, &st.Failed)
	return st, err
}

// Cleanup enforces per-user retention and drops expired tokens/device codes. Returns requests deleted.
func (s *Store) Cleanup(ctx context.Context) (int64, error) {
	tag, err := s.pool.Exec(ctx, `
		DELETE FROM requests r USING endpoints e, workspaces w, users u
		WHERE r.endpoint_id=e.id AND e.workspace_id=w.id AND w.owner_id=u.id
		  AND r.received_at < now() - make_interval(days => u.retention_days)`)
	if err != nil {
		return 0, err
	}
	_, _ = s.pool.Exec(ctx, `DELETE FROM auth_tokens WHERE expires_at IS NOT NULL AND expires_at < now()`)
	_, _ = s.pool.Exec(ctx, `DELETE FROM device_codes WHERE expires_at < now()`)
	return tag.RowsAffected(), nil
}

// FailStalePending marks deliveries left 'pending' by a previous process as failed.
func (s *Store) FailStalePending(ctx context.Context) error {
	_, err := s.pool.Exec(ctx,
		`UPDATE deliveries SET status='failed', error='server restarted before the delivery completed', completed_at=now() WHERE status='pending'`)
	return err
}

// ActivityPoint is one hour of traffic for the dashboard chart.
type ActivityPoint struct {
	Hour   time.Time `json:"hour"`
	Total  int       `json:"total"`
	Failed int       `json:"failed"`
}

// Activity returns the last 24 hourly buckets (oldest first), zero-filled.
func (s *Store) Activity(ctx context.Context, userID string) ([]ActivityPoint, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT h.hour, coalesce(r.n,0), coalesce(d.n,0)
		FROM generate_series(date_trunc('hour', now()) - interval '23 hours', date_trunc('hour', now()), interval '1 hour') AS h(hour)
		LEFT JOIN (
		  SELECT date_trunc('hour', r.received_at) AS hr, count(*) AS n
		  FROM requests r JOIN endpoints e ON e.id=r.endpoint_id JOIN workspaces w ON w.id=e.workspace_id
		  WHERE w.owner_id=$1 AND r.received_at >= date_trunc('hour', now()) - interval '23 hours' GROUP BY 1
		) r ON r.hr = h.hour
		LEFT JOIN (
		  SELECT date_trunc('hour', d.created_at) AS hr, count(*) AS n
		  FROM deliveries d JOIN requests r ON r.id=d.request_id JOIN endpoints e ON e.id=r.endpoint_id JOIN workspaces w ON w.id=e.workspace_id
		  WHERE w.owner_id=$1 AND d.status='failed' AND d.created_at >= date_trunc('hour', now()) - interval '23 hours' GROUP BY 1
		) d ON d.hr = h.hour
		ORDER BY h.hour`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []ActivityPoint{}
	for rows.Next() {
		var p ActivityPoint
		if err := rows.Scan(&p.Hour, &p.Total, &p.Failed); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}
