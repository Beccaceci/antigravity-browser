# Browser integration research

## Evidence and coverage

R1 — Local package inventory: no standalone Codex.app or Claude.app was found in /Applications, ~/Applications, or Spotlight. A Codex-containing bundle was subsequently located at `/Applications/ChatGPT.app/Contents/Resources/app.asar`, alongside `codex-cli` and a Codex manifest. Presence of these files establishes artifact identity only, not browser implementation behavior.

R2 — REA `analyze_javascript_application` on that ASAR returned `artifact_integrity_mismatch` for unpacked member `node_modules/@worklouder/device-kit-oai/node_modules/@worklouder/wl-device-kit/dist/native/darwin/permissions.node`. Declared SHA-256: `5f2f66c4fe19493bba7ca2e0c322ed256e39f66d4a58865875431c2ddd4d58a1`; calculated: `b74218997ea3eab75d05966ed67baf00fb2e1e3151453c5db4898338f8cf4297`. REA produced no successful application graph or Evidence ID. This is an analysis limitation, not proof of malicious modification. The application was not modified or executed for reverse engineering.

R3 — The installed `@playwright/mcp` 0.0.83 README and runtime MCP tool schemas document direct browser interfaces. Upstream: https://github.com/microsoft/playwright-mcp . The installed pinned package is the source of truth for this implementation.

R4 — Google documents custom MCP integration and global configuration: https://www.antigravity.google/docs/mcp . Runtime acceptance in the installed app is tracked separately in acceptance.md.

## Questions and implications

| Question | Established interface | Implication |
| --- | --- | --- |
| Tab identity | Upstream browser_tabs lists tabs and supports selection by index. | Preserve upstream schema; inspect the tab list before switching. |
| Page observations | browser_snapshot returns structured text; browser_take_screenshot returns image content over MCP. | Send observations directly to Gemini; no separate vision API. |
| Action targets | Structured tools accept a snapshot reference or unique selector; vision tools accept coordinates. | Prefer fresh references; use CSS-pixel viewport screenshots for visual controls. |
| Failure recovery | Snapshots can refresh references; persistent profiles preserve browser state. | Inspect after failures, avoid blind resubmission, and report profile ownership conflicts. |

These are documented upstream capabilities validated by our tests where recorded, not reverse-engineered Codex behavior. Codex internals remain unresolved because R2 prevented static analysis. No Claude or DeepSeek implementation claims are made. REA is not a production dependency.
