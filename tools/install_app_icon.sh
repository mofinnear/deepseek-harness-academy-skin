#!/usr/bin/env bash
#
# Swap the DeepSeek Harness app icon, re-sign the bundle, and relaunch.
#
# Must run detached from the harness session: replacing sealed resources and
# relaunching the app ends the session that started this script.
#
# Every mutating step has a rollback: the original icon files and entitlements
# are copied to a timestamped backup directory first, and a failed signature
# verification restores them and re-signs before relaunching.
#
# Usage: install_app_icon.sh <app-bundle> <icon-1024.png> [delay-seconds] [log-file]
set -uo pipefail

APP="${1:?usage: install_app_icon.sh <app-bundle> <icon-1024.png> [delay] [log]}"
ICON_SRC="${2:?missing icon png}"
DELAY="${3:-8}"
LOG="${4:-/tmp/dsh-icon-swap.log}"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="/tmp/dsh-icon-backup-$STAMP"
ICNS="$APP/Contents/Resources/icon.icns"
PNG="$APP/Contents/Resources/icon.png"
MAIN_BIN="$APP/Contents/MacOS/DeepSeek Harness"
TOOLS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

exec >"$LOG" 2>&1

log() { echo "[$(date +%H:%M:%S)] $*"; }
die() { log "FATAL: $*"; exit 1; }

log "app=$APP"
log "icon=$ICON_SRC"
log "backup=$BACKUP"
log "waiting ${DELAY}s so the caller can finish its reply"
sleep "$DELAY"

[ -d "$APP" ] || die "app bundle not found"
[ -f "$ICON_SRC" ] || die "icon source not found"

# --------------------------------------------------- wait for the app to stop
#
# The harness deliberately does NOT kill the app itself: the app hosts the
# session that would be running this script, so terminating it takes the script
# down mid-swap and leaves the bundle half-modified. It also cannot signal the
# app reliably from inside the sandbox. So the operator quits the app, and this
# only watches for that to happen.
#
# Liveness is detected by the app's own process count, excluding this script and
# anything else whose command line merely mentions the bundle path (that mistake
# made an earlier version wait forever for an app that had already quit).
APP_BIN="$APP/Contents/MacOS/DeepSeek Harness"
# Liveness check without `ps`: the sandbox denies `ps -o comm=` for arbitrary
# pids, which silently made an earlier version treat a running app as stopped.
# `pgrep -f` over the main binary path is enough, and the harness session’s own
# process tree never carries that exact suffix.
app_running() {
  # Primary: is the main executable currently held open by any process? That is
  # independent of the process name, of argument formatting, and of whether the
  # web surface happens to be up.
  lsof -nP "$APP_BIN" 2>/dev/null | grep -q . && return 0
  # Secondary: the harness web surface, which only exists while the app runs.
  lsof -nP -iTCP:19387 -sTCP:LISTEN >/dev/null 2>&1 && return 0
  # Tertiary: exact-path match, for an app whose web surface is disabled.
  pgrep -f "$APP_BIN\$" >/dev/null 2>&1 && return 0
  return 1
}

DEADLINE="${DSH_QUIT_WAIT:-180}"
log "waiting up to ${DEADLINE}s for you to quit DeepSeek Harness"
WAITED=0
while [ "$WAITED" -lt "$DEADLINE" ]; do
  if ! app_running; then
    log "app is stopped"
    break
  fi
  sleep 1
  WAITED=$((WAITED + 1))
  if [ $((WAITED % 15)) -eq 0 ]; then
    log "still running (${WAITED}s) — quit DeepSeek Harness to continue"
  fi
done
if app_running; then
  log "app never quit within ${DEADLINE}s; leaving the bundle untouched"
  exit 2
fi

# ------------------------------------------------------------------- back up
mkdir -p "$BACKUP"
cp -p "$ICNS" "$BACKUP/icon.icns" || die "cannot back up icon.icns"
cp -p "$PNG" "$BACKUP/icon.png" || die "cannot back up icon.png"
codesign -d --entitlements :- "$APP" >"$BACKUP/entitlements.plist" 2>/dev/null
[ -s "$BACKUP/entitlements.plist" ] || die "cannot capture original entitlements"
log "backed up originals to $BACKUP"

# --------------------------------------------------------------- swap + sign
python3 "$TOOLS_DIR/build_icns.py" "$ICON_SRC" "$BACKUP/new.icns" || die "icns build failed"
cp "$BACKUP/new.icns" "$ICNS" || die "cannot write icon.icns"
sips -s format png -z 1024 1024 "$ICON_SRC" --out "$PNG" >/dev/null || die "cannot write icon.png"
log "icon files replaced"

# Finder detritus (FinderInfo / resource forks) makes codesign refuse to sign.
xattr -cr "$APP" 2>/dev/null || true
# Drop the download quarantine so the re-signed bundle opens without a prompt.
xattr -dr com.apple.quarantine "$APP" 2>/dev/null || true

# No --deep: the nested helpers and frameworks already carry valid signatures,
# and re-signing them with an ad-hoc identity only adds risk.
codesign --force --sign - --options runtime --entitlements "$BACKUP/entitlements.plist" "$APP" \
  || die "codesign failed"

if codesign --verify --strict "$APP" 2>/dev/null; then
  log "signature verified"
  ENT_COUNT="$(codesign -d --entitlements - "$APP" 2>/dev/null | grep -c 'com.apple.security' || true)"
  log "entitlements preserved: $ENT_COUNT"
else
  log "signature verification FAILED — rolling back to the original icon"
  cp -p "$BACKUP/icon.icns" "$ICNS"
  cp -p "$BACKUP/icon.png" "$PNG"
  codesign --force --sign - --options runtime --entitlements "$BACKUP/entitlements.plist" "$APP" \
    || log "rollback re-sign also failed; restore manually from $BACKUP"
  if codesign --verify --strict "$APP" 2>/dev/null; then
    log "rollback verified — original icon restored"
  else
    log "rollback could NOT be verified; restore manually with:"
    log "  cp '$BACKUP/icon.icns' '$ICNS'"
    log "  cp '$BACKUP/icon.png' '$PNG'"
    log "  codesign --force --sign - --options runtime --entitlements '$BACKUP/entitlements.plist' '$APP'"
  fi
fi

# ------------------------------------------------------------------ relaunch
log "relaunching"
open -a "$APP" >/dev/null 2>&1 || open "$APP" >/dev/null 2>&1 || log "relaunch command failed; open the app manually"

for _ in $(seq 1 30); do
  sleep 1
  if pgrep -f "$APP/Contents/MacOS/DeepSeek Harness$" >/dev/null 2>&1; then
    log "app is running again"
    log "done"
    exit 0
  fi
done

log "app did not come back within 30s — open it manually"
log "rollback: cp '$BACKUP/icon.icns' '$ICNS' && cp '$BACKUP/icon.png' '$PNG' && codesign --force --sign - --options runtime --entitlements '$BACKUP/entitlements.plist' '$APP'"
exit 1
