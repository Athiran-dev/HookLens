package server

import (
	"errors"
	"net/http"
	"net/mail"
	"strings"
	"time"

	"github.com/hooklens/hooklens/internal/auth"
	"github.com/hooklens/hooklens/internal/store"
)

const sessionTTL = 30 * 24 * time.Hour

// A valid bcrypt hash of a random string, compared against when the email is unknown so that
// login timing doesn't reveal which emails are registered.
var dummyHash, _ = auth.HashPassword("hooklens-dummy-password")

func (s *Server) startSession(w http.ResponseWriter, r *http.Request, u *store.User) error {
	raw, hash := auth.NewToken(auth.KindSession)
	exp := time.Now().Add(sessionTTL)
	if err := s.store.CreateToken(r.Context(), u.ID, auth.KindSession, r.UserAgent(), hash, &exp); err != nil {
		return err
	}
	http.SetCookie(w, &http.Cookie{
		Name: sessionCookie, Value: raw, Path: "/", Expires: exp,
		HttpOnly: true, Secure: s.cfg.SecureCookies, SameSite: http.SameSiteLaxMode,
	})
	return nil
}

func (s *Server) handleSignup(w http.ResponseWriter, r *http.Request) {
	if !s.cfg.AllowSignup {
		writeErr(w, 403, "signups are currently closed")
		return
	}
	if !s.limiter.Allow("signup:"+s.clientIP(r), 10.0/3600, 10) {
		writeErr(w, 429, "too many signups from this address, try again later")
		return
	}
	var in struct{ Email, Password string }
	if !decode(w, r, &in) {
		return
	}
	email := strings.ToLower(strings.TrimSpace(in.Email))
	if addr, err := mail.ParseAddress(email); err != nil || addr.Address != email || len(email) > 254 {
		writeErr(w, 400, "enter a valid email address")
		return
	}
	if len(in.Password) < 8 || len(in.Password) > 72 {
		writeErr(w, 400, "password must be 8 to 72 characters")
		return
	}
	hash, err := auth.HashPassword(in.Password)
	if err != nil {
		writeErr(w, 500, "could not create account")
		return
	}
	u, err := s.store.CreateUser(r.Context(), email, hash)
	if errors.Is(err, store.ErrEmailTaken) {
		writeErr(w, 409, "an account with this email already exists")
		return
	}
	if err != nil {
		s.log.Error("create user", "err", err)
		writeErr(w, 500, "could not create account")
		return
	}
	if err := s.startSession(w, r, u); err != nil {
		writeErr(w, 500, "could not start session")
		return
	}
	s.log.Info("event", "name", "user_signed_up", "user", u.ID)
	writeJSON(w, 201, u)
}

func (s *Server) handleLogin(w http.ResponseWriter, r *http.Request) {
	var in struct{ Email, Password string }
	if !decode(w, r, &in) {
		return
	}
	email := strings.ToLower(strings.TrimSpace(in.Email))
	if !s.limiter.Allow("login:ip:"+s.clientIP(r), 10.0/60, 10) || !s.limiter.Allow("login:email:"+email, 10.0/900, 10) {
		writeErr(w, 429, "too many attempts, try again in a few minutes")
		return
	}
	u, err := s.store.UserByEmail(r.Context(), email)
	if err != nil {
		auth.CheckPassword(dummyHash, in.Password)
		writeErr(w, 401, auth.ErrBadCredentials.Error())
		return
	}
	if !auth.CheckPassword(u.PasswordHash, in.Password) {
		writeErr(w, 401, auth.ErrBadCredentials.Error())
		return
	}
	if err := s.startSession(w, r, u); err != nil {
		writeErr(w, 500, "could not start session")
		return
	}
	writeJSON(w, 200, u)
}

func (s *Server) handleLogout(w http.ResponseWriter, r *http.Request) {
	if b := bearerToken(r); b != "" {
		_ = s.store.DeleteTokenByHash(r.Context(), auth.HashToken(b))
	}
	if c, err := r.Cookie(sessionCookie); err == nil {
		_ = s.store.DeleteTokenByHash(r.Context(), auth.HashToken(c.Value))
	}
	http.SetCookie(w, &http.Cookie{Name: sessionCookie, Value: "", Path: "/", MaxAge: -1, HttpOnly: true, Secure: s.cfg.SecureCookies, SameSite: http.SameSiteLaxMode})
	writeJSON(w, 200, map[string]bool{"ok": true})
}

func (s *Server) handleLogoutAll(w http.ResponseWriter, r *http.Request, u *store.User) {
	if err := s.store.DeleteUserSessions(r.Context(), u.ID); err != nil {
		writeErr(w, 500, "could not log out sessions")
		return
	}
	s.handleLogout(w, r)
}

func (s *Server) handleMe(w http.ResponseWriter, r *http.Request, u *store.User) {
	n, _ := s.store.CountSessions(r.Context(), u.ID)
	writeJSON(w, 200, map[string]any{
		"user":            u,
		"is_admin":        s.isAdmin(u),
		"active_sessions": n,
		"limits": map[string]any{
			"max_endpoints":  s.cfg.MaxEndpointsPerUser,
			"max_tunnels":    s.cfg.MaxTunnelsPerUser,
			"max_body_bytes": s.cfg.MaxBodyBytes,
		},
	})
}

func (s *Server) handleUpdateMe(w http.ResponseWriter, r *http.Request, u *store.User) {
	var in struct {
		RetentionDays *int `json:"retention_days"`
	}
	if !decode(w, r, &in) {
		return
	}
	if in.RetentionDays != nil {
		d := *in.RetentionDays
		if d < 1 || d > 30 {
			writeErr(w, 400, "retention_days must be between 1 and 30")
			return
		}
		if err := s.store.SetRetention(r.Context(), u.ID, d); err != nil {
			writeErr(w, 500, "could not update settings")
			return
		}
		u.RetentionDays = d
	}
	writeJSON(w, 200, u)
}

func (s *Server) handleDeleteMe(w http.ResponseWriter, r *http.Request, u *store.User) {
	var in struct{ Password string }
	if !decode(w, r, &in) {
		return
	}
	if !auth.CheckPassword(u.PasswordHash, in.Password) {
		writeErr(w, 403, "password is incorrect")
		return
	}
	// disconnect any live tunnels owned by this user
	for _, info := range s.hub.ListForUser(u.ID) {
		if t := s.hub.Get(info.EndpointID); t != nil {
			t.Close()
		}
	}
	if err := s.store.DeleteUser(r.Context(), u.ID); err != nil {
		writeErr(w, 500, "could not delete account")
		return
	}
	http.SetCookie(w, &http.Cookie{Name: sessionCookie, Value: "", Path: "/", MaxAge: -1})
	writeJSON(w, 200, map[string]bool{"ok": true})
}

// ---------- API keys ----------

func (s *Server) handleListTokens(w http.ResponseWriter, r *http.Request, u *store.User) {
	toks, err := s.store.ListTokens(r.Context(), u.ID, auth.KindCLI, auth.KindAPI)
	if err != nil {
		writeErr(w, 500, "could not list tokens")
		return
	}
	writeJSON(w, 200, toks)
}

func (s *Server) handleCreateToken(w http.ResponseWriter, r *http.Request, u *store.User) {
	var in struct{ Name string }
	if !decode(w, r, &in) {
		return
	}
	name := strings.TrimSpace(in.Name)
	if name == "" || len(name) > 60 {
		writeErr(w, 400, "name is required (max 60 characters)")
		return
	}
	existing, _ := s.store.ListTokens(r.Context(), u.ID, auth.KindAPI)
	if len(existing) >= 20 {
		writeErr(w, 409, "API key limit reached (20)")
		return
	}
	raw, hash := auth.NewToken(auth.KindAPI)
	if err := s.store.CreateToken(r.Context(), u.ID, auth.KindAPI, name, hash, nil); err != nil {
		writeErr(w, 500, "could not create token")
		return
	}
	writeJSON(w, 201, map[string]string{"token": raw, "name": name, "note": "Copy this now; it will not be shown again."})
}

func (s *Server) handleDeleteToken(w http.ResponseWriter, r *http.Request, u *store.User) {
	if err := s.store.DeleteTokenByID(r.Context(), u.ID, r.PathValue("id")); err != nil {
		writeErr(w, 404, "token not found")
		return
	}
	writeJSON(w, 200, map[string]bool{"ok": true})
}

// ---------- CLI device login ----------

func (s *Server) handleCLIStart(w http.ResponseWriter, r *http.Request) {
	if !s.limiter.Allow("clistart:"+s.clientIP(r), 10.0/60, 10) {
		writeErr(w, 429, "too many login attempts, slow down")
		return
	}
	deviceRaw, deviceHash := auth.NewToken(auth.KindCLI)
	userCode := auth.NewUserCode()
	const ttl = 10 * time.Minute
	if err := s.store.CreateDeviceCode(r.Context(), deviceHash, userCode, time.Now().Add(ttl)); err != nil {
		writeErr(w, 500, "could not start login")
		return
	}
	writeJSON(w, 200, map[string]any{
		"device_code":      deviceRaw,
		"user_code":        userCode,
		"verification_url": s.cfg.PublicURL + "/cli-auth/?code=" + userCode,
		"expires_in":       int(ttl.Seconds()),
		"interval":         2,
	})
}

func (s *Server) handleCLIApprove(w http.ResponseWriter, r *http.Request, u *store.User) {
	var in struct {
		UserCode string `json:"user_code"`
	}
	if !decode(w, r, &in) {
		return
	}
	if !s.limiter.Allow("cliapprove:"+u.ID, 10.0/60, 10) {
		writeErr(w, 429, "too many attempts")
		return
	}
	code := strings.ToUpper(strings.TrimSpace(in.UserCode))
	raw, hash := auth.NewToken(auth.KindCLI)
	if err := s.store.CreateToken(r.Context(), u.ID, auth.KindCLI, "CLI login "+time.Now().Format("2006-01-02"), hash, nil); err != nil {
		writeErr(w, 500, "could not approve")
		return
	}
	if err := s.store.ApproveDeviceCode(r.Context(), code, u.ID, raw); err != nil {
		_ = s.store.DeleteTokenByHash(r.Context(), hash)
		writeErr(w, 404, "that code is invalid or has expired")
		return
	}
	writeJSON(w, 200, map[string]bool{"ok": true})
}

func (s *Server) handleCLIPoll(w http.ResponseWriter, r *http.Request) {
	var in struct {
		DeviceCode string `json:"device_code"`
	}
	if !decode(w, r, &in) {
		return
	}
	token, email, done, err := s.store.PollDeviceCode(r.Context(), auth.HashToken(in.DeviceCode))
	if errors.Is(err, store.ErrNotFound) {
		writeErr(w, 410, "login expired, run `hooklens login` again")
		return
	}
	if err != nil {
		writeErr(w, 500, "poll failed")
		return
	}
	if !done {
		writeJSON(w, 202, map[string]string{"status": "pending"})
		return
	}
	writeJSON(w, 200, map[string]string{"status": "approved", "token": token, "email": email})
}
