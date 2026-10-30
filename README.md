# Realm Lore

A self-hosted worldbuilding tool for writers and game masters. Build entire universes — characters, locations, lore, timelines, maps, stories — stored as plain Markdown files on your own server.

**No third-party cloud. No subscription. Your data, your server, forever.**

---

## What it is

Realm Lore is a self-hosted web app that gives you a rich creative environment while keeping your data completely under your control. Every entry saves as a standard `.md` file you can open in Obsidian, VS Code, or any text editor.

### Features

- **Characters, Locations, Things, Lore, Factions, Creatures, Races** — rich wiki-style entity pages with custom fields and relationships
- **Interactive Maps** — upload map images, pin locations, draw layers, and place stamps
- **Timeline** — scrollable visual history with custom epochs and events
- **Stories & Library** — write and organize in-world stories and books
- **Name Generator** — fantasy name generation by culture and type
- **Relationship graphs** — see how entities connect
- **Obsidian compatible** — open your Worlds folder directly in Obsidian
- **Auto-backups** — scheduled backups on the server, whether or not the app is open
- **Any device** — use it from any browser; preferences follow you

---

## Installation

### Docker

```bash
git clone https://github.com/OddOmens/realm-lore.git
cd realm-lore
cp .env.example .env        # set REALMLORE_PASSWORD
mkdir -p data               # create it yourself, or Docker makes it owned by root
docker compose up -d --build
```

Open `http://<server>:8095` and sign in with that password. Keep it on your LAN or Tailscale; put HTTPS in front of it before exposing it any further.

Update: `git pull && docker compose up -d --build`

---

## Moving from the Mac app

Your worlds are plain Markdown folders and the server uses the same layout, so they move over unchanged. Preferences that the Mac app kept inside itself (theme, favorites, writing streaks, word goals, D&D tool state, backup schedule) come across too.

1. **On the Mac:** quit Realm Lore, then run

   ```bash
   bash scripts/export-from-mac.sh
   ```

   It saves `realm-lore-transfer-<date>.tar.gz` to your Desktop: every world (including world folders you linked from elsewhere), your map stamps and your preferences. Nothing on the Mac is changed.

2. **Copy that file to the server**, next to `docker-compose.yml`.

3. **Import it** (the server can be running or stopped):

   ```bash
   docker compose run --rm -v ./realm-lore-transfer-2026-10-29.tar.gz:/transfer.tar.gz:ro realm-lore import /transfer.tar.gz
   ```

   Worlds that already exist on the server are skipped; add `--overwrite` to replace them.

4. Sign in. Your worlds, theme and favorites are where you left them.

You can also move one world at a time from the app itself: export it as a ZIP from the Mac app (**Settings → Data → Export**), then **Settings → Data → Import ZIP Archive…** on the server.

---

## Data storage

Everything lives in `./data` on the server:

```
data/
  Worlds/<world>/<collection>/<id>.md   one entry per file: JSON front matter + Markdown
  Worlds/<world>/maps/<id>.img          map images (data: URLs)
  Worlds/<world>/assets/                uploaded images
  Worlds/<world>/trash/                 deleted entries, restorable from Trash
  customStamps/                         map stamps shared by every world
  Backups/<world>/<date>/<time>/        automatic backups
  prefs.json, backup.json               your preferences and backup schedule
```

Open the Markdown files in any editor or Obsidian. Each save keeps the previous version as `<id>.md.bak`.

**Backups** run on the server on the schedule set in **Settings → Data → Automated Backups**, whether or not anyone has the app open. A location like `Backups` is inside `./data`; to back up somewhere else, mount that folder into the container and use its path there.

---

## Development

```bash
# Server (needs Go 1.26+), on :8080 with data in ./data
cd backend && REALMLORE_PASSWORD=dev REALMLORE_DATA_DIR=../data go run ./cmd/realmlore

# Web app with hot reload, on http://127.0.0.1:5180 (proxies /api to :8080)
cd frontend && npm install && npm run dev
```

`cd backend && go test ./...` runs the server tests. The Docker build runs them too.

### Stack

- Go server: one static binary with the web app built in, in a distroless image
- [React 19](https://react.dev) + [Vite](https://vite.dev), [Zustand](https://zustand-demo.pmnd.rs) for state, [Tailwind CSS](https://tailwindcss.com) for styling
- Plain `.md` files for storage (no database)

---

## Contributing

Issues and PRs welcome. If you find a bug or have a feature request, [open an issue](https://github.com/OddOmens/realm-lore/issues).

---

## License

MIT © [OddOmens](https://github.com/OddOmens)
