# Antigravity Browser

Direct browser tools for Gemini in the Antigravity app, using a visible dedicated Chrome profile. Compact output is enabled by default. Includes structured page controls and screenshot/coordinate tools through the upstream Playwright MCP server. Gemini inference stays in Antigravity; no separate API key is needed.

## Setup

Requires macOS, Node.js 22+, and Google Chrome in `/Applications`.

```sh
./install.sh
```

The installer checks the macOS, Node.js 22+, and Chrome requirements, installs the pinned dependencies, builds the server, merges `~/.gemini/config/mcp_config.json`, and runs diagnostics. Existing MCP servers are preserved and configuration changes are backed up. It records absolute Node and launcher paths: rerun removal and installation if the project or Node executable moves. An existing conflicting entry is never silently replaced. Run `./install.sh --help` for details.

Open Antigravity → Customizations → Installed MCP Servers and refresh the server list (restart the app if necessary). Check that `antigravity-browser` exposes its tools. On the tested app version, a full app restart was needed; refreshing the frontend alone did not reload the server list. For launcher updates, use the server’s three-dot menu → Restart; a full app restart is not required for those. Expect 32 tools (31 browser tools plus saved-output recovery). Add `instructions/browser.md` to the conversation using file context, or paste its contents as instructions. These instructions are not installed globally and do not affect unrelated conversations.

Example request:

> Use antigravity-browser directly. Open example.com, inspect the page, take a screenshot, and report its heading. Do not invoke /browser.

For the first visit to an authenticated site, sign in yourself in the dedicated Chrome window. Profile state persists between server runs.

Uploads follow upstream file-access rules: stage upload files in the artifacts folder or the active MCP workspace. The launcher does not enable unrestricted filesystem access. If a file is denied, copy the specific authorized file into an allowed folder before retrying.

## Commands

```sh
npm start                 # MCP stdio server; normally started by Antigravity
npm run configure         # install MCP configuration
npm run doctor            # check prerequisites and MCP handshake/tool discovery
npm run remove            # remove only our configuration entry
npm test                  # configuration tests
npm run test:browser      # real visible Chrome integration tests, temporary profile
npm run test:economy      # compare verbose/bounded/focused output and recovery
node test/fixture.mjs     # local page for manual Gemini acceptance tests
```

See [output economy and enabling instructions](docs/economy.md) for the measured comparison and recommended Gemini workflow. Full text is saved locally when an oversized result is bounded; use `browser_read_output` to retrieve needed ranges.

The CLI accepts `--output-mode compact|full`, `--config /absolute/config.json` and `--data-dir /absolute/directory` for isolated setups. Use `node dist/cli.js install` to pass these flags directly. Installation/removal do not reload the running Antigravity process.

## Storage and recovery

Browser profile: `~/Library/Application Support/AntigravityBrowser/profile/`.
Artifacts: `~/Library/Application Support/AntigravityBrowser/artifacts/`.
Session lock: `~/Library/Application Support/AntigravityBrowser/session.lock/`.

One MCP connection owns the profile at a time. Close the other connection before retrying. After an abrupt crash, inspect the PID in `session.lock/pid`; remove the lock directory manually only after confirming that process has exited. Chrome may also retain its own profile lock after an abnormal shutdown: close the dedicated Chrome instance normally before retrying. The integration never terminates unrelated browsers.

`npm run remove` preserves profile data and artifacts. To reset logins, first close the server and dedicated Chrome, then explicitly delete this tool's profile folder. Do not copy browser cookies into the repository. Configuration backups remain beside the configuration file and may contain other servers' secrets.

If Node/dependencies are missing, run `npm ci` and `npm run build`. If tools are missing in an existing chat, refresh MCP servers and start a fresh conversation. If Chrome cannot automate a site, complete authentication manually and retry; some sites restrict automation.

## Behavior and limits

Confirmation for consequential actions is an instruction Gemini must follow, not a technical gate. Playwright exposes powerful tools including page JavaScript execution. Grant access only in conversations where you intend browser control. Antigravity's existing permissions also apply. No session recording is enabled by this launcher; screenshots/downloads and Chrome's normal profile state are local. Model inputs still follow Antigravity's data handling.

Gemini 3.8 Flash High passed in-app form, screenshot/coordinate, confirmation, and browser-persistence acceptance tests. See `docs/research.md` for evidence and `docs/acceptance.md` for the verification record and repeatable scenarios. Dependencies and transitive versions are pinned by `package-lock.json`.
