// Package auth signs the one Realm Lore user in with the server's password.
// Sessions are signed cookies, so they survive restarts, and changing the
// password signs every device out.
package auth

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/binary"
	"errors"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

const (
	cookiePlain  = "realmlore_session"
	cookieSecure = "__Host-realmlore_session" // over HTTPS: pinned to this host and path /
	sessionLen   = 30 * 24 * time.Hour

	failWindow = 15 * time.Minute
	maxFails   = 10
)

type Auth struct {
	passwordHash [32]byte
	key          []byte // signs session cookies; derived from the stored secret and the password

	mu    sync.Mutex
	fails map[string][]time.Time
}

// New loads (or creates) the signing secret in dataDir.
func New(dataDir, password string) (*Auth, error) {
	if password == "" {
		return nil, errors.New("no password set")
	}
	secretFile := filepath.Join(dataDir, "session.key")
	secret, err := os.ReadFile(secretFile)
	if err != nil || len(secret) < 32 {
		secret = make([]byte, 32)
		if _, err := rand.Read(secret); err != nil {
			return nil, err
		}
		if err := os.WriteFile(secretFile, secret, 0o600); err != nil {
			return nil, err
		}
	}
	a := &Auth{passwordHash: sha256.Sum256([]byte(password)), fails: map[string][]time.Time{}}
	mac := hmac.New(sha256.New, secret)
	mac.Write(a.passwordHash[:])
	a.key = mac.Sum(nil)
	return a, nil
}

func secure(r *http.Request) bool {
	return r.TLS != nil || strings.EqualFold(r.Header.Get("X-Forwarded-Proto"), "https")
}

func (a *Auth) sign(expiry int64) string {
	payload := binary.BigEndian.AppendUint64(nil, uint64(expiry))
	mac := hmac.New(sha256.New, a.key)
	mac.Write(payload)
	return base64.RawURLEncoding.EncodeToString(append(payload, mac.Sum(nil)...))
}

func (a *Auth) valid(token string) bool {
	raw, err := base64.RawURLEncoding.DecodeString(token)
	if err != nil || len(raw) != 8+sha256.Size {
		return false
	}
	mac := hmac.New(sha256.New, a.key)
	mac.Write(raw[:8])
	if !hmac.Equal(raw[8:], mac.Sum(nil)) {
		return false
	}
	return time.Now().Unix() < int64(binary.BigEndian.Uint64(raw[:8]))
}

// SignedIn reports whether the request carries a valid session. Over HTTPS
// only the __Host- cookie counts, so one planted over plain HTTP can't.
func (a *Auth) SignedIn(r *http.Request) bool {
	name := cookiePlain
	if secure(r) {
		name = cookieSecure
	}
	c, err := r.Cookie(name)
	return err == nil && a.valid(c.Value)
}

func (a *Auth) setCookie(w http.ResponseWriter, r *http.Request, value string, maxAge int) {
	name := cookiePlain
	if secure(r) {
		name = cookieSecure
	}
	http.SetCookie(w, &http.Cookie{Name: name, Value: value, Path: "/", MaxAge: maxAge, HttpOnly: true, Secure: secure(r), SameSite: http.SameSiteLaxMode})
}

func clientIP(r *http.Request) string {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

// limited reports whether this address has failed too often recently.
func (a *Auth) limited(ip string) bool {
	a.mu.Lock()
	defer a.mu.Unlock()
	cutoff := time.Now().Add(-failWindow)
	recent := a.fails[ip][:0]
	for _, t := range a.fails[ip] {
		if t.After(cutoff) {
			recent = append(recent, t)
		}
	}
	a.fails[ip] = recent
	return len(recent) >= maxFails
}

func (a *Auth) fail(ip string) {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.fails[ip] = append(a.fails[ip], time.Now())
}

// Login checks the password and sets the session cookie. It returns the
// HTTP status to answer with and a message for the person signing in.
func (a *Auth) Login(w http.ResponseWriter, r *http.Request, password string) (int, string) {
	ip := clientIP(r)
	if a.limited(ip) {
		return http.StatusTooManyRequests, "Too many wrong passwords. Wait 15 minutes and try again."
	}
	got := sha256.Sum256([]byte(password))
	if subtle.ConstantTimeCompare(got[:], a.passwordHash[:]) != 1 {
		a.fail(ip)
		return http.StatusUnauthorized, "That password is wrong."
	}
	a.setCookie(w, r, a.sign(time.Now().Add(sessionLen).Unix()), int(sessionLen.Seconds()))
	return http.StatusNoContent, ""
}

func (a *Auth) Logout(w http.ResponseWriter, r *http.Request) {
	a.setCookie(w, r, "", -1)
}
