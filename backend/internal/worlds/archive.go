package worlds

import (
	"archive/zip"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"time"
)

// Limits on what one import may unpack, whatever an archive claims.
const (
	maxImportBytes = 4 << 30
	maxImportFiles = 200_000
)

// ExportZip writes a world as a ZIP whose entries are relative to the world
// folder, the same shape the desktop app exported and imports.
func (s *Store) ExportZip(world string, w io.Writer) error {
	root, err := s.WorldDir(world)
	if err != nil {
		return err
	}
	if fi, err := os.Stat(root); err != nil || !fi.IsDir() {
		return ErrNotFound
	}
	zw := zip.NewWriter(w)
	err = filepath.WalkDir(root, func(p string, d fs.DirEntry, err error) error {
		if err != nil || p == root {
			return err
		}
		rel, _ := filepath.Rel(root, p)
		rel = filepath.ToSlash(rel)
		if d.IsDir() {
			_, err := zw.CreateHeader(&zip.FileHeader{Name: rel + "/", Modified: time.Now()})
			return err
		}
		if !d.Type().IsRegular() {
			return nil
		}
		info, err := d.Info()
		if err != nil {
			return err
		}
		hdr, err := zip.FileInfoHeader(info)
		if err != nil {
			return err
		}
		hdr.Name = rel
		hdr.Method = zip.Deflate
		fw, err := zw.CreateHeader(hdr)
		if err != nil {
			return err
		}
		f, err := os.Open(p)
		if err != nil {
			return err
		}
		defer f.Close()
		_, err = io.Copy(fw, f)
		return err
	})
	if err != nil {
		return err
	}
	return zw.Close()
}

// staging is a hidden folder next to the worlds where an import is unpacked
// before it replaces anything, so a failed import leaves no half-world.
type staging struct {
	dir   string
	bytes int64
	files int
}

func (s *Store) newStaging() (*staging, error) {
	if err := os.MkdirAll(s.WorldsDir(), 0o755); err != nil {
		return nil, err
	}
	dir, err := os.MkdirTemp(s.WorldsDir(), ".import-")
	if err != nil {
		return nil, err
	}
	if err := os.Chmod(dir, 0o755); err != nil {
		os.RemoveAll(dir)
		return nil, err
	}
	return &staging{dir: dir}, nil
}

func (st *staging) add(rel string, r io.Reader) error {
	rel = strings.TrimPrefix(strings.ReplaceAll(rel, `\`, "/"), "/")
	if rel == "" || strings.HasSuffix(rel, "/") {
		return nil
	}
	base := filepath.Base(rel)
	if base == ".DS_Store" || strings.HasPrefix(rel, "__MACOSX/") {
		return nil
	}
	full := filepath.Join(st.dir, filepath.FromSlash(rel))
	if !within(st.dir, full) || full == st.dir {
		return fmt.Errorf("the archive has a file outside its folder (%s)", rel)
	}
	st.files++
	if st.files > maxImportFiles {
		return errors.New("the import has too many files")
	}
	if err := os.MkdirAll(filepath.Dir(full), 0o755); err != nil {
		return err
	}
	f, err := os.OpenFile(full, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0o644)
	if err != nil {
		return err
	}
	n, err := io.Copy(f, io.LimitReader(r, maxImportBytes-st.bytes+1))
	st.bytes += n
	if cerr := f.Close(); err == nil {
		err = cerr
	}
	if err == nil && st.bytes > maxImportBytes {
		err = errors.New("the import is larger than 4 GB")
	}
	return err
}

// root is the folder that holds the world: the staging folder itself, or
// its single subfolder when an archive wrapped everything in one folder
// (as Finder's "Compress" does).
func (st *staging) root() string {
	entries, err := os.ReadDir(st.dir)
	if err != nil || len(entries) != 1 || !entries[0].IsDir() {
		return st.dir
	}
	if slices.Contains(requiredFolders, entries[0].Name()) || entries[0].Name() == "trash" {
		return st.dir // a world with a single collection, not a wrapper
	}
	return filepath.Join(st.dir, entries[0].Name())
}

func (s *Store) commit(st *staging, name string, overwrite bool) error {
	defer os.RemoveAll(st.dir)
	dest, err := s.WorldDir(name)
	if err != nil {
		return err
	}
	src := st.root()
	if err := ensureFolders(src); err != nil {
		return err
	}
	if _, err := os.Stat(dest); err == nil {
		if !overwrite {
			return ErrExists
		}
		if err := os.RemoveAll(dest); err != nil {
			return err
		}
	}
	return os.Rename(src, dest)
}

// ImportZip unpacks a world ZIP as world `name`.
func (s *Store) ImportZip(name string, r io.ReaderAt, size int64, overwrite bool) (string, error) {
	name = SafeName(name)
	if !ValidWorldName(name) {
		return "", ErrForbidden
	}
	if s.WorldExists(name) && !overwrite {
		return name, ErrExists
	}
	zr, err := zip.NewReader(r, size)
	if err != nil {
		return "", errors.New("that file isn't a ZIP archive")
	}
	st, err := s.newStaging()
	if err != nil {
		return "", err
	}
	for _, zf := range zr.File {
		if zf.FileInfo().IsDir() {
			continue
		}
		rc, err := zf.Open()
		if err != nil {
			os.RemoveAll(st.dir)
			return "", err
		}
		err = st.add(zf.Name, rc)
		rc.Close()
		if err != nil {
			os.RemoveAll(st.dir)
			return "", err
		}
	}
	return name, s.commit(st, name, overwrite)
}

type UploadFile struct {
	Path string
	Open func() (io.ReadCloser, error)
}

// ImportFolder saves an uploaded folder of world files as world `name`.
func (s *Store) ImportFolder(name string, files []UploadFile, overwrite bool) (string, error) {
	if !ValidWorldName(name) {
		return "", ErrForbidden
	}
	if s.WorldExists(name) && !overwrite {
		return name, ErrExists
	}
	st, err := s.newStaging()
	if err != nil {
		return "", err
	}
	for _, f := range files {
		rc, err := f.Open()
		if err != nil {
			os.RemoveAll(st.dir)
			return "", err
		}
		err = st.add(f.Path, rc)
		rc.Close()
		if err != nil {
			os.RemoveAll(st.dir)
			return "", err
		}
	}
	// A folder upload has no wrapper to strip: its files arrive relative to it.
	return name, s.commitFlat(st, name, overwrite)
}

func (s *Store) commitFlat(st *staging, name string, overwrite bool) error {
	defer os.RemoveAll(st.dir)
	dest, err := s.WorldDir(name)
	if err != nil {
		return err
	}
	if err := ensureFolders(st.dir); err != nil {
		return err
	}
	if _, err := os.Stat(dest); err == nil {
		if !overwrite {
			return ErrExists
		}
		if err := os.RemoveAll(dest); err != nil {
			return err
		}
	}
	return os.Rename(st.dir, dest)
}

// CleanStaging removes imports and uploads left behind by a crash.
func (s *Store) CleanStaging() {
	entries, _ := os.ReadDir(s.WorldsDir())
	for _, e := range entries {
		if strings.HasPrefix(e.Name(), ".import-") || strings.HasPrefix(e.Name(), ".upload-") {
			os.RemoveAll(filepath.Join(s.WorldsDir(), e.Name()))
		}
	}
}
