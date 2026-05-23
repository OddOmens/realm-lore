import sys

with open('src/pages/Settings.jsx', 'r') as f:
    code = f.read()

version_history_code = """
function VersionHistoryPanel() {
  const versions = [
    { version: "2026.5.2", date: "May 20, 2026", changes: ["Fixed Express 5 server fallback routing bug.", "Added Version History log."] },
    { version: "2026.5.1", date: "May 20, 2026", changes: ["Added Remote Access Express server for mobile/iPad use.", "Added multi-world support with External World Links via Settings."] },
    { version: "2026.5.0", date: "May 15, 2026", changes: ["Initial Beta Release.", "Added core worldbuilding tools: Characters, Locations, Lore, Maps, and Story Editor."] }
  ];

  return (
    <SectionCard>
      <SectionHeader
        title="About & Version History"
        description="Release notes and updates for Realm Lore."
      />
      <div className="flex flex-col gap-4 mt-2">
        {versions.map((v, i) => (
          <div key={i} className="flex flex-col gap-1 p-3 bg-secondary/30 rounded-lg border border-border">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-primary">v{v.version}</span>
              <span className="text-xs text-muted-foreground">{v.date}</span>
            </div>
            <ul className="list-disc list-inside text-xs text-muted-foreground mt-1 space-y-1">
              {v.changes.map((c, j) => (
                <li key={j}>{c}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}
"""

if "function VersionHistoryPanel" not in code:
    code = code.replace("function GeneralTab() {", version_history_code + "\nfunction GeneralTab() {")

    # Insert into GeneralTab
    code = code.replace(
        "      </SectionCard>\n    </div>\n  );\n}\n\n// ─── Appearance tab",
        "      </SectionCard>\n      <VersionHistoryPanel />\n    </div>\n  );\n}\n\n// ─── Appearance tab"
    )

    with open('src/pages/Settings.jsx', 'w') as f:
        f.write(code)
    print("Version History Added")
else:
    print("Version History already exists")
