package transfer

import (
	"bytes"
	"encoding/binary"
	"errors"
	"unicode/utf16"

	"github.com/syndtr/goleveldb/leveldb"
	"github.com/syndtr/goleveldb/leveldb/opt"
)

// ReadLocalStorage reads a Chromium/Electron "Local Storage/leveldb" folder
// and returns each origin's keys and values.
//
// Chromium stores each item under "_" + origin + "\x00" + key, and both key
// and value start with a format byte: 0 for UTF-16LE text, 1 for Latin-1.
func ReadLocalStorage(dir string) (map[string]map[string]string, error) {
	db, err := leveldb.OpenFile(dir, &opt.Options{ReadOnly: true, ErrorIfMissing: true})
	if err != nil {
		return nil, err
	}
	defer db.Close()

	out := map[string]map[string]string{}
	it := db.NewIterator(nil, nil)
	defer it.Release()
	for it.Next() {
		k := it.Key()
		if len(k) < 2 || k[0] != '_' {
			continue
		}
		sep := bytes.IndexByte(k, 0)
		if sep < 0 {
			continue
		}
		origin := string(k[1:sep])
		key, err1 := decodeString(k[sep+1:])
		val, err2 := decodeString(it.Value())
		if err1 != nil || err2 != nil {
			continue
		}
		if out[origin] == nil {
			out[origin] = map[string]string{}
		}
		out[origin][key] = val
	}
	return out, it.Error()
}

func decodeString(b []byte) (string, error) {
	if len(b) == 0 {
		return "", errors.New("empty")
	}
	switch b[0] {
	case 0: // UTF-16LE
		body := b[1:]
		if len(body)%2 != 0 {
			return "", errors.New("odd UTF-16 length")
		}
		u := make([]uint16, len(body)/2)
		for i := range u {
			u[i] = binary.LittleEndian.Uint16(body[2*i:])
		}
		return string(utf16.Decode(u)), nil
	case 1: // Latin-1
		r := make([]rune, len(b)-1)
		for i, c := range b[1:] {
			r[i] = rune(c)
		}
		return string(r), nil
	}
	return "", errors.New("unknown string format")
}
