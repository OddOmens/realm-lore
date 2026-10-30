// Package server is Realm Lore's HTTP API and web app.
package server

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"io"
	"io/fs"
	"log"
	"net/http"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"strings"
	"time"

	"github.com/oddomens/realm-lore/internal/auth"
	"github.com/oddomens/realm-lore/internal/state"
	"github.com/oddomens/realm-lore/internal/worlds"
)

const (
	maxJSONBody   = 64 << 20 // a map image is stored inline, so writes can be large
	maxUploadBody = 4 << 30
)

type Server struct {
	Store   *worlds.Store
	State   *state.State
	Auth    *auth.Auth
	WebUI   fs.FS
	Version string
}

func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	open := func(pattern string, h http.HandlerFunc) { mux.HandleFunc(pattern, h) }
	authed := func(pattern string, h http.HandlerFunc) { mux.HandleFunc(pattern, s.requireAuth(h)) }

	open("GET /api/health", func(w http.ResponseWriter, r *http.Request) { writeJSON(w, http.StatusOK, map[string]bool{"ok": true}) })
	open("GET /api/auth/status", s.handleAuthStatus)
	open("POST /api/auth/login", s.handleLogin)
	open("POST /api/auth/logout", s.handleLogout)

	authed("GET /api/info", s.handleInfo)
	authed("GET /api/prefs", s.handleGetPrefs)
	authed("PATCH /api/prefs", s.handlePatchPrefs)

	authed("GET /api/worlds", s.handleListWorlds)
	authed("POST /api/worlds", s.handleCreateWorld)
	authed("DELETE /api/worlds/{world}", s.handleDeleteWorld)
	authed("GET /api/worlds/{world}/export", s.handleExportWorld)
	authed("POST /api/worlds/import", s.handleImportZip)
	authed("POST /api/worlds/upload", s.handleUploadFolder)
	authed("GET /api/worlds/{world}/trash", s.handleTrashList)
	authed("GET /api/worlds/{world}/assets", s.handleListAssets)
	authed("POST /api/worlds/{world}/assets", s.handleAddAssets)
	authed("DELETE /api/worlds/{world}/assets/{path...}", s.handleDeleteAsset)

	authed("POST /api/fs/read", s.handleRead)
	authed("POST /api/fs/list", s.handleList)
	authed("POST /api/fs/write", s.handleWrite)
	authed("POST /api/fs/write-batch", s.handleWriteBatch)
	authed("POST /api/fs/delete", s.handleDelete)
	authed("POST /api/fs/map-image", s.handleMapImage)
	authed("POST /api/trash/restore", s.handleTrashRestore)
	authed("POST /api/trash/purge", s.handleTrashPurge)

	authed("GET /api/stamps", s.handleStamps)
	authed("GET /api/stamps/image", s.handleStampImage)

	authed("GET /api/backup", s.handleGetBackup)
	authed("PUT /api/backup", s.handlePutBackup)
	authed("POST /api/backup/run", s.handleRunBackup)

	authed("GET /asset/{world}/{path...}", s.handleAsset)
	open("/api/", func(w http.ResponseWriter, r *http.Request) { writeError(w, http.StatusNotFound, "No such API route.") })
	open("/", s.handleWebUI)

	return s.secure(mux)
}

// ── Middleware ───────────────────────────────────────────────────────────────

// secure adds baseline headers and refuses cross-site writes.
func (s *Server) secure(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		h := w.Header()
		h.Set("X-Content-Type-Options", "nosniff")
		h.Set("Referrer-Policy", "same-origin")
		h.Set("X-Frame-Options", "DENY")
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			if o := r.Header.Get("Origin"); o != "" {
				if u, err := url.Parse(o); err != nil || !strings.EqualFold(u.Host, r.Host) {
					writeError(w, http.StatusForbidden, "Requests from other sites aren't allowed.")
					return
				}
			}
		}
		rec := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(rec, r)
		if rec.status >= 400 && r.URL.Path != "/api/auth/status" {
			log.Printf("%s %s -> %d", r.Method, r.URL.Path, rec.status)
		}
	})
}

type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (r *statusRecorder) WriteHeader(code int) {
	r.status = code
	r.ResponseWriter.WriteHeader(code)
}

func (r *statusRecorder) Unwrap() http.ResponseWriter { return r.ResponseWriter }

func (s *Server) requireAuth(h http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !s.Auth.SignedIn(r) {
			writeError(w, http.StatusUnauthorized, "Sign in to continue.")
			return
		}
		h(w, r)
	}
}

// ── Helpers ──────────────────────────────────────────────────────────────────

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

// fail answers with the status that fits err.
func fail(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, worlds.ErrForbidden):
		writeError(w, http.StatusForbidden, "That path isn't allowed.")
	case errors.Is(err, worlds.ErrNotFound):
		writeError(w, http.StatusNotFound, "Not found.")
	default:
		log.Printf("error: %v", err)
		writeError(w, http.StatusInternalServerError, err.Error())
	}
}

func readJSON(w http.ResponseWriter, r *http.Request, v any) bool {
	r.Body = http.MaxBytesReader(w, r.Body, maxJSONBody)
	if err := json.NewDecoder(r.Body).Decode(v); err != nil {
		writeError(w, http.StatusBadRequest, "The request body isn't valid JSON.")
		return false
	}
	return true
}

type pathBody struct {
	Path string `json:"path"`
}

var success = map[string]bool{"success": true}

// ── Auth & app ───────────────────────────────────────────────────────────────

func (s *Server) handleAuthStatus(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]bool{"authenticated": s.Auth.SignedIn(r)})
}

func (s *Server) handleLogin(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Password string `json:"password"`
	}
	if !readJSON(w, r, &body) {
		return
	}
	status, msg := s.Auth.Login(w, r, body.Password)
	if msg != "" {
		writeError(w, status, msg)
		return
	}
	w.WriteHeader(status)
}

func (s *Server) handleLogout(w http.ResponseWriter, r *http.Request) {
	s.Auth.Logout(w, r)
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) handleInfo(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"version":     s.Version,
		"firstLaunch": s.State.FirstLaunch(),
		"worldsPath":  s.Store.WorldsDir(),
	})
}

func (s *Server) handleGetPrefs(w http.ResponseWriter, r *http.Request) {
	p, err := s.State.Prefs()
	if err != nil {
		fail(w, err)
		return
	}
	writeJSON(w, http.StatusOK, p)
}

func (s *Server) handlePatchPrefs(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Set    map[string]string `json:"set"`
		Remove []string          `json:"remove"`
	}
	if !readJSON(w, r, &body) {
		return
	}
	if err := s.State.PatchPrefs(body.Set, body.Remove); err != nil {
		fail(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ── Worlds ───────────────────────────────────────────────────────────────────

func (s *Server) handleListWorlds(w http.ResponseWriter, r *http.Request) {
	list, err := s.Store.ListWorlds()
	if err != nil {
		fail(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"worlds": list})
}

func (s *Server) handleCreateWorld(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Name string `json:"name"`
	}
	if !readJSON(w, r, &body) {
		return
	}
	if strings.TrimSpace(body.Name) == "" {
		writeError(w, http.StatusBadRequest, "Give the world a name.")
		return
	}
	name, err := s.Store.CreateWorld(body.Name)
	if err != nil {
		fail(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"success": true, "world": name})
}

func (s *Server) handleDeleteWorld(w http.ResponseWriter, r *http.Request) {
	if err := s.Store.DeleteWorld(r.PathValue("world")); err != nil {
		fail(w, err)
		return
	}
	writeJSON(w, http.StatusOK, success)
}

func (s *Server) handleExportWorld(w http.ResponseWriter, r *http.Request) {
	world := r.PathValue("world")
	if !s.Store.WorldExists(world) {
		fail(w, worlds.ErrNotFound)
		return
	}
	w.Header().Set("Content-Type", "application/zip")
	w.Header().Set("Content-Disposition", `attachment; filename="`+worlds.SafeName(world)+`.zip"`)
	if err := s.Store.ExportZip(world, w); err != nil {
		log.Printf("export %s: %v", world, err)
	}
}

// importResult answers an import, telling the page when the world exists so
// it can ask before replacing it.
func importResult(w http.ResponseWriter, name string, err error) {
	if errors.Is(err, worlds.ErrExists) {
		writeJSON(w, http.StatusConflict, map[string]string{"error": "exists", "world": name})
		return
	}
	if err != nil {
		if errors.Is(err, worlds.ErrForbidden) {
			writeError(w, http.StatusBadRequest, "That world name can't be used.")
			return
		}
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"success": true, "world": name})
}

func (s *Server) handleImportZip(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, maxUploadBody)
	name := r.URL.Query().Get("name")
	overwrite := r.URL.Query().Get("overwrite") == "1"
	if err := os.MkdirAll(s.Store.WorldsDir(), 0o755); err != nil {
		fail(w, err)
		return
	}
	tmp, err := os.CreateTemp(s.Store.WorldsDir(), ".upload-*.zip")
	if err != nil {
		fail(w, err)
		return
	}
	defer os.Remove(tmp.Name())
	defer tmp.Close()
	size, err := io.Copy(tmp, r.Body)
	if err != nil {
		writeError(w, http.StatusBadRequest, "The upload didn't finish. Try again.")
		return
	}
	name, err = s.Store.ImportZip(name, tmp, size, overwrite)
	importResult(w, name, err)
}

func (s *Server) handleUploadFolder(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, maxUploadBody)
	if err := r.ParseMultipartForm(32 << 20); err != nil {
		writeError(w, http.StatusBadRequest, "The upload didn't finish. Try again.")
		return
	}
	defer r.MultipartForm.RemoveAll()
	// Multipart file names lose their folders, so each file's path inside the
	// world arrives in a matching "paths" field.
	uploads, paths := r.MultipartForm.File["files"], r.MultipartForm.Value["paths"]
	if len(paths) != len(uploads) {
		writeError(w, http.StatusBadRequest, "The upload is missing file paths. Reload the page and try again.")
		return
	}
	var files []worlds.UploadFile
	for i, fh := range uploads {
		files = append(files, worlds.UploadFile{Path: paths[i], Open: func() (io.ReadCloser, error) { return fh.Open() }})
	}
	name := r.URL.Query().Get("name")
	name, err := s.Store.ImportFolder(name, files, r.URL.Query().Get("overwrite") == "1")
	importResult(w, name, err)
}

// ── Files ────────────────────────────────────────────────────────────────────

func (s *Server) handleRead(w http.ResponseWriter, r *http.Request) {
	var body pathBody
	if !readJSON(w, r, &body) {
		return
	}
	res, err := s.Store.Read(body.Path)
	if err != nil {
		fail(w, err)
		return
	}
	writeJSON(w, http.StatusOK, res)
}

func (s *Server) handleList(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Path      string `json:"path"`
		Extension string `json:"extension"`
		Mode      string `json:"mode"`
	}
	if !readJSON(w, r, &body) {
		return
	}
	res, err := s.Store.ListDir(body.Path, body.Extension, body.Mode == "index")
	if err != nil {
		fail(w, err)
		return
	}
	writeJSON(w, http.StatusOK, res)
}

func (s *Server) handleWrite(w http.ResponseWriter, r *http.Request) {
	var body worlds.WriteItem
	if !readJSON(w, r, &body) {
		return
	}
	if err := s.Store.Write(body.Path, body.Content); err != nil {
		fail(w, err)
		return
	}
	writeJSON(w, http.StatusOK, success)
}

func (s *Server) handleWriteBatch(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Items []worlds.WriteItem `json:"items"`
	}
	if !readJSON(w, r, &body) {
		return
	}
	if err := s.Store.WriteBatch(body.Items); err != nil {
		fail(w, err)
		return
	}
	writeJSON(w, http.StatusOK, success)
}

func (s *Server) handleDelete(w http.ResponseWriter, r *http.Request) {
	var body pathBody
	if !readJSON(w, r, &body) {
		return
	}
	if err := s.Store.Delete(body.Path); err != nil {
		fail(w, err)
		return
	}
	writeJSON(w, http.StatusOK, success)
}

func (s *Server) handleMapImage(w http.ResponseWriter, r *http.Request) {
	var body pathBody
	if !readJSON(w, r, &body) {
		return
	}
	_, full, err := s.Store.Resolve(body.Path)
	if err != nil {
		fail(w, err)
		return
	}
	b, err := os.ReadFile(full)
	if errors.Is(err, fs.ErrNotExist) {
		writeJSON(w, http.StatusOK, nil)
		return
	} else if err != nil {
		fail(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"base64": base64.StdEncoding.EncodeToString(b)})
}

func (s *Server) handleTrashList(w http.ResponseWriter, r *http.Request) {
	items, err := s.Store.TrashList(r.PathValue("world"))
	if err != nil {
		fail(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (s *Server) handleTrashRestore(w http.ResponseWriter, r *http.Request) {
	var body pathBody
	if !readJSON(w, r, &body) {
		return
	}
	restored, err := s.Store.TrashRestore(body.Path)
	if err != nil {
		if errors.Is(err, worlds.ErrForbidden) {
			fail(w, err)
			return
		}
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"success": true, "restoredPath": restored})
}

func (s *Server) handleTrashPurge(w http.ResponseWriter, r *http.Request) {
	var body pathBody
	if !readJSON(w, r, &body) {
		return
	}
	if err := s.Store.TrashPurge(body.Path); err != nil {
		fail(w, err)
		return
	}
	writeJSON(w, http.StatusOK, success)
}

// ── Images ───────────────────────────────────────────────────────────────────

func (s *Server) handleStamps(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{"stamps": s.Store.Stamps()})
}

func (s *Server) handleStampImage(w http.ResponseWriter, r *http.Request) {
	full, err := s.Store.StampFile(r.URL.Query().Get("rel"))
	if err != nil {
		fail(w, err)
		return
	}
	b, err := os.ReadFile(full)
	if err != nil {
		fail(w, err)
		return
	}
	mime := worlds.MimeFor(filepath.Ext(full))
	writeJSON(w, http.StatusOK, map[string]string{"dataUrl": "data:" + mime + ";base64," + base64.StdEncoding.EncodeToString(b)})
}

func (s *Server) handleListAssets(w http.ResponseWriter, r *http.Request) {
	list, err := s.Store.Assets(r.PathValue("world"))
	if err != nil {
		fail(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"assets": list})
}

func (s *Server) handleAddAssets(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, maxUploadBody)
	if err := r.ParseMultipartForm(32 << 20); err != nil {
		writeError(w, http.StatusBadRequest, "The upload didn't finish. Try again.")
		return
	}
	defer r.MultipartForm.RemoveAll()
	world := r.PathValue("world")
	imported := []string{}
	for _, fh := range r.MultipartForm.File["files"] {
		f, err := fh.Open()
		if err != nil {
			fail(w, err)
			return
		}
		name, err := s.Store.AddAsset(world, fh.Filename, f)
		f.Close()
		if errors.Is(err, worlds.ErrForbidden) {
			fail(w, err)
			return
		} else if err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		imported = append(imported, name)
	}
	writeJSON(w, http.StatusOK, map[string]any{"success": true, "imported": imported})
}

func (s *Server) handleDeleteAsset(w http.ResponseWriter, r *http.Request) {
	if err := s.Store.DeleteAsset(r.PathValue("world"), r.PathValue("path")); err != nil {
		fail(w, err)
		return
	}
	writeJSON(w, http.StatusOK, success)
}

// handleAsset serves the images saved links point at ("asset://World/path").
// Map images are stored as data: URLs in .img files and are decoded here.
func (s *Server) handleAsset(w http.ResponseWriter, r *http.Request) {
	_, full, err := s.Store.Resolve(r.PathValue("world") + "/" + r.PathValue("path"))
	if err != nil {
		fail(w, err)
		return
	}
	h := w.Header()
	// Uploaded SVGs are untrusted: never let one run script on this site.
	h.Set("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; sandbox")
	h.Set("Cache-Control", "private, no-cache")

	if strings.HasSuffix(full, ".img") {
		b, err := os.ReadFile(full)
		if err != nil {
			fail(w, worlds.ErrNotFound)
			return
		}
		if mime, data, ok := parseDataURL(string(b)); ok {
			h.Set("Content-Type", mime)
			w.Write(data)
			return
		}
	}
	f, err := os.Open(full)
	if err != nil {
		fail(w, worlds.ErrNotFound)
		return
	}
	defer f.Close()
	fi, err := f.Stat()
	if err != nil || fi.IsDir() {
		fail(w, worlds.ErrNotFound)
		return
	}
	if ext := strings.ToLower(filepath.Ext(full)); ext != "" {
		h.Set("Content-Type", worlds.MimeFor(ext))
	}
	http.ServeContent(w, r, fi.Name(), fi.ModTime(), f)
}

func parseDataURL(s string) (mime string, data []byte, ok bool) {
	rest, found := strings.CutPrefix(strings.TrimSpace(s), "data:image/")
	if !found {
		return "", nil, false
	}
	meta, payload, found := strings.Cut(rest, ";base64,")
	if !found || strings.ContainsAny(meta, ";,") {
		return "", nil, false
	}
	data, err := base64.StdEncoding.DecodeString(payload)
	if err != nil {
		return "", nil, false
	}
	return "image/" + meta, data, true
}

// ── Backups ──────────────────────────────────────────────────────────────────

func (s *Server) handleGetBackup(w http.ResponseWriter, r *http.Request) {
	c, err := s.State.Backup()
	if err != nil {
		fail(w, err)
		return
	}
	writeJSON(w, http.StatusOK, c)
}

func (s *Server) handlePutBackup(w http.ResponseWriter, r *http.Request) {
	var in state.BackupConfig
	if !readJSON(w, r, &in) {
		return
	}
	cur, err := s.State.Backup()
	if err != nil {
		fail(w, err)
		return
	}
	cur.Location = strings.TrimSpace(in.Location)
	if cur.Location == "" {
		cur.Location = "Backups"
	}
	cur.Frequency = max(in.Frequency, 0)
	cur.RetentionDays = max(in.RetentionDays, 0)
	if err := s.State.SetBackup(cur); err != nil {
		fail(w, err)
		return
	}
	writeJSON(w, http.StatusOK, cur)
}

func (s *Server) handleRunBackup(w http.ResponseWriter, r *http.Request) {
	var body struct {
		World string `json:"world"`
	}
	if !readJSON(w, r, &body) {
		return
	}
	c, err := s.State.Backup()
	if err != nil {
		fail(w, err)
		return
	}
	now := time.Now()
	res, err := s.Store.Backup(c.Location, body.World, c.RetentionDays, now)
	if err != nil {
		fail(w, err)
		return
	}
	s.State.MarkBackup(now)
	writeJSON(w, http.StatusOK, res)
}

// RunBackups backs up every world on the configured schedule until stop closes.
func (s *Server) RunBackups(stop <-chan struct{}) {
	tick := time.NewTicker(time.Minute)
	defer tick.Stop()
	for {
		select {
		case <-stop:
			return
		case <-tick.C:
		}
		c, err := s.State.Backup()
		if err != nil || c.Frequency <= 0 {
			continue
		}
		now := time.Now()
		if c.LastBackupAt != nil {
			if last, err := time.Parse(time.RFC3339Nano, *c.LastBackupAt); err == nil && now.Sub(last) < time.Duration(c.Frequency)*time.Minute {
				continue
			}
		}
		list, err := s.Store.ListWorlds()
		if err != nil {
			log.Printf("backup: %v", err)
			continue
		}
		for _, world := range list {
			if _, err := s.Store.Backup(c.Location, world, c.RetentionDays, now); err != nil {
				log.Printf("backup %s: %v", world, err)
			}
		}
		s.State.MarkBackup(now)
		log.Printf("backup: backed up %d worlds to %s", len(list), s.Store.BackupDir(c.Location))
	}
}

// ── Web app ──────────────────────────────────────────────────────────────────

// handleWebUI serves the built app, falling back to index.html for the
// app's own routes (/characters/…, /maps/…).
func (s *Server) handleWebUI(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet && r.Method != http.MethodHead {
		writeError(w, http.StatusMethodNotAllowed, "Method not allowed.")
		return
	}
	name := strings.TrimPrefix(path.Clean(r.URL.Path), "/")
	if name != "" {
		if fi, err := fs.Stat(s.WebUI, name); err == nil && !fi.IsDir() {
			if strings.HasPrefix(name, "assets/") {
				w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
			} else {
				w.Header().Set("Cache-Control", "no-cache")
			}
			http.ServeFileFS(w, r, s.WebUI, name)
			return
		}
	}
	index, err := fs.ReadFile(s.WebUI, "index.html")
	if err != nil {
		http.Error(w, "The web app isn't built into this binary. Run the Docker build.", http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Cache-Control", "no-cache")
	w.Write(index)
}
