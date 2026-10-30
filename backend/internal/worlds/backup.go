package worlds

import (
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"
)

type BackupResult struct {
	Success   bool   `json:"success"`
	Path      string `json:"path"`
	Date      string `json:"date"`
	Time      string `json:"time"`
	Pruned    int    `json:"pruned"`
	Timestamp string `json:"timestamp"`
}

// BackupDir resolves a backup location: relative paths are inside the data
// folder (the default is "Backups"), absolute ones are used as given.
func (s *Store) BackupDir(location string) string {
	if location == "" {
		location = "Backups"
	}
	if filepath.IsAbs(location) {
		return filepath.Clean(location)
	}
	return filepath.Join(s.DataDir, location)
}

var dayFolder = regexp.MustCompile(`^(\d{4})-(\d{2})-(\d{2})$`)

// Backup copies a world to <location>/<world>/<YYYY-MM-DD>/<HH-MM-SS> and
// removes day folders older than retentionDays (0 keeps them all). Same
// layout as the desktop app's backups.
func (s *Store) Backup(location, world string, retentionDays int, now time.Time) (*BackupResult, error) {
	src, err := s.WorldDir(world)
	if err != nil {
		return nil, err
	}
	if fi, err := os.Stat(src); err != nil || !fi.IsDir() {
		return nil, ErrNotFound
	}
	worldRoot := filepath.Join(s.BackupDir(location), world)
	date, clock := now.Format("2006-01-02"), now.Format("15-04-05")
	target := filepath.Join(worldRoot, date, clock)

	err = filepath.WalkDir(src, func(p string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		name := d.Name()
		if p != src && (name == ".trash" || name == ".DS_Store" || strings.HasSuffix(name, ".bak") || strings.HasSuffix(name, ".tmp")) {
			if d.IsDir() {
				return filepath.SkipDir
			}
			return nil
		}
		rel, _ := filepath.Rel(src, p)
		dest := filepath.Join(target, rel)
		if d.IsDir() {
			return os.MkdirAll(dest, 0o755)
		}
		if !d.Type().IsRegular() {
			return nil
		}
		return copyFile(p, dest)
	})
	if err != nil {
		return nil, err
	}

	pruned := 0
	if retentionDays > 0 {
		y, m, dd := now.Date()
		cutoff := time.Date(y, m, dd, 0, 0, 0, 0, now.Location()).AddDate(0, 0, -retentionDays)
		entries, _ := os.ReadDir(worldRoot)
		for _, e := range entries {
			if !dayFolder.MatchString(e.Name()) {
				continue
			}
			day, err := time.ParseInLocation("2006-01-02", e.Name(), now.Location())
			if err == nil && day.Before(cutoff) {
				if os.RemoveAll(filepath.Join(worldRoot, e.Name())) == nil {
					pruned++
				}
			}
		}
	}
	return &BackupResult{Success: true, Path: target, Date: date, Time: clock, Pruned: pruned, Timestamp: now.UTC().Format(time.RFC3339Nano)}, nil
}

func copyFile(src, dest string) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()
	out, err := os.Create(dest)
	if err != nil {
		return err
	}
	if _, err := io.Copy(out, in); err != nil {
		out.Close()
		return err
	}
	return out.Close()
}
