#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PKG_JSON="$REPO_ROOT/package.json"

expected=$(node -e "
  const pkg = require('$PKG_JSON');
  const pm = pkg.packageManager || '';
  const m = pm.match(/^pnpm@([^+]+)/);
  if (!m) { console.error('No packageManager field found'); process.exit(1); }
  console.log(m[1]);
")

actual=$(pnpm --version 2>/dev/null || echo "not-found")

if [[ "$actual" == "not-found" ]]; then
  echo ""
  echo "ERROR: pnpm is not installed."
  echo "  This repo requires pnpm $expected."
  echo "  Install it: corepack enable && corepack use pnpm@$expected"
  echo ""
  exit 1
fi

if [[ "$actual" != "$expected" ]]; then
  echo ""
  echo "ERROR: pnpm version mismatch."
  echo "  Expected: $expected (from packageManager field)"
  echo "  Detected: $actual"
  echo ""
  echo "  Fix: corepack use pnpm@$expected"
  echo ""
  exit 1
fi
