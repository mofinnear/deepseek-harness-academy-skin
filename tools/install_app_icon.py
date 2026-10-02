#!/usr/bin/env python3
"""Replace the DeepSeek Harness app icon in place, then re-sign the bundle.

Why re-signing is unavoidable: `Resources/icon.icns` and `Resources/icon.png`
sit inside the sealed `_CodeSignature/CodeResources` manifest, so any change
invalidates the Developer ID signature. The bundle is then re-signed ad-hoc with
the same entitlements and the hardened runtime, because the original Developer ID
certificate is not available on this machine.

`Resources/app.asar` is NOT touched, so the Electron asar-integrity hashes in
Info.plist stay valid, and no asar re-pack is needed.

Usage:
    python3 tools/install_app_icon.py assets/app-icon.png --dry-run
    python3 tools/install_app_icon.py assets/app-icon.png --apply

Requires the desktop app to be closed and an admin-writable /Applications.
"""
from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
from datetime import datetime
from pathlib import Path

APP = Path("/Applications/DeepSeek Harness.app")
ICNS = APP / "Contents/Resources/icon.icns"
PNG = APP / "Contents/Resources/icon.png"
BACKUP_ROOT = Path(__file__).resolve().parent.parent / "backup"
ICONSET_BUILDER = Path(__file__).resolve().parent / "build_icns.py"
ENTITLEMENTS_TEMPLATE = Path(__file__).resolve().parent.parent / "build/resign-test/ent.plist"


def run(cmd: list[str], check: bool = True) -> subprocess.CompletedProcess:
    print(f"[run] {' '.join(cmd)}")
    proc = subprocess.run(cmd, check=False, text=True, capture_output=True)
    if proc.stdout:
        print(proc.stdout, end="" if proc.stdout.endswith("\n") else "\n")
    if proc.stderr:
        print(proc.stderr, end="" if proc.stderr.endswith("\n") else "\n", file=sys.stderr)
    if check and proc.returncode:
        raise subprocess.CalledProcessError(proc.returncode, cmd, proc.stdout, proc.stderr)
    return proc


def app_running() -> bool:
    proc = subprocess.run(["pgrep", "-f", "DeepSeek Harness.app/Contents"], capture_output=True, text=True)
    return proc.returncode == 0 and bool(proc.stdout.strip())


def make_backup(stamp: str) -> Path:
    target = BACKUP_ROOT / f"app-icon-{stamp}"
    target.mkdir(parents=True, exist_ok=True)
    shutil.copy2(ICNS, target / "icon.icns")
    shutil.copy2(PNG, target / "icon.png")
    if not ENTITLEMENTS_TEMPLATE.is_file():
        raise SystemExit(f"missing valid signing entitlements: {ENTITLEMENTS_TEMPLATE}")
    shutil.copy2(ENTITLEMENTS_TEMPLATE, target / "entitlements.plist")
    run(["plutil", "-lint", str(target / "entitlements.plist")])
    print(f"[backup] originals saved to {target}")
    return target


def build_icns(source: Path, stamp: str) -> Path:
    out = BACKUP_ROOT / f"app-icon-{stamp}" / "new-icon.icns"
    out.parent.mkdir(parents=True, exist_ok=True)
    run([sys.executable, str(ICONSET_BUILDER), str(source), str(out)])
    return out


def resign(entitlements: Path) -> None:
    run(["plutil", "-lint", str(entitlements)])
    run(["codesign", "--force", "--deep", "--sign", "-", "--options", "runtime",
         "--entitlements", str(entitlements), str(APP)])
    run(["codesign", "--verify", "--deep", "--strict", "--verbose=2", str(APP)])


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path, help="square 1024x1024 PNG (higher is downsampled)")
    parser.add_argument("--apply", action="store_true", help="write the changes (default is a dry run)")
    parser.add_argument("--keep-quarantine", action="store_true", help="do not strip com.apple.quarantine after re-signing")
    args = parser.parse_args()

    if not APP.exists():
        raise SystemExit(f"app bundle not found: {APP}")
    if not args.source.exists():
        raise SystemExit(f"source image not found: {args.source}")

    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    print(f"app       {APP}")
    print(f"source    {args.source}")
    print(f"target    {ICNS} + {PNG}")
    if app_running():
        print("\n[!] The desktop app is running. Quit it before applying: replacing sealed")
        print("    resources under a live Electron process corrupts its code cache and the")
        print("    signature check.")

    if not args.apply:
        print("\nDry run. Re-run with --apply once the app is closed.")
        return

    if app_running():
        raise SystemExit("refusing to modify a running app — quit DeepSeek Harness first")

    backup = make_backup(stamp)
    new_icns = build_icns(args.source, stamp)
    shutil.copy2(new_icns, ICNS)
    run(["sips", "-s", "format", "png", "-z", "1024", "1024", str(args.source), "--out", str(PNG)])

    entitlements = backup / "entitlements.plist"
    if not entitlements.exists():
        print("[warn] original entitlements were not captured; signing without them")
        run(["codesign", "--force", "--deep", "--sign", "-", "--options", "runtime", str(APP)])
        run(["codesign", "--verify", "--deep", "--strict", "--verbose=2", str(APP)])
    else:
        resign(entitlements)

    if not args.keep_quarantine:
        run(["xattr", "-dr", "com.apple.quarantine", str(APP)], check=False)

    print("\nDone. Launch the app once; macOS may ask you to confirm the first open of a")
    print("re-signed bundle. Restore the originals with:")
    print(f"  cp {backup}/icon.icns {ICNS}")
    print(f"  cp {backup}/icon.png  {PNG}")
    print("  codesign --force --deep --sign - --options runtime "
          f"--entitlements {entitlements} {APP}")


if __name__ == "__main__":
    main()
