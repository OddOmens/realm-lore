// Package worlds reads and writes Realm Lore worlds on disk. The layout is
// the desktop app's, unchanged, so worlds move between the two as plain
// folders:
//
//	<data>/Worlds/<world>/<collection>/<id>.md   entries (front matter + Markdown)
//	<data>/Worlds/<world>/maps/<id>.img          map images as data: URLs
//	<data>/Worlds/<world>/assets/...             uploaded images
//	<data>/Worlds/<world>/trash/<collection>/... deleted entries
//	<data>/customStamps/...                      map stamps shared by all worlds
package worlds

import (
	"errors"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"time"
)

var (
	ErrNotFound  = errors.New("not found")
	ErrForbidden = errors.New("forbidden")
	ErrExists    = errors.New("already exists")
)

// Folders every world has. The desktop app created the same set.
var requiredFolders = []string{"characters", "locations", "things", "lore", "factions", "creatures", "stories", "relationships", "maps", "books", "customStamps", "assets"}

var unsafeName = regexp.MustCompile(`[^a-zA-Z0-9_-]`)

// SafeName turns a typed name into a folder name, as the desktop app did.
func SafeName(name string) string { return unsafeName.ReplaceAllString(name, "_") }

type Store struct {
	DataDir string
}

func (s *Store) WorldsDir() string { return filepath.Join(s.DataDir, "Worlds") }
func (s *Store) StampsDir() string { return filepath.Join(s.DataDir, "customStamps") }

// ValidWorldName reports whether name can be a world folder. Uploaded
// folders keep their own names, so this allows more than SafeName produces,
// but never anything that leaves the worlds folder.
func ValidWorldName(name string) bool {
	if name == "" || name == "." || name == ".." || strings.HasPrefix(name, ".") || strings.ContainsAny(name, `/\`) {
		return false
	}
	for _, r := range name {
		if r < 0x20 || r == 0x7f {
			return false
		}
	}
	return len(name) <= 200
}

func (s *Store) WorldDir(name string) (string, error) {
	if !ValidWorldName(name) {
		return "", ErrForbidden
	}
	return filepath.Join(s.WorldsDir(), name), nil
}

// within reports whether full is root or inside it.
func within(root, full string) bool {
	return full == root || strings.HasPrefix(full, root+string(os.PathSeparator))
}

// Resolve maps a world-relative path ("World/characters/x.md") to a file
// inside that world, refusing anything that would escape it.
func (s *Store) Resolve(rel string) (world, full string, err error) {
	rel = strings.ReplaceAll(rel, `\`, "/")
	world, rest, _ := strings.Cut(rel, "/")
	root, err := s.WorldDir(world)
	if err != nil {
		return "", "", err
	}
	full = filepath.Join(root, filepath.FromSlash(rest))
	if !within(root, full) {
		return "", "", ErrForbidden
	}
	return world, full, nil
}

func ensureFolders(dir string) error {
	for _, f := range requiredFolders {
		if err := os.MkdirAll(filepath.Join(dir, f), 0o755); err != nil {
			return err
		}
	}
	return nil
}

// ── Worlds ───────────────────────────────────────────────────────────────────

func (s *Store) ListWorlds() ([]string, error) {
	if err := os.MkdirAll(s.WorldsDir(), 0o755); err != nil {
		return nil, err
	}
	entries, err := os.ReadDir(s.WorldsDir())
	if err != nil {
		return nil, err
	}
	worlds := []string{}
	for _, e := range entries {
		n := e.Name()
		if !e.IsDir() || strings.HasPrefix(n, ".") || strings.HasPrefix(n, "_") || !ValidWorldName(n) {
			continue
		}
		if err := ensureFolders(filepath.Join(s.WorldsDir(), n)); err != nil {
			return nil, err
		}
		worlds = append(worlds, n)
	}
	return worlds, nil
}

func (s *Store) CreateWorld(name string) (string, error) {
	safe := SafeName(name)
	dir, err := s.WorldDir(safe)
	if err != nil {
		return "", err
	}
	return safe, ensureFolders(dir)
}

func (s *Store) DeleteWorld(name string) error {
	dir, err := s.WorldDir(name)
	if err != nil {
		return err
	}
	if _, err := os.Stat(dir); err != nil {
		return ErrNotFound
	}
	return os.RemoveAll(dir)
}

func (s *Store) WorldExists(name string) bool {
	dir, err := s.WorldDir(name)
	if err != nil {
		return false
	}
	fi, err := os.Stat(dir)
	return err == nil && fi.IsDir()
}

// ── Files ────────────────────────────────────────────────────────────────────

type ReadResult struct {
	IsDir   bool     `json:"isDir"`
	Files   []string `json:"files,omitempty"`
	Content *string  `json:"content,omitempty"`
}

// Read returns nil when the path doesn't exist.
func (s *Store) Read(rel string) (*ReadResult, error) {
	_, full, err := s.Resolve(rel)
	if err != nil {
		return nil, err
	}
	fi, err := os.Stat(full)
	if errors.Is(err, fs.ErrNotExist) {
		return nil, nil
	} else if err != nil {
		return nil, err
	}
	if fi.IsDir() {
		entries, err := os.ReadDir(full)
		if err != nil {
			return nil, err
		}
		files := make([]string, 0, len(entries))
		for _, e := range entries {
			files = append(files, e.Name())
		}
		return &ReadResult{IsDir: true, Files: files}, nil
	}
	b, err := os.ReadFile(full)
	if err != nil {
		return nil, err
	}
	c := string(b)
	return &ReadResult{Content: &c}, nil
}

type DirEntry struct {
	FileName    string  `json:"fileName"`
	Content     *string `json:"content,omitempty"`
	Frontmatter *string `json:"frontmatter,omitempty"`
}

// Frontmatter returns the block between the opening "---" line and the next
// "\n---", matching the desktop app's /^---\n([\s\S]*?)\n---/.
func Frontmatter(raw string) string {
	if !strings.HasPrefix(raw, "---\n") {
		return ""
	}
	rest := raw[len("---\n"):]
	i := strings.Index(rest, "\n---")
	if i < 0 {
		return ""
	}
	return rest[:i]
}

// ListDir reads every file in a folder (optionally only those ending in ext).
// With indexOnly it returns just each file's front matter.
func (s *Store) ListDir(rel, ext string, indexOnly bool) ([]DirEntry, error) {
	_, full, err := s.Resolve(rel)
	if err != nil {
		return nil, err
	}
	entries, err := os.ReadDir(full)
	if err != nil {
		return []DirEntry{}, nil
	}
	out := []DirEntry{}
	for _, e := range entries {
		if e.IsDir() || (ext != "" && !strings.HasSuffix(e.Name(), ext)) {
			continue
		}
		b, err := os.ReadFile(filepath.Join(full, e.Name()))
		if err != nil {
			continue
		}
		c := string(b)
		if indexOnly {
			fm := Frontmatter(c)
			out = append(out, DirEntry{FileName: e.Name(), Frontmatter: &fm})
		} else {
			out = append(out, DirEntry{FileName: e.Name(), Content: &c})
		}
	}
	return out, nil
}

// writeFile keeps the previous version as <file>.bak and swaps the new one in
// with a rename, so a crash never leaves a half-written entry.
func writeFile(full string, content []byte) error {
	if err := os.MkdirAll(filepath.Dir(full), 0o755); err != nil {
		return err
	}
	if old, err := os.ReadFile(full); err == nil {
		if err := os.WriteFile(full+".bak", old, 0o644); err != nil {
			return err
		}
	}
	tmp := full + ".tmp"
	if err := os.WriteFile(tmp, content, 0o644); err != nil {
		return err
	}
	return os.Rename(tmp, full)
}

func (s *Store) Write(rel, content string) error {
	_, full, err := s.Resolve(rel)
	if err != nil {
		return err
	}
	return writeFile(full, []byte(content))
}

type WriteItem struct {
	Path    string `json:"path"`
	Content string `json:"content"`
}

// WriteBatch checks every path before writing any file.
func (s *Store) WriteBatch(items []WriteItem) error {
	fulls := make([]string, len(items))
	for i, it := range items {
		_, full, err := s.Resolve(it.Path)
		if err != nil {
			return err
		}
		fulls[i] = full
	}
	for i, it := range items {
		if err := writeFile(fulls[i], []byte(it.Content)); err != nil {
			return err
		}
	}
	return nil
}

// Delete moves an entry into its world's trash folder.
func (s *Store) Delete(rel string) error {
	world, full, err := s.Resolve(rel)
	if err != nil {
		return err
	}
	if _, err := os.Stat(full); errors.Is(err, fs.ErrNotExist) {
		return nil
	}
	parts := strings.Split(strings.ReplaceAll(rel, `\`, "/"), "/")
	if len(parts) < 3 {
		return errors.New("invalid trash path")
	}
	root, _ := s.WorldDir(world)
	dest := filepath.Join(root, "trash", filepath.FromSlash(strings.Join(parts[1:], "/")))
	if err := os.MkdirAll(filepath.Dir(dest), 0o755); err != nil {
		return err
	}
	if _, err := os.Stat(dest); err == nil {
		dest = filepath.Join(filepath.Dir(dest), fmt.Sprintf("%d_%s", time.Now().UnixMilli(), filepath.Base(dest)))
	}
	if err := os.Rename(full, dest); err != nil {
		return err
	}
	os.Remove(full + ".bak")
	return nil
}

// ── Trash ────────────────────────────────────────────────────────────────────

type TrashItem struct {
	TrashPath  string `json:"trashPath"`
	Collection string `json:"collection"`
	ID         string `json:"id"`
}

func (s *Store) TrashList(world string) ([]TrashItem, error) {
	root, err := s.WorldDir(world)
	if err != nil {
		return nil, err
	}
	trash := filepath.Join(root, "trash")
	items := []TrashItem{}
	filepath.WalkDir(trash, func(p string, d fs.DirEntry, err error) error {
		if err != nil || d.IsDir() || !strings.HasSuffix(d.Name(), ".md") {
			return nil
		}
		rel, _ := filepath.Rel(trash, p)
		rel = filepath.ToSlash(rel)
		collection, _, _ := strings.Cut(rel, "/")
		items = append(items, TrashItem{
			TrashPath:  world + "/trash/" + rel,
			Collection: collection,
			ID:         strings.TrimSuffix(d.Name(), ".md"),
		})
		return nil
	})
	return items, nil
}

func splitTrashPath(p string) (world, rest string, ok bool) {
	p = strings.ReplaceAll(p, `\`, "/")
	i := strings.Index(p, "/trash/")
	if i < 0 {
		return "", "", false
	}
	return p[:i], p[i+len("/trash/"):], true
}

// resolveTrash maps a trash path to a file inside that world's trash folder,
// so "World/trash/../characters/x.md" can't reach a live entry.
func (s *Store) resolveTrash(world, rest string) (string, error) {
	root, err := s.WorldDir(world)
	if err != nil {
		return "", err
	}
	trash := filepath.Join(root, "trash")
	full := filepath.Join(trash, filepath.FromSlash(rest))
	if !within(trash, full) || full == trash {
		return "", ErrForbidden
	}
	return full, nil
}

func (s *Store) TrashRestore(p string) (string, error) {
	world, rest, ok := splitTrashPath(p)
	if !ok {
		return "", errors.New("not a trash path")
	}
	src, err := s.resolveTrash(world, rest)
	if err != nil {
		return "", err
	}
	_, dest, err := s.Resolve(world + "/" + rest)
	if err != nil {
		return "", err
	}
	if _, err := os.Stat(src); err != nil {
		return "", errors.New("trash entry not found")
	}
	if _, err := os.Stat(dest); err == nil {
		return "", errors.New("a file already exists at the restore destination")
	}
	if err := os.MkdirAll(filepath.Dir(dest), 0o755); err != nil {
		return "", err
	}
	if err := os.Rename(src, dest); err != nil {
		return "", err
	}
	// A map's image, terrain and thumbnail come back with it.
	for _, side := range sideFiles(src) {
		target := filepath.Join(filepath.Dir(dest), filepath.Base(side))
		if _, err := os.Stat(target); err == nil {
			continue
		}
		os.Rename(side, target)
	}
	return world + "/" + rest, nil
}

// sideFiles lists the files stored next to a record that belong to it:
// "<id>.<ext>" beside "<id>.md" (map images, map terrain, thumbnails).
func sideFiles(mdPath string) []string {
	if !strings.HasSuffix(mdPath, ".md") {
		return nil
	}
	base := strings.TrimSuffix(filepath.Base(mdPath), ".md")
	entries, err := os.ReadDir(filepath.Dir(mdPath))
	if err != nil {
		return nil
	}
	var out []string
	for _, e := range entries {
		name := e.Name()
		if e.IsDir() || name == base+".md" || name == base+".md.bak" || !strings.HasPrefix(name, base+".") {
			continue
		}
		out = append(out, filepath.Join(filepath.Dir(mdPath), name))
	}
	return out
}

func (s *Store) TrashPurge(p string) error {
	world, rest, ok := splitTrashPath(p)
	if !ok {
		return errors.New("not a trash path")
	}
	full, err := s.resolveTrash(world, rest)
	if err != nil {
		return err
	}
	sides := sideFiles(full)
	if err := os.Remove(full); err != nil && !errors.Is(err, fs.ErrNotExist) {
		return err
	}
	for _, side := range sides {
		os.Remove(side)
	}
	return nil
}

// ── Images ───────────────────────────────────────────────────────────────────

var stampExts = map[string]bool{".png": true, ".svg": true, ".jpg": true, ".jpeg": true, ".webp": true}
var assetExts = map[string]bool{".png": true, ".svg": true, ".jpg": true, ".jpeg": true, ".webp": true, ".gif": true}

func MimeFor(ext string) string {
	switch strings.ToLower(ext) {
	case ".svg":
		return "image/svg+xml"
	case ".jpg", ".jpeg":
		return "image/jpeg"
	case ".webp":
		return "image/webp"
	case ".gif":
		return "image/gif"
	default:
		return "image/png"
	}
}

type Stamp struct {
	Rel   string `json:"rel"`
	Label string `json:"label"`
	Ext   string `json:"ext"`
}

var labelSep = regexp.MustCompile(`[_-]+`)

func (s *Store) Stamps() []Stamp {
	root := s.StampsDir()
	out := []Stamp{}
	filepath.WalkDir(root, func(p string, d fs.DirEntry, err error) error {
		if err != nil || d.IsDir() {
			return nil
		}
		ext := strings.ToLower(filepath.Ext(d.Name()))
		if !stampExts[ext] {
			return nil
		}
		rel, _ := filepath.Rel(root, p)
		base := strings.TrimSuffix(d.Name(), filepath.Ext(d.Name()))
		out = append(out, Stamp{Rel: filepath.ToSlash(rel), Label: strings.TrimSpace(labelSep.ReplaceAllString(base, " ")), Ext: ext[1:]})
		return nil
	})
	sort.Slice(out, func(i, j int) bool { return out[i].Label < out[j].Label })
	return out
}

func (s *Store) StampFile(rel string) (string, error) {
	root := s.StampsDir()
	full := filepath.Join(root, filepath.FromSlash(rel))
	if !within(root, full) || full == root {
		return "", ErrForbidden
	}
	if _, err := os.Stat(full); err != nil {
		return "", ErrNotFound
	}
	return full, nil
}

type Asset struct {
	Rel   string `json:"rel"`
	Label string `json:"label"`
	Ext   string `json:"ext"`
}

func (s *Store) Assets(world string) ([]Asset, error) {
	root, err := s.WorldDir(world)
	if err != nil {
		return nil, err
	}
	dir := filepath.Join(root, "assets")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return nil, err
	}
	out := []Asset{}
	filepath.WalkDir(dir, func(p string, d fs.DirEntry, err error) error {
		if err != nil || p == dir {
			return nil
		}
		if strings.HasPrefix(d.Name(), ".") {
			if d.IsDir() {
				return filepath.SkipDir
			}
			return nil
		}
		ext := strings.ToLower(filepath.Ext(d.Name()))
		if d.IsDir() || !assetExts[ext] {
			return nil
		}
		rel, _ := filepath.Rel(dir, p)
		out = append(out, Asset{Rel: filepath.ToSlash(rel), Label: d.Name(), Ext: ext[1:]})
		return nil
	})
	sort.Slice(out, func(i, j int) bool { return out[i].Label > out[j].Label })
	return out, nil
}

var unsafeFile = regexp.MustCompile(`[^a-zA-Z0-9.\-_]`)

// AddAsset saves an uploaded image under the world's assets folder and
// returns the name it was saved as (renamed if one already exists).
func (s *Store) AddAsset(world, filename string, r io.Reader) (string, error) {
	root, err := s.WorldDir(world)
	if err != nil {
		return "", err
	}
	dir := filepath.Join(root, "assets")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", err
	}
	name := unsafeFile.ReplaceAllString(filepath.Base(filename), "_")
	ext := strings.ToLower(filepath.Ext(name))
	if !assetExts[ext] || strings.HasPrefix(name, ".") {
		return "", fmt.Errorf("%s isn't a supported image (PNG, JPEG, WebP, SVG or GIF)", filename)
	}
	dest := filepath.Join(dir, name)
	for i := 1; ; i++ {
		if _, err := os.Stat(dest); errors.Is(err, fs.ErrNotExist) {
			break
		}
		base := strings.TrimSuffix(name, filepath.Ext(name))
		dest = filepath.Join(dir, fmt.Sprintf("%s-%d%s", base, i, filepath.Ext(name)))
	}
	f, err := os.OpenFile(dest, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0o644)
	if err != nil {
		return "", err
	}
	if _, err := io.Copy(f, r); err != nil {
		f.Close()
		os.Remove(dest)
		return "", err
	}
	return filepath.Base(dest), f.Close()
}

func (s *Store) DeleteAsset(world, rel string) error {
	root, err := s.WorldDir(world)
	if err != nil {
		return err
	}
	dir := filepath.Join(root, "assets")
	full := filepath.Join(dir, filepath.FromSlash(rel))
	if !within(dir, full) || full == dir {
		return ErrForbidden
	}
	if err := os.Remove(full); err != nil && !errors.Is(err, fs.ErrNotExist) {
		return err
	}
	return nil
}
