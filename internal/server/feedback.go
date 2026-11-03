package server

import (
	"errors"
	"net/http"
	"strconv"
	"strings"
	"unicode"
	"unicode/utf8"

	"github.com/hooklens/hooklens/internal/store"
)

const (
	feedbackMinLen     = 10
	feedbackMaxLen     = 1000
	feedbackMaxPerUser = 50 // stored messages per account, so nobody can fill the table
)

var feedbackCategories = map[string]bool{"bug": true, "idea": true, "question": true, "other": true}

// cleanFeedback normalises a message and rejects obvious junk. The returned error text is shown to the user.
func cleanFeedback(raw string) (string, error) {
	// drop control characters (keep newlines and tabs), then trim
	var b strings.Builder
	for _, r := range raw {
		if r == '\n' || r == '\t' || !unicode.IsControl(r) {
			b.WriteRune(r)
		}
	}
	msg := strings.TrimSpace(b.String())
	// no more than one blank line in a row
	for strings.Contains(msg, "\n\n\n") {
		msg = strings.ReplaceAll(msg, "\n\n\n", "\n\n")
	}

	n := utf8.RuneCountInString(msg)
	if n < feedbackMinLen {
		return "", errors.New("please write at least 10 characters so we can understand")
	}
	if n > feedbackMaxLen {
		return "", errors.New("feedback is limited to 1000 characters")
	}

	words, letters, nonSpace := 0, 0, 0
	unique := map[rune]bool{}
	inWord := false
	run, maxRun := 0, 0
	var prev rune
	for _, r := range msg {
		unique[unicode.ToLower(r)] = true
		if unicode.IsSpace(r) {
			inWord = false
			run = 0
			continue
		}
		nonSpace++
		if unicode.IsLetter(r) || unicode.IsDigit(r) {
			letters++
			if !inWord {
				words++
				inWord = true
			}
		}
		if r == prev {
			run++
		} else {
			run = 1
		}
		if run > maxRun {
			maxRun = run
		}
		prev = r
	}
	switch {
	case words < 3:
		return "", errors.New("please write a short sentence (at least 3 words)")
	case len(unique) < 6:
		return "", errors.New("that doesn't look like real feedback")
	case maxRun > 6:
		return "", errors.New("please avoid long runs of the same character")
	case nonSpace > 0 && float64(letters)/float64(nonSpace) < 0.5:
		return "", errors.New("please use words, not just symbols")
	case strings.Count(strings.ToLower(msg), "http") > 2:
		return "", errors.New("please include at most two links")
	}
	return msg, nil
}

func (s *Server) isAdmin(u *store.User) bool {
	email := strings.ToLower(u.Email)
	for _, a := range s.cfg.AdminEmails {
		if a == email {
			return true
		}
	}
	return false
}

func (s *Server) handleFeedback(w http.ResponseWriter, r *http.Request, u *store.User) {
	if !s.limiter.Allow("feedback:"+u.ID, 5.0/3600, 5) {
		writeErr(w, 429, "you've sent several messages recently; please try again in a while")
		return
	}
	var in struct {
		Category string `json:"category"`
		Message  string `json:"message"`
		Page     string `json:"page"`
	}
	if !decode(w, r, &in) {
		return
	}
	if !feedbackCategories[in.Category] {
		writeErr(w, 400, "choose a category")
		return
	}
	msg, err := cleanFeedback(in.Message)
	if err != nil {
		writeErr(w, 400, err.Error())
		return
	}
	page := strings.TrimSpace(in.Page)
	if !strings.HasPrefix(page, "/") || len(page) > 120 {
		page = ""
	}
	ua := r.UserAgent()
	if len(ua) > 200 {
		ua = ua[:200]
	}
	err = s.store.CreateFeedback(r.Context(), u.ID, in.Category, msg, page, ua, feedbackMaxPerUser)
	switch {
	case errors.Is(err, store.ErrDuplicate):
		writeErr(w, 409, "we already received this exact message, thank you")
		return
	case errors.Is(err, store.ErrLimit):
		writeErr(w, 429, "you've reached the feedback limit for this account")
		return
	case err != nil:
		s.log.Error("store feedback", "err", err)
		writeErr(w, 500, "could not save your feedback")
		return
	}
	s.log.Info("event", "name", "feedback_submitted", "user", u.ID, "category", in.Category)
	writeJSON(w, 201, map[string]bool{"ok": true})
}

func (s *Server) handleAdminFeedback(w http.ResponseWriter, r *http.Request, u *store.User) {
	if !s.isAdmin(u) {
		writeErr(w, 403, "admins only")
		return
	}
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	rows, err := s.store.ListFeedback(r.Context(), limit)
	if err != nil {
		writeErr(w, 500, "could not load feedback")
		return
	}
	writeJSON(w, 200, rows)
}

func (s *Server) handleAdminDeleteFeedback(w http.ResponseWriter, r *http.Request, u *store.User) {
	if !s.isAdmin(u) {
		writeErr(w, 403, "admins only")
		return
	}
	if err := s.store.DeleteFeedback(r.Context(), r.PathValue("id")); err != nil {
		writeErr(w, 404, "not found")
		return
	}
	writeJSON(w, 200, map[string]bool{"ok": true})
}
