// Package transfer imports what the desktop app kept on a Mac: the folder
// made by scripts/export-from-mac.sh (or its .tar.gz). That folder holds
//
//	Worlds/<world>/...           every world, including linked outside folders
//	customStamps/...             map stamps
//	LocalStorage/leveldb/...     the app's browser storage: theme, favorites,
//	                             writing streaks, word goals, backup schedule
package transfer

import (
	"archive/tar"
	"compress/gzip"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/oddomens/realm-lore/internal/state"
	"github.com/oddomens/realm-lore/internal/worlds"
)

type Options struct {
	Overwrite bool // replace worlds and preferences that already exist on the server
}

// Import copies a Mac transfer into the server's data folder and reports
// what it did to out.
func Import(src string, store *worlds.Store, st *state.State, opt Options, out io.Writer) error {
	fi, err := os.Stat(src)
	if err != nil {
		return fmt.Errorf("can't find %s", src)
	}
	if !fi.IsDir() {
		dir, err := os.MkdirTemp(store.DataDir, ".transfer-")
		if err != nil {
			return err
		}
		defer os.RemoveAll(dir)
		fmt.Fprintf(out, "Unpacking %s…\n", filepath.Base(src))
		if err := untar(src, dir); err != nil {
			return fmt.Errorf("unpacking %s: %w", src, err)
		}
		src = dir
	}
	if _, err := os.Stat(filepath.Join(src, "Worlds")); err != nil {
		return fmt.Errorf("%s has no Worlds folder. Is it the folder export-from-mac.sh made?", src)
	}

	if err := importWorlds(src, store, opt, out); err != nil {
		return err
	}
	if err := importStamps(src, store, out); err != nil {
		return err
	}
	return importLocalStorage(src, store, st, opt, out)
}

func importWorlds(src string, store *worlds.Store, opt Options, out io.Writer) error {
	entries, err := os.ReadDir(filepath.Join(src, "Worlds"))
	if err != nil {
		return err
	}
	if err := os.MkdirAll(store.WorldsDir(), 0o755); err != nil {
		return err
	}
	for _, e := range entries {
		name := e.Name()
		if !e.IsDir() || strings.HasPrefix(name, ".") || strings.HasPrefix(name, "_") {
			continue
		}
		if !worlds.ValidWorldName(name) {
			fmt.Fprintf(out, "  skipped %q: that name can't be a folder on the server\n", name)
			continue
		}
		dest, _ := store.WorldDir(name)
		if _, err := os.Stat(dest); err == nil {
			if !opt.Overwrite {
				fmt.Fprintf(out, "  skipped world %q: it already exists on the server (use --overwrite to replace it)\n", name)
				continue
			}
			if err := os.RemoveAll(dest); err != nil {
				return err
			}
		}
		n, err := copyTree(filepath.Join(src, "Worlds", name), dest, false)
		if err != nil {
			return fmt.Errorf("copying world %q: %w", name, err)
		}
		fmt.Fprintf(out, "  world %q: %d files\n", name, n)
	}
	// Creates any folders an older world is missing.
	_, err = store.ListWorlds()
	return err
}

func importStamps(src string, store *worlds.Store, out io.Writer) error {
	from := filepath.Join(src, "customStamps")
	if _, err := os.Stat(from); err != nil {
		return nil
	}
	n, err := copyTree(from, store.StampsDir(), true)
	if err != nil {
		return fmt.Errorf("copying stamps: %w", err)
	}
	fmt.Fprintf(out, "  stamps: %d added\n", n)
	return nil
}

// Keys the desktop app kept for its backup schedule. On the server the
// schedule is its own setting, so these move there instead of into prefs.
var backupKeys = map[string]bool{"backupLocation": true, "backupFreq": true, "backupRetentionDays": true, "backupLastAt": true}

func importLocalStorage(src string, store *worlds.Store, st *state.State, opt Options, out io.Writer) error {
	dbDir := filepath.Join(src, "LocalStorage", "leveldb")
	if _, err := os.Stat(dbDir); err != nil {
		fmt.Fprintln(out, "  preferences: none in this transfer")
		return nil
	}
	work, err := os.MkdirTemp(store.DataDir, ".leveldb-")
	if err != nil {
		return err
	}
	defer os.RemoveAll(work)
	if _, err := copyTree(dbDir, work, false); err != nil {
		return err
	}
	origins, err := ReadLocalStorage(work)
	if err != nil {
		// Worlds matter more than preferences: report it and carry on.
		fmt.Fprintf(out, "  preferences: couldn't read them (%v); they'll start fresh\n", err)
		return nil
	}
	kv, origin := pickOrigin(origins)
	if kv == nil {
		fmt.Fprintln(out, "  preferences: none found")
		return nil
	}

	// Backup schedule. The location only carries over if it's relative:
	// a Mac folder path means nothing inside the container.
	if v, ok := kv["backupFreq"]; ok {
		c, err := st.Backup()
		if err != nil {
			return err
		}
		c.Frequency, _ = strconv.Atoi(v)
		if d, err := strconv.Atoi(kv["backupRetentionDays"]); err == nil {
			c.RetentionDays = d
		}
		if loc := kv["backupLocation"]; loc != "" && !filepath.IsAbs(loc) && !strings.HasPrefix(loc, "~") {
			c.Location = loc
		}
		if err := st.SetBackup(c); err != nil {
			return err
		}
		fmt.Fprintf(out, "  backup schedule: every %d minutes (0 = off), keeping %d days, into %s\n", c.Frequency, c.RetentionDays, store.BackupDir(c.Location))
	}

	existing, err := st.Prefs()
	if err != nil {
		return err
	}
	set := map[string]string{}
	kept := 0
	for k, v := range kv {
		if backupKeys[k] {
			continue
		}
		if _, ok := existing[k]; ok && !opt.Overwrite {
			kept++
			continue
		}
		set[k] = v
	}
	if err := st.PatchPrefs(set, nil); err != nil {
		return err
	}
	fmt.Fprintf(out, "  preferences: %d imported from %s", len(set), origin)
	if kept > 0 {
		fmt.Fprintf(out, ", %d already on the server kept (use --overwrite to replace them)", kept)
	}
	fmt.Fprintln(out)
	return nil
}

// pickOrigin chooses the packaged app's storage (file://) over any
// development server's.
func pickOrigin(origins map[string]map[string]string) (map[string]string, string) {
	if kv, ok := origins["file://"]; ok {
		return kv, "file://"
	}
	var best string
	for o, kv := range origins {
		if best == "" || len(kv) > len(origins[best]) {
			best = o
		}
	}
	return origins[best], best
}

// copyTree copies a folder, skipping macOS clutter and half-written files.
// With keepExisting it never replaces a file already at the destination.
func copyTree(from, to string, keepExisting bool) (int, error) {
	n := 0
	err := filepath.WalkDir(from, func(p string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		rel, _ := filepath.Rel(from, p)
		dest := filepath.Join(to, rel)
		if d.IsDir() {
			return os.MkdirAll(dest, 0o755)
		}
		if !d.Type().IsRegular() || d.Name() == ".DS_Store" || strings.HasSuffix(d.Name(), ".tmp") {
			return nil
		}
		if keepExisting {
			if _, err := os.Stat(dest); err == nil {
				return nil
			}
		}
		if err := copyFile(p, dest); err != nil {
			return err
		}
		n++
		return nil
	})
	return n, err
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

func untar(archive, dest string) error {
	f, err := os.Open(archive)
	if err != nil {
		return err
	}
	defer f.Close()
	gz, err := gzip.NewReader(f)
	if err != nil {
		return fmt.Errorf("not a .tar.gz file")
	}
	tr := tar.NewReader(gz)
	for {
		hdr, err := tr.Next()
		if err == io.EOF {
			return nil
		} else if err != nil {
			return err
		}
		full := filepath.Join(dest, filepath.FromSlash(hdr.Name))
		if full != dest && !strings.HasPrefix(full, dest+string(os.PathSeparator)) {
			return fmt.Errorf("the archive has a file outside its folder (%s)", hdr.Name)
		}
		switch hdr.Typeflag {
		case tar.TypeDir:
			if err := os.MkdirAll(full, 0o755); err != nil {
				return err
			}
		case tar.TypeReg:
			if err := os.MkdirAll(filepath.Dir(full), 0o755); err != nil {
				return err
			}
			w, err := os.OpenFile(full, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0o644)
			if err != nil {
				return err
			}
			if _, err := io.Copy(w, tr); err != nil {
				w.Close()
				return err
			}
			if err := w.Close(); err != nil {
				return err
			}
		}
	}
}
