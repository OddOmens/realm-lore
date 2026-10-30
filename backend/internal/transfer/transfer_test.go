package transfer

import (
	"bytes"
	"encoding/binary"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"unicode/utf16"

	"github.com/oddomens/realm-lore/internal/state"
	"github.com/oddomens/realm-lore/internal/worlds"
	"github.com/syndtr/goleveldb/leveldb"
)

func latin1(s string) []byte { return append([]byte{1}, s...) }

func utf16le(s string) []byte {
	b := []byte{0}
	for _, u := range utf16.Encode([]rune(s)) {
		b = binary.LittleEndian.AppendUint16(b, u)
	}
	return b
}

func chromiumKey(origin string, key []byte) []byte {
	return append(append([]byte("_"+origin), 0), key...)
}

// makeMacTransfer builds a folder shaped like export-from-mac.sh's output,
// with browser storage written in Chromium's format.
func makeMacTransfer(t *testing.T) string {
	t.Helper()
	dir := t.TempDir()
	w := filepath.Join(dir, "Worlds", "Dungeon_Walker", "characters")
	os.MkdirAll(w, 0o755)
	os.WriteFile(filepath.Join(w, "c1.md"), []byte("---\nid: \"c1\"\n---\n\nHi"), 0o644)
	os.WriteFile(filepath.Join(w, ".DS_Store"), []byte("x"), 0o644)
	os.MkdirAll(filepath.Join(dir, "customStamps"), 0o755)
	os.WriteFile(filepath.Join(dir, "customStamps", "tower.png"), []byte("png"), 0o644)

	db, err := leveldb.OpenFile(filepath.Join(dir, "LocalStorage", "leveldb"), nil)
	if err != nil {
		t.Fatal(err)
	}
	put := func(origin string, k, v []byte) { db.Put(chromiumKey(origin, k), v, nil) }
	db.Put([]byte("VERSION"), []byte("1"), nil)
	db.Put([]byte("META:file://"), []byte{8, 1}, nil)
	put("file://", latin1("appSettings"), latin1(`{"theme":"parchment"}`))
	put("file://", latin1("activeWorld"), latin1("Dungeon_Walker"))
	put("file://", latin1("favorites_Dungeon_Walker"), utf16le(`["c1","Ærin ✦"]`))
	put("file://", latin1("backupFreq"), latin1("60"))
	put("file://", latin1("backupRetentionDays"), latin1("14"))
	put("file://", latin1("backupLocation"), latin1("/Users/someone/Backups"))
	put("http://localhost:5180", latin1("appSettings"), latin1(`{"theme":"dark"}`))
	db.Close()
	return dir
}

func TestReadLocalStorage(t *testing.T) {
	dir := makeMacTransfer(t)
	got, err := ReadLocalStorage(filepath.Join(dir, "LocalStorage", "leveldb"))
	if err != nil {
		t.Fatal(err)
	}
	if got["file://"]["favorites_Dungeon_Walker"] != `["c1","Ærin ✦"]` {
		t.Errorf("UTF-16 value = %q", got["file://"]["favorites_Dungeon_Walker"])
	}
	if got["http://localhost:5180"]["appSettings"] != `{"theme":"dark"}` {
		t.Error("second origin missing")
	}
}

func TestImport(t *testing.T) {
	src := makeMacTransfer(t)
	data := t.TempDir()
	store := &worlds.Store{DataDir: data}
	st := state.New(data)
	st.PatchPrefs(map[string]string{"activeWorld": "Kept"}, nil)

	var out bytes.Buffer
	if err := Import(src, store, st, Options{}, &out); err != nil {
		t.Fatal(err)
	}
	if r, _ := store.Read("Dungeon_Walker/characters/c1.md"); r == nil {
		t.Fatal("world not imported")
	}
	if _, err := os.Stat(filepath.Join(data, "Worlds", "Dungeon_Walker", "characters", ".DS_Store")); err == nil {
		t.Error(".DS_Store copied")
	}
	if _, err := os.Stat(filepath.Join(data, "customStamps", "tower.png")); err != nil {
		t.Error("stamp not imported")
	}
	prefs, _ := st.Prefs()
	if prefs["appSettings"] != `{"theme":"parchment"}` {
		t.Errorf("should prefer the packaged app's storage, got %q", prefs["appSettings"])
	}
	if prefs["activeWorld"] != "Kept" {
		t.Error("existing pref overwritten without --overwrite")
	}
	if _, ok := prefs["backupFreq"]; ok {
		t.Error("backup keys should move to the backup schedule")
	}
	b, _ := st.Backup()
	if b.Frequency != 60 || b.RetentionDays != 14 || b.Location != "Backups" {
		t.Errorf("backup schedule = %+v (a Mac path must fall back to Backups)", b)
	}

	// Running it again skips the world instead of replacing it.
	out.Reset()
	Import(src, store, st, Options{}, &out)
	if !strings.Contains(out.String(), "already exists") {
		t.Errorf("second import output: %s", out.String())
	}
}
