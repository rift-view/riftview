#!/usr/bin/env bash
# check-lockfile-author.sh — Is this commit author email a known dependency-bot?
#
# Usage: scripts/check-lockfile-author.sh <email>
#   exit 0  →  bot (lockfile change allowed)
#   exit 1  →  human or unrecognised (lockfile change should be blocked)
#
# Supported bot email formats (GitHub noreply convention):
#   29139614+renovate[bot]@users.noreply.github.com
#   renovate[bot]@users.noreply.github.com
#   49699333+dependabot[bot]@users.noreply.github.com
#   dependabot[bot]@users.noreply.github.com
#   41898282+github-actions[bot]@users.noreply.github.com
#   github-actions[bot]@users.noreply.github.com
#
# Pattern: optional numeric-id prefix, then a known bot name in [bot]@users.noreply.github.com.
# The numeric prefix is GitHub's internal user ID; it may change if GitHub re-provisions
# the bot app, so the regex treats it as optional.
set -euo pipefail

if [ $# -lt 1 ] || [ -z "$1" ]; then
  echo "Usage: $0 <email>" >&2
  exit 1
fi

EMAIL="$1"

if echo "$EMAIL" | grep -qE '^([0-9]+\+)?(renovate|dependabot|github-actions)\[bot\]@users\.noreply\.github\.com$'; then
  exit 0
fi

exit 1
