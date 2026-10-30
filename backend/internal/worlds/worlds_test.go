package worlds

import (
	"archive/zip"
	"bytes"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func newStore(t *testing.T) *Store {
	t.Helper()
	s := &Store{DataDir: t.TempDir()}
	if _, err := s.CreateWorld("Dungeon_Walker"); err != nil {
		t.Fatal(err)
	}
	return s
}

func TestResolveRefusesEscapes(t *testing.T) {
	s := newStore(t)
	for _, p := range []string{"..", "../secret", "../session.key", "Dungeon_Walker/../../etc/passwd", ".hidden/x.md", "Dungeon_Walker/../Other/x.md", `Dungeon_Walker\..\..\x`, "/etc/passwd", ""} {
		if _, _, err := s.Resolve(p); !errors.Is(err, ErrForbidden) {
			t.Errorf("Resolve(%q) = %v, want ErrForbidden", p, err)
		}
	}
	if _, full, err := s.Resolve("Dungeon_Walker/characters/a.md"); err != nil || !strings.HasSuffix(full, filepath.Join("Worlds", "Dungeon_Walker", "characters", "a.md")) {
		t.Errorf("valid path: %q %v", full, err)
	}
}

func TestCreateWorldMakesSameFoldersAsDesktop(t *testing.T) {
	s := newStore(t)
	name, _ := s.CreateWorld("My World!")
	if name != "My_World_" {
		t.Errorf("name = %q, want My_World_", name)
	}
	for _, f := range requiredFolders {
		if _, err := os.Stat(filepath.Join(s.WorldsDir(), name, f)); err != nil {
			t.Errorf("missing folder %s", f)
		}
	}
	list, _ := s.ListWorlds()
	if len(list) != 2 {
		t.Errorf("worlds = %v", list)
	}
}

const entry = "---\nid: \"c1\"\nname: \"Aria\"\ntags: [\"hero\"]\n---\n\nShe walks the dungeon."

func TestWriteReadAndIndex(t *testing.T) {
	s := newStore(t)
	p := "Dungeon_Walker/characters/c1.md"
	if err := s.Write(p, entry); err != nil {
		t.Fatal(err)
	}
	if err := s.Write(p, entry+" Again."); err != nil {
		t.Fatal(err)
	}
	_, full, _ := s.Resolve(p)
	if b, _ := os.ReadFile(full + ".bak"); string(b) != entry {
		t.Errorf(".bak should hold the previous version, got %q", b)
	}
	if _, err := os.Stat(full + ".tmp"); err == nil {
		t.Error(".tmp left behind")
	}
	r, _ := s.Read(p)
	if r == nil || r.IsDir || *r.Content != entry+" Again." {
		t.Errorf("read = %+v", r)
	}
	if r, _ := s.Read("Dungeon_Walker/characters/missing.md"); r != nil {
		t.Error("missing file should read as nil")
	}
	idx, _ := s.ListDir("Dungeon_Walker/characters", ".md", true)
	if len(idx) != 1 || *idx[0].Frontmatter != "id: \"c1\"\nname: \"Aria\"\ntags: [\"hero\"]" {
		t.Errorf("index = %+v", idx)
	}
	all, _ := s.ListDir("Dungeon_Walker/characters", ".md", false)
	if len(all) != 1 {
		t.Errorf("content list skipped .bak? got %d entries", len(all))
	}
}

func TestFrontmatterMatchesDesktopRegex(t *testing.T) {
	cases := map[string]string{
		"---\na: 1\n---\nbody":      "a: 1",
		"---\n\n---\n":              "",
		"no front matter":           "",
		"---\na: 1\nb: 2\n---\n---": "a: 1\nb: 2",
	}
	for in, want := range cases {
		if got := Frontmatter(in); got != want {
			t.Errorf("Frontmatter(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestDeleteRestorePurge(t *testing.T) {
	s := newStore(t)
	p := "Dungeon_Walker/characters/c1.md"
	s.Write(p, entry)
	s.Write(p, entry) // leaves a .bak
	if err := s.Delete(p); err != nil {
		t.Fatal(err)
	}
	items, _ := s.TrashList("Dungeon_Walker")
	if len(items) != 1 || items[0].TrashPath != "Dungeon_Walker/trash/characters/c1.md" || items[0].Collection != "characters" || items[0].ID != "c1" {
		t.Fatalf("trash = %+v", items)
	}
	_, full, _ := s.Resolve(p)
	if _, err := os.Stat(full + ".bak"); err == nil {
		t.Error("delete should remove the .bak")
	}
	// A second delete of the same id keeps both copies.
	s.Write(p, entry)
	s.Delete(p)
	if items, _ := s.TrashList("Dungeon_Walker"); len(items) != 2 {
		t.Errorf("want 2 trash items, got %d", len(items))
	}
	restored, err := s.TrashRestore("Dungeon_Walker/trash/characters/c1.md")
	if err != nil || restored != p {
		t.Fatalf("restore = %q %v", restored, err)
	}
	if _, err := s.TrashRestore("Dungeon_Walker/trash/characters/c1.md"); err == nil {
		t.Error("restoring over an existing file should fail")
	}
	if err := s.TrashPurge("Dungeon_Walker/characters/c1.md"); err == nil {
		t.Error("purge outside trash should fail")
	}
	for _, p := range []string{"Dungeon_Walker/trash/../characters/c1.md", "Dungeon_Walker/trash/"} {
		if err := s.TrashPurge(p); !errors.Is(err, ErrForbidden) {
			t.Errorf("TrashPurge(%q) = %v, want ErrForbidden", p, err)
		}
	}
	if _, err := s.TrashRestore("Dungeon_Walker/trash/../characters/c1.md"); !errors.Is(err, ErrForbidden) {
		t.Errorf("restore from outside trash = %v, want ErrForbidden", err)
	}
	if _, err := os.Stat(full); err != nil {
		t.Error("a live entry was deleted through the trash")
	}
}

func TestZipRoundTripAndWrappedZip(t *testing.T) {
	s := newStore(t)
	s.Write("Dungeon_Walker/characters/c1.md", entry)
	s.Write("Dungeon_Walker/maps/m1.img", "data:image/png;base64,iVBORw0KGgo=")
	var buf bytes.Buffer
	if err := s.ExportZip("Dungeon_Walker", &buf); err != nil {
		t.Fatal(err)
	}
	zr, _ := zip.NewReader(bytes.NewReader(buf.Bytes()), int64(buf.Len()))
	for _, f := range zr.File {
		if strings.HasPrefix(f.Name, "Dungeon_Walker/") {
			t.Fatalf("entries must be relative to the world, got %s", f.Name)
		}
	}
	if _, err := s.ImportZip("Dungeon_Walker", bytes.NewReader(buf.Bytes()), int64(buf.Len()), false); !errors.Is(err, ErrExists) {
		t.Errorf("import over existing = %v, want ErrExists", err)
	}
	name, err := s.ImportZip("Copy of World", bytes.NewReader(buf.Bytes()), int64(buf.Len()), false)
	if err != nil || name != "Copy_of_World" {
		t.Fatalf("import = %q %v", name, err)
	}
	if r, _ := s.Read("Copy_of_World/characters/c1.md"); r == nil || *r.Content != entry {
		t.Error("imported entry differs")
	}

	// A Finder-made ZIP wraps everything in one folder.
	var wrapped bytes.Buffer
	zw := zip.NewWriter(&wrapped)
	w, _ := zw.Create("Old World/characters/c1.md")
	w.Write([]byte(entry))
	w, _ = zw.Create("__MACOSX/Old World/._c1.md")
	w.Write([]byte("junk"))
	zw.Close()
	name, err = s.ImportZip("Old World", bytes.NewReader(wrapped.Bytes()), int64(wrapped.Len()), false)
	if err != nil {
		t.Fatal(err)
	}
	if r, _ := s.Read(name + "/characters/c1.md"); r == nil {
		t.Error("wrapper folder wasn't unwrapped")
	}
}

func TestZipSlipRefused(t *testing.T) {
	s := newStore(t)
	var buf bytes.Buffer
	zw := zip.NewWriter(&buf)
	w, _ := zw.Create("../../evil.txt")
	w.Write([]byte("x"))
	zw.Close()
	if _, err := s.ImportZip("Evil", bytes.NewReader(buf.Bytes()), int64(buf.Len()), false); err == nil {
		t.Fatal("zip slip accepted")
	}
	if _, err := os.Stat(filepath.Join(s.DataDir, "evil.txt")); err == nil {
		t.Fatal("file written outside the world")
	}
	if s.WorldExists("Evil") {
		t.Error("failed import left a world")
	}
	entries, _ := os.ReadDir(s.WorldsDir())
	for _, e := range entries {
		if strings.HasPrefix(e.Name(), ".import-") {
			t.Error("staging folder left behind")
		}
	}
}

func TestBackupLayoutAndPruning(t *testing.T) {
	s := newStore(t)
	s.Write("Dungeon_Walker/characters/c1.md", entry)
	s.Write("Dungeon_Walker/characters/c1.md", entry) // .bak must not be copied
	old := filepath.Join(s.DataDir, "Backups", "Dungeon_Walker", "2020-01-01")
	os.MkdirAll(old, 0o755)
	now := time.Date(2026, 10, 29, 14, 5, 9, 0, time.Local)
	res, err := s.Backup("Backups", "Dungeon_Walker", 30, now)
	if err != nil {
		t.Fatal(err)
	}
	want := filepath.Join(s.DataDir, "Backups", "Dungeon_Walker", "2026-10-29", "14-05-09")
	if res.Path != want || res.Pruned != 1 {
		t.Errorf("backup = %+v", res)
	}
	if _, err := os.Stat(filepath.Join(want, "characters", "c1.md")); err != nil {
		t.Error("entry not backed up")
	}
	if _, err := os.Stat(filepath.Join(want, "characters", "c1.md.bak")); err == nil {
		t.Error(".bak backed up")
	}
	if _, err := os.Stat(old); err == nil {
		t.Error("old day folder not pruned")
	}
}

func TestAssets(t *testing.T) {
	s := newStore(t)
	a, err := s.AddAsset("Dungeon_Walker", "my map (1).png", strings.NewReader("png"))
	if err != nil || a != "my_map__1_.png" {
		t.Fatalf("add = %q %v", a, err)
	}
	b, _ := s.AddAsset("Dungeon_Walker", "my map (1).png", strings.NewReader("png"))
	if b != "my_map__1_-1.png" {
		t.Errorf("duplicate saved as %q", b)
	}
	if _, err := s.AddAsset("Dungeon_Walker", "page.html", strings.NewReader("<script>")); err == nil {
		t.Error("non-image accepted")
	}
	list, _ := s.Assets("Dungeon_Walker")
	if len(list) != 2 {
		t.Errorf("assets = %+v", list)
	}
	if err := s.DeleteAsset("Dungeon_Walker", "../characters/c1.md"); !errors.Is(err, ErrForbidden) {
		t.Errorf("delete outside assets = %v", err)
	}
}
