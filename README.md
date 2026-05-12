# Realm Lore

A local-first worldbuilding tool for writers and game masters. Build entire universes — characters, locations, lore, timelines, maps, stories — stored as plain Markdown files on your machine.

**No account. No cloud. No subscription. Your data, your machine, forever.**

---

## What it is

Realm Lore is a desktop-first application that gives you a rich creative environment while keeping your data completely under your control. Every entry saves as a standard `.md` file you can open in Obsidian, VS Code, or any text editor.

### Features

- **Characters, Locations, Things, Lore, Factions, Creatures, Races** — rich wiki-style entity pages with custom fields and relationships
- **Interactive Maps** — upload map images, pin locations, draw layers, and place stamps
- **Timeline** — scrollable visual history with custom epochs and events
- **Stories & Library** — write and organize in-world stories and books
- **Name Generator** — fantasy name generation by culture and type
- **Relationship graphs** — see how entities connect
- **Plugin system** — extend with community or custom JS plugins
- **Obsidian compatible** — open your Worlds folder directly in Obsidian
- **Auto-backups** — scheduled backups to any folder on your machine
- **Auto-updates** — new releases install automatically in the background

---

## Installation

### macOS (recommended)

Download the latest `.dmg` from [Releases](https://github.com/OddOmens/realm-lore/releases/latest). Supports Apple Silicon (arm64) and Intel (x64). Includes auto-updates.

### Windows

Download the latest `.exe` installer from [Releases](https://github.com/OddOmens/realm-lore/releases/latest).

### Build from source

Requires [Node.js 18+](https://nodejs.org).

```bash
git clone https://github.com/OddOmens/realm-lore.git
cd realm-lore
npm install
npm run electron:dev
```

---

## Data storage

Your worlds are stored as plain Markdown files in:

- **macOS**: `~/Library/Application Support/realm-lore/Worlds/`
- **Windows**: `%APPDATA%\realm-lore\Worlds\`

Each world is a folder. Each entity is a `.md` file with YAML frontmatter. Back them up, sync with iCloud/Dropbox, version-control with git, or open in any text editor or Obsidian.

---

## Plugins

Drop a plugin folder into the app's `plugins/` directory, then enable it in **Settings → Plugins**. Each plugin is an ESM JavaScript module with a `manifest.json`.

See `plugins/world-stats/` for a working example.

---

## Development

```bash
npm run electron:dev       # Electron app in dev mode (hot reload)
npm run electron:build     # build macOS DMGs (arm64 + x64)
npm run electron:build:win # build Windows installer (x64)
npm run build              # Vite production build only
npm run lint               # ESLint
```

### Stack

- [React 19](https://react.dev) + [Vite](https://vite.dev)
- [Zustand](https://zustand-demo.pmnd.rs) for state
- [Electron](https://www.electronjs.org) for desktop packaging
- [Tailwind CSS](https://tailwindcss.com) for styling
- Plain `.md` files with YAML frontmatter for storage (no database)

---

## Contributing

Issues and PRs welcome. If you find a bug or have a feature request, [open an issue](https://github.com/OddOmens/realm-lore/issues).

---

## License

MIT © [OddOmens](https://github.com/OddOmens)
