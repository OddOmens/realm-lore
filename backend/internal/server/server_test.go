package server

import (
	"bytes"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"path"
	"strings"
	"testing"
	"testing/fstest"

	"github.com/oddomens/realm-lore/internal/auth"
	"github.com/oddomens/realm-lore/internal/state"
	"github.com/oddomens/realm-lore/internal/worlds"
)

func newTestServer(t *testing.T) *httptest.Server {
	t.Helper()
	dir := t.TempDir()
	a, err := auth.New(dir, "correct horse")
	if err != nil {
		t.Fatal(err)
	}
	store := &worlds.Store{DataDir: dir}
	store.CreateWorld("W")
	srv := &Server{Store: store, State: state.New(dir), Auth: a, Version: "test",
		WebUI: fstest.MapFS{"index.html": {Data: []byte("<html>app</html>")}}}
	ts := httptest.NewServer(srv.Handler())
	t.Cleanup(ts.Close)
	return ts
}

func do(t *testing.T, method, url, body string, cookie *http.Cookie) *http.Response {
	t.Helper()
	req, _ := http.NewRequest(method, url, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	if cookie != nil {
		req.AddCookie(cookie)
	}
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	return res
}

func login(t *testing.T, ts *httptest.Server) *http.Cookie {
	t.Helper()
	res := do(t, "POST", ts.URL+"/api/auth/login", `{"password":"correct horse"}`, nil)
	if res.StatusCode != http.StatusNoContent {
		t.Fatalf("login status %d", res.StatusCode)
	}
	for _, c := range res.Cookies() {
		if c.Name == "realmlore_session" {
			return c
		}
	}
	t.Fatal("no session cookie")
	return nil
}

func TestAuth(t *testing.T) {
	ts := newTestServer(t)
	if res := do(t, "GET", ts.URL+"/api/worlds", "", nil); res.StatusCode != http.StatusUnauthorized {
		t.Errorf("unauthenticated worlds = %d", res.StatusCode)
	}
	if res := do(t, "GET", ts.URL+"/asset/W/assets/x.png", "", nil); res.StatusCode != http.StatusUnauthorized {
		t.Errorf("unauthenticated asset = %d", res.StatusCode)
	}
	if res := do(t, "POST", ts.URL+"/api/auth/login", `{"password":"nope"}`, nil); res.StatusCode != http.StatusUnauthorized {
		t.Errorf("wrong password = %d", res.StatusCode)
	}
	forged := &http.Cookie{Name: "realmlore_session", Value: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"}
	if res := do(t, "GET", ts.URL+"/api/worlds", "", forged); res.StatusCode != http.StatusUnauthorized {
		t.Errorf("forged cookie = %d", res.StatusCode)
	}
	c := login(t, ts)
	res := do(t, "GET", ts.URL+"/api/worlds", "", c)
	var body struct{ Worlds []string }
	json.NewDecoder(res.Body).Decode(&body)
	if res.StatusCode != 200 || len(body.Worlds) != 1 || body.Worlds[0] != "W" {
		t.Errorf("worlds = %d %+v", res.StatusCode, body)
	}
}

func TestLoginRateLimit(t *testing.T) {
	ts := newTestServer(t)
	for i := 0; i < 10; i++ {
		do(t, "POST", ts.URL+"/api/auth/login", `{"password":"nope"}`, nil)
	}
	if res := do(t, "POST", ts.URL+"/api/auth/login", `{"password":"correct horse"}`, nil); res.StatusCode != http.StatusTooManyRequests {
		t.Errorf("after 10 failures = %d, want 429", res.StatusCode)
	}
}

func TestCrossSiteWriteRefused(t *testing.T) {
	ts := newTestServer(t)
	c := login(t, ts)
	req, _ := http.NewRequest("POST", ts.URL+"/api/fs/write", strings.NewReader(`{"path":"W/lore/x.md","content":"x"}`))
	req.Header.Set("Origin", "https://evil.example")
	req.AddCookie(c)
	res, _ := http.DefaultClient.Do(req)
	if res.StatusCode != http.StatusForbidden {
		t.Errorf("cross-site write = %d", res.StatusCode)
	}
}

func TestPathEscapeRefused(t *testing.T) {
	ts := newTestServer(t)
	c := login(t, ts)
	for _, p := range []string{"../session.key", "W/../../session.key", "../prefs.json"} {
		res := do(t, "POST", ts.URL+"/api/fs/read", `{"path":"`+p+`"}`, c)
		if res.StatusCode != http.StatusForbidden {
			t.Errorf("read %s = %d", p, res.StatusCode)
		}
	}
}

func TestAssetServing(t *testing.T) {
	ts := newTestServer(t)
	c := login(t, ts)
	do(t, "POST", ts.URL+"/api/fs/write", `{"path":"W/maps/m1.img","content":"data:image/png;base64,iVBORw0KGgo="}`, c)
	res := do(t, "GET", ts.URL+"/asset/W/maps/m1.img", "", c)
	if res.StatusCode != 200 || res.Header.Get("Content-Type") != "image/png" {
		t.Errorf("map image = %d %s", res.StatusCode, res.Header.Get("Content-Type"))
	}
	if !strings.Contains(res.Header.Get("Content-Security-Policy"), "sandbox") {
		t.Error("assets must be sandboxed")
	}
}

func TestSPAFallback(t *testing.T) {
	ts := newTestServer(t)
	res := do(t, "GET", ts.URL+"/characters/abc", "", nil)
	b := make([]byte, 64)
	n, _ := res.Body.Read(b)
	if res.StatusCode != 200 || !strings.Contains(string(b[:n]), "app") {
		t.Errorf("SPA route = %d %q", res.StatusCode, b[:n])
	}
	if res := do(t, "GET", ts.URL+"/api/nope", "", nil); res.StatusCode != 404 {
		t.Errorf("unknown API route = %d", res.StatusCode)
	}
}

func TestPrefsAndBackupConfig(t *testing.T) {
	ts := newTestServer(t)
	c := login(t, ts)
	do(t, "PATCH", ts.URL+"/api/prefs", `{"set":{"a":"1","b":"2"},"remove":["b"]}`, c)
	var prefs map[string]string
	json.NewDecoder(do(t, "GET", ts.URL+"/api/prefs", "", c).Body).Decode(&prefs)
	if prefs["a"] != "1" || len(prefs) != 1 {
		t.Errorf("prefs = %v", prefs)
	}
	res := do(t, "PUT", ts.URL+"/api/backup", `{"location":"","frequency":-5,"retentionDays":7}`, c)
	var cfg state.BackupConfig
	json.NewDecoder(res.Body).Decode(&cfg)
	if cfg.Location != "Backups" || cfg.Frequency != 0 || cfg.RetentionDays != 7 {
		t.Errorf("backup config = %+v", cfg)
	}
	res = do(t, "POST", ts.URL+"/api/backup/run", `{"world":"W"}`, c)
	if res.StatusCode != 200 {
		t.Errorf("backup run = %d", res.StatusCode)
	}
}

func TestFolderUploadKeepsSubfolders(t *testing.T) {
	ts := newTestServer(t)
	c := login(t, ts)
	var body bytes.Buffer
	mw := multipart.NewWriter(&body)
	for _, p := range []string{"characters/c1.md", "maps/m1.img"} {
		mw.WriteField("paths", p)
		fw, _ := mw.CreateFormFile("files", path.Base(p))
		fw.Write([]byte("x"))
	}
	mw.Close()
	req, _ := http.NewRequest("POST", ts.URL+"/api/worlds/upload?name=Uploaded", &body)
	req.Header.Set("Content-Type", mw.FormDataContentType())
	req.AddCookie(c)
	res, _ := http.DefaultClient.Do(req)
	if res.StatusCode != 200 {
		t.Fatalf("upload = %d", res.StatusCode)
	}
	read := do(t, "POST", ts.URL+"/api/fs/read", `{"path":"Uploaded/characters/c1.md"}`, c)
	var r struct{ Content *string }
	json.NewDecoder(read.Body).Decode(&r)
	if r.Content == nil || *r.Content != "x" {
		t.Error("characters/c1.md didn't keep its folder")
	}
}
