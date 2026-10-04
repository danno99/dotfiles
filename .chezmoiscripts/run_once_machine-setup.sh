#!/bin/bash
# One-time machine setup (independent of the package manifest).
# chezmoi-native "run once" semantics: recorded by content hash in chezmoi's
# persistent state — no marker files. Edits to this script re-trigger it.
# Requires: fish (user shell, installed with the OS — not part of packages.yaml)
set -euo pipefail

command -v fish >/dev/null || { echo "fish not found — install it first" >&2; exit 1; }

echo "  -> Configuring fish shell (one-time)..."
fish -c "fish_config prompt choose default && funcsave fish_prompt"
fish -c "set -Ux EDITOR nvim"
fish -c "set -Ux SUDO_EDITOR nvim"
fish -c "alias --save vi='nvim'"
fish -c "alias --save vim='nvim'"
