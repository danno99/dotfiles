# Pi Agent & CachyOS Provisioner (Managed by chezmoi)

Extensible, local Pi agent configuration for this dotfiles repo: a declarative
package manifest provisioned on CachyOS (Arch) via chezmoi.

## ⚡ First rule
**Read `BEST-PRACTICES.md` before researching anything.** It is a cached,
source-cited reference (chezmoi mechanics, CachyOS/Arch/AUR practices, AGENTS.md
conventions). Only re-run web searches if it is stale (~6+ months) or a specific
claim is in doubt — then update the file afterward.

## Repository layout
- `BEST-PRACTICES.md` — cached web research + action checklist (read first)
- `.chezmoidata/packages.yaml` — declarative package manifest (pacman + AUR)
- `.chezmoiscripts/run_onchange_install-packages.sh.tmpl` — idempotent install
  engine; re-runs only when the manifest's SHA256 changes
- `.chezmoiscripts/run_once_machine-setup.sh` — one-time machine setup
  (chezmoi-tracked, no state files)
- `AGENTS.md` — this file; project instructions auto-loaded by Pi

## Conventions (do)
- Add/remove packages by editing `.chezmoidata/packages.yaml` only.
- Keep every system mutation **guarded** (state check before mutation) so the
  script stays idempotent. `set -euo pipefail` stays.
- Trigger apply: `chezmoi diff` (preview) → `chezmoi apply` (provision).

## Pitfalls (don't)
- ❌ Ad-hoc marker/state files (e.g. `touch ~/.local/state/.../done`) for
  one-time setup — use `run_once_` scripts (chezmoi tracks content hashes
  itself) or check the real system state the step depends on.
- ❌ `include "../.chezmoidata/..."` — `include` paths are **relative to the
  source directory**, so use `include ".chezmoidata/packages.yaml"` (no `..`).
- ❌ Re-searching the web for already-documented practices — use
  `BEST-PRACTICES.md`.
- ❌ Unguarded, user-visible side effects on every run (brightness resets,
  prompt resets) — see the §2.4 table in `BEST-PRACTICES.md`.
- ❌ Renaming this file to `AGENT.md` — Pi only auto-discovers `AGENTS.md` /
  `AGENTS.override.md` / `CLAUDE.md`.
