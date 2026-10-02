#!/usr/bin/env bash
#
# One-shot wrapper: swap the app icon, re-sign, relaunch, then verify.
#
# Run this yourself, after quitting DeepSeek Harness (Cmd+Q or the Dock menu).
# It must not be driven from inside a harness session: the app hosts that
# session, so quitting it would kill whatever is coordinating the swap.
#
# Usage: ./swap-app-icon.command
set -uo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP="/Applications/DeepSeek Harness.app"
ICON="$DIR/../assets/app-icon.png"
LOG="/tmp/dsh-icon-swap.log"

if [ ! -f "$ICON" ]; then
  echo "icon source missing: $ICON"
  echo "run: python3 '$DIR/compose_artwork.py'"
  exit 1
fi

APP_BIN="/Applications/DeepSeek Harness.app/Contents/MacOS/DeepSeek Harness"
if lsof -nP "$APP_BIN" 2>/dev/null | grep -q . \
   || lsof -nP -iTCP:19387 -sTCP:LISTEN >/dev/null 2>&1; then
  echo "DeepSeek Harness is still running."
  echo "Quit it first (Cmd+Q in the app), then run this again."
  exit 1
fi

echo "swapping the app icon — progress in $LOG"
DSH_QUIT_WAIT=10 bash "$DIR/install_app_icon.sh" "$APP" "$ICON" 0 "$LOG"
STATUS=$?

echo
echo "================ result ================"
echo "script exit: $STATUS"
echo
echo "--- icon digest (was 395a1f429a44d372 = original whale) ---"
shasum -a 256 "$APP/Contents/Resources/icon.icns" | cut -c1-16
echo
echo "--- signature ---"
codesign -dv "$APP" 2>&1 | grep -E "flags|Signature size" || true
codesign --verify --strict "$APP" 2>&1 && echo "codesign --verify: OK" || echo "codesign --verify: FAILED"
echo
echo "--- swap log tail ---"
tail -12 "$LOG" 2>/dev/null
echo
echo "If the Dock still shows the old icon, refresh the icon cache with:"
echo "  touch '$APP' && killall Dock"
exit "$STATUS"
