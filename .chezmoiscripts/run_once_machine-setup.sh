#!/bin/bash
# One-time machine setup (independent of the package manifest).
# chezmoi-native "run once" semantics: recorded by content hash in chezmoi's
# persistent state — no marker files. Edits to this script re-trigger it.
set -euo pipefail

echo "  -> Setting default shell to bash (one-time)..."
chsh -s /usr/bin/bash
