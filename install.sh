#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Install Antigravity Browser from this checkout.

Usage: ./install.sh

The installer checks the macOS, Node.js, and Chrome requirements, installs the
pinned dependencies, builds the MCP server, merges it into Gemini's MCP config,
and runs the server diagnostics. Existing MCP entries are preserved.
EOF
}

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  usage
  exit 0
fi

if [[ "$#" -ne 0 ]]; then
  echo "Unknown argument: $1" >&2
  usage >&2
  exit 2
fi

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "Antigravity Browser currently supports macOS only." >&2
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 22 or newer is required. Install Node.js, then rerun ./install.sh." >&2
  exit 1
fi

node_major="$(node -p 'Number(process.versions.node.split(".")[0])')"
if (( node_major < 22 )); then
  echo "Node.js 22 or newer is required; found $(node --version)." >&2
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is required. Install Node.js with npm, then rerun ./install.sh." >&2
  exit 1
fi

chrome="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
if [[ ! -x "$chrome" ]]; then
  echo "Google Chrome was not found at /Applications/Google Chrome.app." >&2
  exit 1
fi

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
if [[ ! -f "$script_dir/package-lock.json" || ! -f "$script_dir/package.json" ]]; then
  echo "Run this installer from a complete Antigravity Browser checkout." >&2
  exit 1
fi

cd "$script_dir"
echo "Installing pinned dependencies..."
npm ci

echo "Building Antigravity Browser..."
npm run build

echo "Adding antigravity-browser to Gemini's MCP configuration..."
npm run configure

echo "Checking the MCP server..."
doctor_data="$(mktemp -d "${TMPDIR:-/tmp}/antigravity-browser-doctor.XXXXXX")"
trap 'rm -rf "$doctor_data"' EXIT
npm run doctor -- --data-dir "$doctor_data"

cat <<'EOF'

Installation complete. Refresh Antigravity's MCP server list, or restart
Antigravity if the new tools do not appear. In a conversation, ask Gemini to
"Use antigravity-browser directly" and describe the browser task.
EOF
