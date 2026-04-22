#!/usr/bin/env python3
"""
Fail if package-lock.json declares optionalDependencies whose resolved
entries are missing from the lockfile.

Background: npm/cli#4828 — when `npm install` runs on a single platform,
npm can silently strip platform-specific native-addon child entries
(lightningcss-*, esbuild-*, @swc/*-*, ...) from the lockfile while
leaving the parent's `optionalDependencies` manifest intact. `npm ci`
on other platforms then skips the addon because no URL+integrity is
pinned, and the native dep fails to load at runtime.

A clean lockfile has a resolved `node_modules/<dep>` (or nested equiv)
entry for every name declared in any package's `optionalDependencies`.

Exits 1 on drift, printing each (parent, missing) pair.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LOCKFILE = ROOT / "package-lock.json"


def main() -> int:
    data = json.loads(LOCKFILE.read_text())
    packages = data.get("packages", {})

    missing: list[tuple[str, str]] = []
    for pkg_path, pkg in packages.items():
        for opt_name in pkg.get("optionalDependencies", {}):
            top_level = f"node_modules/{opt_name}"
            if top_level in packages:
                continue
            nested = f"{pkg_path}/node_modules/{opt_name}" if pkg_path else ""
            if nested and nested in packages:
                continue
            missing.append((pkg_path or "<root>", opt_name))

    if missing:
        print("::error::package-lock.json drift — optionalDependencies without resolved entries")
        print(
            "Likely cause: `npm install` ran on a single platform and stripped "
            "foreign native-addon binaries (npm/cli#4828)."
        )
        print(
            "Fix: regenerate the lockfile in a way that preserves cross-platform "
            "optional deps, or restore the stripped entries from a known-good commit."
        )
        print()
        for parent, dep in missing:
            print(f"  parent={parent}  missing={dep}")
        return 1

    print(f"OK: all optionalDependencies resolved ({len(packages)} packages checked)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
