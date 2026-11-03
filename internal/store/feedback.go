package store

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
)

var ErrDuplicate = errors.New("duplicate")

// CreateFeedback stores one message. It refuses (ErrLimit) once a user has stored maxPerUser messages
// and (ErrDuplicate) when the same user sent the identical message within the last 24 hours.
func (s *Store) CreateFeedback(ctx context.Context, userID, category, message, page, userAgent string, maxPerUser int) error {
	return pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		var total int
		if err := tx.QueryRow(ctx, `SELECT count(*) FROM feedback WHERE user_id=$1`, userID).Scan(&total); err != nil {
			return err
		}
		if total >= maxPerUser {
			return ErrLimit
		}
		var dup bool
		if err := tx.QueryRow(ctx,
			`SELECT EXISTS(SELECT 1 FROM feedback WHERE user_id=$1 AND message=$2 AND created_at > now() - interval '24 hours')`,
			userID, message).Scan(&dup); err != nil {
			return err
		}
		if dup {
			return ErrDuplicate
		}
		_, err := tx.Exec(ctx,
			`INSERT INTO feedback(user_id, category, message, page, user_agent) VALUES($1,$2,$3,$4,$5)`,
			userID, category, message, page, userAgent)
		return err
	})
}

type FeedbackRow struct {
	ID        string    `json:"id"`
	Email     string    `json:"email"`
	Category  string    `json:"category"`
	Message   string    `json:"message"`
	Page      string    `json:"page"`
	CreatedAt time.Time `json:"created_at"`
}

func (s *Store) ListFeedback(ctx context.Context, limit int) ([]FeedbackRow, error) {
	if limit <= 0 || limit > 500 {
		limit = 100
	}
	rows, err := s.pool.Query(ctx,
		`SELECT f.id, u.email, f.category, f.message, f.page, f.created_at
		 FROM feedback f JOIN users u ON u.id=f.user_id ORDER BY f.created_at DESC LIMIT $1`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []FeedbackRow{}
	for rows.Next() {
		var r FeedbackRow
		if err := rows.Scan(&r.ID, &r.Email, &r.Category, &r.Message, &r.Page, &r.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

func (s *Store) DeleteFeedback(ctx context.Context, id string) error {
	tag, err := s.pool.Exec(ctx, `DELETE FROM feedback WHERE id=$1`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}
