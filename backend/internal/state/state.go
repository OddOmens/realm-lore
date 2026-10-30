// Package state keeps the server's small JSON files in the data folder:
// synced preferences, the backup schedule and the first-launch marker.
package state

import (
	"encoding/json"
	"errors"
	"io/fs"
	"os"
	"path/filepath"
	"sync"
	"time"
)

type BackupConfig struct {
	Location      string  `json:"location"`
	Frequency     int     `json:"frequency"`     // minutes between automatic backups; 0 = off
	RetentionDays int     `json:"retentionDays"` // 0 = keep forever
	LastBackupAt  *string `json:"lastBackupAt"`
}

func DefaultBackup() BackupConfig {
	return BackupConfig{Location: "Backups", RetentionDays: 30}
}

type State struct {
	dir string
	mu  sync.Mutex
}

func New(dataDir string) *State { return &State{dir: dataDir} }

func (s *State) path(name string) string { return filepath.Join(s.dir, name) }

func (s *State) load(name string, v any) error {
	b, err := os.ReadFile(s.path(name))
	if errors.Is(err, fs.ErrNotExist) {
		return nil
	} else if err != nil {
		return err
	}
	return json.Unmarshal(b, v)
}

func (s *State) save(name string, v any) error {
	b, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		return err
	}
	tmp := s.path(name + ".tmp")
	if err := os.WriteFile(tmp, b, 0o600); err != nil {
		return err
	}
	return os.Rename(tmp, s.path(name))
}

// ── Preferences ──────────────────────────────────────────────────────────────

func (s *State) Prefs() (map[string]string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	p := map[string]string{}
	return p, s.load("prefs.json", &p)
}

// PatchPrefs sets and removes keys in one write.
func (s *State) PatchPrefs(set map[string]string, remove []string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	p := map[string]string{}
	if err := s.load("prefs.json", &p); err != nil {
		return err
	}
	for k, v := range set {
		p[k] = v
	}
	for _, k := range remove {
		delete(p, k)
	}
	return s.save("prefs.json", p)
}

// ── Backups ──────────────────────────────────────────────────────────────────

func (s *State) Backup() (BackupConfig, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	c := DefaultBackup()
	return c, s.load("backup.json", &c)
}

func (s *State) SetBackup(c BackupConfig) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.save("backup.json", c)
}

// MarkBackup records when the last backup ran.
func (s *State) MarkBackup(at time.Time) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	c := DefaultBackup()
	if err := s.load("backup.json", &c); err != nil {
		return err
	}
	stamp := at.UTC().Format(time.RFC3339Nano)
	c.LastBackupAt = &stamp
	return s.save("backup.json", c)
}

// ── First launch ─────────────────────────────────────────────────────────────

// FirstLaunch reports true once, the first time it's called for this data folder.
func (s *State) FirstLaunch() bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, err := os.Stat(s.path("launched.json")); err == nil {
		return false
	}
	s.save("launched.json", map[string]string{"at": time.Now().UTC().Format(time.RFC3339)})
	return true
}
