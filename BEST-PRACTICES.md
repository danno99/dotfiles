# Best Practices Reference (one-time research)

> **Purpose:** This file is the cached result of web research (2026-10-04) per the
> instruction in `AGENTS.md`: *aggressively search the internet for best practices,
> and create a one-time file instead of processing everything all the time.*
> **Read this before re-researching.** Re-run web searches only if this file is
> older than ~6 months or a specific claim is in doubt.

## 1. Chezmoi mechanics (verified against official docs)

### 1.1 `include` path resolution — IMPORTANT
- `{{ include "..." }}` resolves **relative paths against the source directory**
  (`~/.local/share/chezmoi`), *not* the script's own directory.
  - ✅ Correct (as in the current script): `{{ include ".chezmoidata/packages.yaml" | sha256sum }}`
  - ❌ Wrong (older draft in AGENT.md history): `include "../.chezmoidata/packages.yaml"` —
    this would escape the source directory and fail.
- Source: https://chezmoi.io/reference/templates/functions/include/
- `includeTemplate` first searches `.chezmoitemplates/`, then the source dir —
  useful for shared partials: https://chezmoi.io/reference/templates/functions/includeTemplate/

### 1.2 Script lifecycle semantics
- `run_*.sh` — runs **every** `chezmoi apply`.
- `run_onchange_*.sh` — runs only when the **post-template** content's SHA256
  changed since last run. This is exactly how the `packages.yaml` hash trick works:
  the hash is a comment inside the template, so changing the YAML changes the
  rendered script and triggers a re-run. Officially documented pattern:
  https://www.chezmoi.io/user-guide/use-scripts-to-perform-actions/ ("Run a script
  when the contents of another file changes").
- `run_once_*.sh` — runs once per unique content version.
- Hash state is stored in chezmoi's persistent state (entryState bucket):
  https://www.chezmoi.io/developer-guide/architecture/
- Guidance from the maintainer: prefer `run_onchange_` unless you have a good
  reason otherwise: https://github.com/twpayne/chezmoi/discussions/4208
- `chezmoi status` marks scripts that will run with `R`; can be excluded via
  `status.exclude: ["scripts"]` in config.

### 1.3 Structured data
- `.chezmoidata/` files are exposed as template data (`.packages` for
  `packages.yaml`) — the current manifest layout is idiomatic.
- Use `{{ .chezmoi.sourceDir }}`, `{{ .chezmoi.homeDir }}`, `{{ .chezmoi.destDir }}`
  for absolute paths when needed (https://chezmoi.io/reference/templates/variables/).

### 1.4 Shared helper code
- Put reusable shell logic in `.chezmoitemplates/` and pull it in with
  `includeTemplate`, or reference `$(chezmoi source-path)` from plain scripts:
  https://github.com/twpayne/chezmoi/discussions/3764, /3506

## 2. CachyOS / Arch / AUR provisioning

### 2.1 AUR helpers — UPDATED 2026-10-04 (verified, not hearsay)
- 🔴 **paru is NO LONGER in the official Arch repos.** Official package search
  returns 0 results for `paru`; it is AUR-only (v2.1.0-2 on aur.archlinux.org).
  `sudo pacman -S paru` fails on a vanilla system.
- ✅ **BUT paru (and yay) are pre-built in Chaotic-AUR** (verified against the
  read-only mirror `github.com/chaotic-aur/packages`, 2534 packages). So once
  the chaotic-aur repo is enabled, `pacman -S paru` works again — **no
  bootstrap chicken-and-egg, no shelly needed**.
- **Verdict: keep paru, skip shelly.** Shelly is CachyOS's GUI-first tool
  (fine for interactive use); for scripted provisioning paru's CLI is the right
  fit. With Chaotic-AUR the helper is only needed for the few packages chaotic
  doesn't pre-compile (currently just `z13ctl-bin`).
- AUR membership of current manifest (checked 2026-10-04 in the chaotic mirror):
  - `visual-studio-code-bin` → in Chaotic-AUR → precompiled (now under `pacman:`)
  - `ryzen_smu-dkms-git` → in Chaotic-AUR → precompiled (now under `pacman:`)
  - `z13ctl-bin` → NOT in Chaotic-AUR → AUR build via paru (under `aur:`)

### 2.2 Chaotic-AUR setup (official flow, implemented in the run script)
Official docs (https://aur.chaotic.cx/docs) flow:
1. `pacman-key --recv-key 3056513887B78AEB --keyserver keyserver.ubuntu.com`
   (keyserver flaky for some — fallback: key file at
   `https://raw.githubusercontent.com/chaotic-aur/chaotic-aur.github.io/master/chaotic.gpg`)
2. `pacman-key --lsign-key 3056513887B78AEB`
3. `pacman -U` their `chaotic-keyring` + `chaotic-mirrorlist` packages from
   `https://cdn-mirror.chaotic.cx/chaotic-aur/`
4. Append to `/etc/pacman.conf` (end of file → lowest priority, official repos win):
   ```
   [chaotic-aur]
   Include = /etc/pacman.d/chaotic-mirrorlist
   ```
   ⚠️ **This append is required — `chaotic-mirrorlist` does NOT do it.**
   Verified 2026-10-04 against the PKGBUILD (pkgbuild-chaotic-mirrorlist):
   the package has **no install hook**; `package()` only ships
   `/etc/pacman.d/chaotic-mirrorlist`. It never touches `/etc/pacman.conf`.
   So the script's `tee -a` is the sole registration, and a duplicate
   `[chaotic-aur]` block can only come from an out-of-band edit (manual
   stanza, third-party installer, or an older pre-guard script run).
5. Full DB refresh (`pacman -Sy` / `-Syyu`).

### 2.3 pacman flags used in the script — UPDATED 2026-10-04 (back to full `-Syu`)

- `sudo pacman -Syu --needed --noconfirm <pkgs>` — **full sync+upgrade** of
  the entire pacman system (official + Chaotic-AUR) plus install of any listed
  package that is missing. Rationale for `-Syu` (not `-Sy`): a
  DB-refresh-and-only-some-packages install leaves a **partial-upgrade** state
  that can break software (mixed versions built against different libs); a
  full `-Syu` keeps everything at one consistent state.
- **`--needed` is required** on the explicit package list: without it,
  already-installed packages get **reinstalled** (`warning: X is up to date
  -- reinstalling`) — wasted downloads and, for AUR, needless source rebuilds.
- `paru -Syu --needed --noconfirm <aur-only pkgs>` — full AUR+official upgrade
  + install missing AUR packages; `--needed` avoids rebuilding unchanged AUR
  packages.
- ⚠️ **Tradeoff:** this now runs a **full system upgrade, unattended
  (`--noconfirm`), on every manifest change** — heavier and auto-accepts every
  upgrade hook. Accepted deliberately to guarantee consistency. To review
  upgrades, run `chezmoi apply` when you can watch it, or pre-run `pacman -Syu`
  / `paru -Syu` manually.
- AUR packages are only rebuilt/updated by the helper: `paru -Syu`, not pacman:
  https://wiki.archlinux.org/title/AUR_helper
- AUR security: vet PKGBUILDs (source URLs, functions); AUR helpers are
  unsupported by Arch upstream — know the manual process to troubleshoot:
  https://wiki.archlinux.org/title/AUR_helper,
  https://wiki.cachyos.org/cachyos_basic/faq/ (Security & Best Practices)

### 2.4 Idempotency patterns (what the script already does right)
- Guard every mutation with a state check (`grep -qxF`, `test -d`,
  `systemctl is-enabled/--quiet`, `lsattr` for btrfs `+C` NOCOW on libvirt
  images). Keep this style for any new step.
- Check state via **machine-parseable** queries, not by grepping human-readable
  output — and **verify the query against real output on the target system
  before trusting it** (three consecutive wrong virsh assumptions were caught
  this way: §2.5, last row). Libvirt network state on this machine:
  the stable column layout of plain `virsh net-list`
  (`Name State Autostart Persistent`) — awk `$2` = active/inactive, `$3` =
  autostart yes/no. Do NOT rely on:
  - `net-list --state` — this virsh rejects it (*"command 'net-list' doesn't
    support option --state"*); with stderr suppressed the output is always
    empty and the check always fails;
  - `net-dumpxml <net>` markers — the network XML carries **no** `<active/>`
    or `<autostart/>` elements (verified: an *active* network's XML contains
    neither; autostart lives in the libvirt state dir, not the XML);
  - `net-info | grep "Active:\s+yes"` — brittle human-readable parse.
  Each of these missed an active network at least once, so `net-start` hit
  "already active" and aborted under `set -e`. Belt-and-braces: after a
  failed `net-start`, re-query the state before failing (see §2.5, last row).
- `set -euo pipefail` — keep.
- NOCOW (`chattr +C`) on `/var/lib/libvirt/images` is the standard btrfs fix for
  libvirt image CoW overhead — keep.

### 2.5 Weak spots found in the original script (ALL FIXED 2026-10-04)

Design note (v2): the first fix used hand-rolled marker files in
`~/.local/state/chezmoi/` — replaced by the idiomatic alternatives: `run_once_`
scripts (chezmoi records content-hash state itself) and direct checks of the
system state a step depends on. Marker files only make sense when a step has
no inspectable system state AND cannot run as `run_once` (dependency ordering).
| Issue | Fix applied |
|---|---|
| `z13ctl apply ... --brightness low` reset backlight on *every* manifest change | State-check on the real persistent artifact (`/etc/modules-load.d/ryzen_smu.conf`); one-shot `z13ctl` settings run only in the first-setup branch (v2, 2026-10-04 — no state file) |
| `fish_config prompt choose default` overwrote user customizations | Moved to `.chezmoiscripts/run_once_machine-setup.sh` — chezmoi-native `run_once` semantics, no state file (v2, 2026-10-04) |
| `nmcli device modify "wlan0"` hardcoded interface | `nmcli -t -f DEVICE device wifi \| head -n1` lookup + no-device fallback |
| `curl \| bash` for EasyEffects presets (supply-chain) | Vendored pinned copy in `.chezmoitemplates/easyeffects-install.sh`; run via `{{ .chezmoi.sourceDir }}` |
| `sudo pacman -Syu` full upgrade on every run | → `pacman -Sy` install-only, **reverted 2026-10-04 back to full `pacman -Syu` / `paru -Syu`** — partial installs (`-Sy`) risk breaking software (see §2.3) |
| `gsettings` would abort the script (`set -e`) on non-GNOME systems | `command -v gsettings` guard |
| AUR packages always built from source | Auto-split: `pacman -Si` check → chaotic-aur (pacman) vs AUR (paru) |
| (latent) `pacman -S paru` broken since paru left official repos | paru now resolves via Chaotic-AUR (verified present there) |
| 2nd miss of an active libvirt default net: `net-list --state running` pre-check could never see the running network — virsh on this machine rejects `--state` ("command 'net-list' doesn't support option --state"), error hidden by `2>/dev/null`, so the check always failed and `net-start` → "network is already active", aborting under `set -e`. **The v3 "fix" (grep `net-dumpxml` for `<active/>`) was itself wrong** — verified by direct test: an active network's XML contains no `<active/>` (and no `<autostart/>`; autostart is stored in the libvirt state dir) (v4) | State comes from the stable `virsh net-list` columns (verified on the real machine: `default active yes yes`): awk `$2`=State, `$3`=Autostart. A failed `net-start` re-queries the same columns and only fails loudly if the network is still not active — never a spurious abort |

## 3. AGENTS.md conventions (for the Pi agent itself)

- `AGENTS.md` is the de-facto cross-tool standard (works with 20+ agents). It
  complements `README.md`: exact commands, patterns, do's/don'ts, test strategy.
- **Keep it short and scannable** — agents truncate long context files.
- Include: repo map, exact commands, conventions, explicit "do not" list.
- **Pi-specific:** Pi discovers `AGENTS.override.md`, `AGENTS.md`/`AGENTS.MD`,
  `CLAUDE.md`/`CLAUDE.MD` from the agent dir, the working directory, and parents.
  A file named `AGENT.md` (no S) is **not** auto-discovered by Pi.
  (Verified in pi-coding-agent docs: configuration.md, cli.md)
- Cache expensive research in a separate file (this file) and reference it from
  `AGENTS.md` — cheaper to maintain than re-searching every session.

## 4. Action checklist for this repo

1. ✅ Rename `AGENT.md` → `AGENTS.md` (done — required for Pi auto-discovery).
2. ✅ Create this one-time research file.
3. ✅ **Back to full `-Syu` (2026-10-04):** `pacman -Syu` / `paru -Syu` on each run to avoid partial-upgrade breakage (was briefly `-Sy` install-only — reverted).
4. ✅ Chaotic-AUR enabled automatically by the run script (official flow, §2.2).
5. ✅ Applied all §2.5 fixes (guards, vendored EasyEffects, Wi-Fi lookup, AUR split).
6. ✅ Paru vs shelly: **keep paru** (pre-built in Chaotic-AUR), shelly not needed.

## Sources
- https://chezmoi.io/reference/templates/functions/include/
- https://chezmoi.io/reference/templates/functions/includeTemplate/
- https://www.chezmoi.io/user-guide/use-scripts-to-perform-actions/
- https://www.chezmoi.io/developer-guide/architecture/
- https://github.com/twpayne/chezmoi/discussions/4208
- https://github.com/twpayne/chezmoi/discussions/3764
- https://github.com/twpayne/chezmoi/discussions/3506
- https://github.com/chaotic-aur (org; key setup), https://github.com/chaotic-aur/packages (read-only mirror, 2534 pkgs — used to verify AUR membership)
- https://github.com/chaotic-aur/chaotic-aur.github.io/blob/master/chaotic.gpg (key fallback)
- https://gist.github.com/PapiKekDev/090a2cdf2232103d3f14cbf48e3f63cd (official setup commands)
- https://aur.archlinux.org/packages/paru (paru now AUR-only), https://archlinux.org/packages/ (0 official hits for paru, 2026-10-04)
- https://raw.githubusercontent.com/JackHack96/EasyEffects-Presets/master/install.sh (vendored into .chezmoitemplates/)
- https://chezmoi.io/reference/templates/variables/
- https://wiki.archlinux.org/title/AUR_helper
- https://wiki.archlinux.org/title/Pacman/Tips_and_tricks
- https://wiki.cachyos.org/cachyos_basic/faq/
- https://wiki.cachyos.org/configuration/post_install_setup/
- https://aur.chaotic.cx/
- https://discuss.cachyos.org/t/which-aur-helper-to-use-on-cachyos/35736
- AGENTS.md guides: betterclaw.io/blog/agents-md-best-practices, builder.io/blog/agents-md, gist.github.com/0xfauzi/7c8f65572930a21efa62623557d83f6e
- Pi docs (local): `<pi install>/docs/configuration.md`, `cli.md`, `security.md`
