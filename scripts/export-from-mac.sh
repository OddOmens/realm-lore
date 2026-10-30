#!/bin/bash
# Packs up everything the Realm Lore Mac app keeps, for the self-hosted server:
# every world (including world folders linked from elsewhere), your map
# stamps, and the app's preferences (theme, favorites, writing streaks, word
# goals, backup schedule).
#
#   1. Quit Realm Lore.
#   2. bash export-from-mac.sh
#   3. Copy the realm-lore-transfer-<date>.tar.gz it puts on your Desktop to
#      the server and follow README → Moving from the Mac app.
#
# Nothing on the Mac is changed or deleted.
set -euo pipefail

say() { printf '%s\n' "$*"; }
die() { printf 'Error: %s\n' "$*" >&2; exit 1; }

SRC=""
for d in "$HOME/Library/Application Support/Realm Lore" "$HOME/Library/Application Support/realm-lore"; do
  if [ -d "$d" ]; then SRC="$d"; break; fi
done
[ -n "$SRC" ] || die "Can't find Realm Lore's data in ~/Library/Application Support. Has the app been opened on this Mac?"

if pgrep -xq "Realm Lore"; then
  die "Realm Lore is still open. Quit it (⌘Q) so its preferences are saved, then run this again."
fi

SETTINGS="$SRC/app-settings.json"
setting() { [ -f "$SETTINGS" ] && plutil -extract "$1" raw -o - "$SETTINGS" 2>/dev/null || true; }

WORLDS_DIR="$(setting worldsDir)"
[ -n "$WORLDS_DIR" ] || WORLDS_DIR="$SRC/Worlds"
[ -d "$WORLDS_DIR" ] || die "The worlds folder ($WORLDS_DIR) doesn't exist."

STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT
mkdir -p "$STAGE/Worlds"

copy() { rsync -a --exclude .DS_Store --exclude '*.tmp' "$1/" "$2/"; }

say "Realm Lore data: $SRC"
say "Worlds folder:   $WORLDS_DIR"
say ""

count=0
for w in "$WORLDS_DIR"/*/; do
  [ -d "$w" ] || continue
  name="$(basename "$w")"
  case "$name" in .*|_*) continue ;; esac
  copy "$w" "$STAGE/Worlds/$name"
  say "  world: $name ($(find "$w" -name '*.md' -not -path '*/trash/*' | wc -l | tr -d ' ') entries)"
  count=$((count + 1))
done

# Worlds linked from other folders. The app showed the linked folder when a
# name matched a world in the worlds folder, so it wins here too.
i=0
while :; do
  path="$(setting "externalWorlds.$i.path")"
  name="$(setting "externalWorlds.$i.name")"
  [ -n "$path" ] || break
  if [ -d "$path" ]; then
    [ -n "$name" ] || name="$(basename "$path")"
    rm -rf "$STAGE/Worlds/$name"
    copy "$path" "$STAGE/Worlds/$name"
    say "  world: $name (linked from $path)"
    count=$((count + 1))
  else
    say "  skipped linked world $name: $path no longer exists"
  fi
  i=$((i + 1))
done
[ "$count" -gt 0 ] || die "No worlds found to export."

if [ -d "$SRC/customStamps" ]; then
  copy "$SRC/customStamps" "$STAGE/customStamps"
  say "  stamps: $(find "$STAGE/customStamps" -type f | wc -l | tr -d ' ')"
fi

if [ -d "$SRC/Local Storage/leveldb" ]; then
  mkdir -p "$STAGE/LocalStorage"
  cp -R "$SRC/Local Storage/leveldb" "$STAGE/LocalStorage/leveldb"
  say "  preferences: included"
else
  say "  preferences: none found (they'll start fresh)"
fi

OUT="$HOME/Desktop/realm-lore-transfer-$(date +%Y-%m-%d).tar.gz"
COPYFILE_DISABLE=1 tar -czf "$OUT" -C "$STAGE" .
say ""
say "Saved $OUT ($(du -h "$OUT" | cut -f1))."
say "Copy it to the server, then follow README → Moving from the Mac app."
