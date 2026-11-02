// Package auth holds password hashing and opaque-token helpers.
package auth

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base32"
	"encoding/base64"
	"errors"
	"strings"

	"golang.org/x/crypto/bcrypt"
)

const (
	KindSession = "session"
	KindCLI     = "cli"
	KindAPI     = "api"
)

func HashPassword(pw string) (string, error) {
	b, err := bcrypt.GenerateFromPassword([]byte(pw), 12)
	return string(b), err
}

func CheckPassword(hash, pw string) bool {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(pw)) == nil
}

// NewToken returns a random opaque token with a kind prefix, and its SHA-256 hash for storage.
func NewToken(kind string) (raw string, hash []byte) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		panic(err)
	}
	prefix := map[string]string{KindSession: "hls_", KindCLI: "hlc_", KindAPI: "hlk_"}[kind]
	raw = prefix + base64.RawURLEncoding.EncodeToString(b)
	return raw, HashToken(raw)
}

func HashToken(raw string) []byte {
	h := sha256.Sum256([]byte(raw))
	return h[:]
}

// NewPublicToken returns the unguessable id used in public webhook URLs (160 bits, lowercase base32).
func NewPublicToken() string {
	b := make([]byte, 20)
	if _, err := rand.Read(b); err != nil {
		panic(err)
	}
	return strings.ToLower(base32.StdEncoding.WithPadding(base32.NoPadding).EncodeToString(b))
}

// NewUserCode returns a short human-typable code like "K7QD-92XM" for the CLI device flow.
func NewUserCode() string {
	const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
	b := make([]byte, 8)
	if _, err := rand.Read(b); err != nil {
		panic(err)
	}
	out := make([]byte, 0, 9)
	for i, x := range b {
		if i == 4 {
			out = append(out, '-')
		}
		out = append(out, alphabet[int(x)%len(alphabet)])
	}
	return string(out)
}

var ErrBadCredentials = errors.New("invalid email or password")
