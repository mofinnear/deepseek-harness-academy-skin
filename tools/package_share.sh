#!/bin/bash
# 制作给别人的分享包（两个 zip）：
#   星海书院皮肤-v<版本>.zip       安装包：已构建的插件 + 一键安装/卸载脚本 + 使用说明 + 预览图
#   星海书院皮肤-v<版本>-源码.zip  源码：当前 git 提交（git archive，不含 backup/、构建产物和缓存）
#   星海书院皮肤-v<版本>-代码审查.zip  只有代码和审查说明（docs/代码审查说明.md），给 AI 审查用
# 用法：tools/package_share.sh <输出目录> [预览图目录]
#   预览图目录里的文件原样放进安装包的「预览/」（截图要先把会话标题、账号头像和昵称遮掉）。
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${1:?用法：tools/package_share.sh <输出目录> [预览图目录]}"
PREVIEW="${2:-}"
cd "$ROOT"
VER="$(node -p "require('./brand-override/package.json').version")"
NAME="星海书院皮肤-v${VER}"

[ -z "$(git status --porcelain -- brand-override share tools logo.config.json assets)" ] \
  || { echo "有未提交的改动，先提交再打包（源码包取的是 git 提交）"; exit 1; }

node tools/build.mjs >/dev/null
node tools/verify.mjs | tail -1
node tools/verify.mjs >/dev/null   # 有失败项时退出码非 0，set -e 会停下

mkdir -p "$OUT"
STAGE="$(mktemp -d)"
PKG="$STAGE/$NAME"
mkdir -p "$PKG/plugin/dsh-logo"
cp brand-override/package.json brand-override/index.js "$PKG/plugin/dsh-logo/"
cp -R brand-override/dist "$PKG/plugin/dsh-logo/"
cp share/使用说明.md share/安装.command share/卸载.command share/安装-Windows.bat share/卸载-Windows.bat "$PKG/"
cp -R share/windows "$PKG/"
cp LICENSE "$PKG/LICENSE.txt"   # .txt：Windows 上双击就能用记事本打开
chmod +x "$PKG/安装.command" "$PKG/卸载.command"
if [ -n "$PREVIEW" ]; then
  mkdir -p "$PKG/preview"
  find "$PREVIEW" -maxdepth 1 -type f ! -name '.*' -exec cp {} "$PKG/preview/" \;
  chmod 644 "$PKG/preview/"*   # 外置盘（exFAT）上拷来的文件权限是 rwx------
fi
chmod -R go+rX "$PKG"   # 源文件有的是 rw-------
rm -f "$OUT/$NAME.zip" "$OUT/$NAME-源码.zip" "$OUT/$NAME-代码审查.zip"
# 用 Python 的 zipfile 打包：中文文件名会带上 UTF-8 标记（zip 命令不带，Windows 解压会乱码），并保留可执行权限
python3 - "$STAGE" "$NAME" "$OUT/$NAME.zip" <<'PY'
import os, sys, zipfile
stage, name, out = sys.argv[1:]
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
    for root, dirs, files in os.walk(os.path.join(stage, name)):
        dirs.sort()
        for d in dirs:
            z.write(os.path.join(root, d), os.path.relpath(os.path.join(root, d), stage) + '/')
        for f in sorted(files):
            if f == '.DS_Store':
                continue
            path = os.path.join(root, f)
            z.write(path, os.path.relpath(path, stage))
PY
git archive --format=zip --prefix="$NAME-源码/" -o "$OUT/$NAME-源码.zip" HEAD
# 代码审查包：只有代码和说明（不含图片、不含构建产物），给 DeepSeek / GPT 等审查用；审查要求见 docs/代码审查说明.md
git archive --format=zip --prefix="$NAME-代码审查/" -o "$OUT/$NAME-代码审查.zip" HEAD -- \
  docs/代码审查说明.md README.md LICENSE docs/交接说明.md logo.config.json \
  brand-override/client.js brand-override/index.js brand-override/package.json brand-override/cordis.patch.yml \
  brand-override/skin.css brand-override/skin-art.css share \
  tools/install.mjs tools/build.mjs tools/verify.mjs tools/backup.mjs tools/devtools.mjs tools/package_share.sh \
  tools/char_layers.py tools/expressions.py tools/sidebar_starmap.py
rm -rf "$STAGE"
ls -l "$OUT/$NAME.zip" "$OUT/$NAME-源码.zip" "$OUT/$NAME-代码审查.zip"
