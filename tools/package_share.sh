#!/bin/bash
# 制作给别人的分享包（两个 zip）：
#   星海书院皮肤-v<版本>.zip       安装包：已构建的插件 + 一键安装/卸载脚本 + 使用说明 + 预览图
#   星海书院皮肤-v<版本>-源码.zip  源码：当前 git 提交（git archive，不含 backup/、构建产物和缓存）
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
mkdir -p "$PKG/插件/dsh-logo"
cp brand-override/package.json brand-override/index.js "$PKG/插件/dsh-logo/"
cp -R brand-override/dist "$PKG/插件/dsh-logo/"
cp share/使用说明.md share/安装.command share/卸载.command "$PKG/"
chmod +x "$PKG/安装.command" "$PKG/卸载.command"
if [ -n "$PREVIEW" ]; then
  mkdir -p "$PKG/预览"
  find "$PREVIEW" -maxdepth 1 -type f ! -name '.*' -exec cp {} "$PKG/预览/" \;
  chmod 644 "$PKG/预览/"*   # 外置盘（exFAT）上拷来的文件权限是 rwx------
fi
rm -f "$OUT/$NAME.zip" "$OUT/$NAME-源码.zip"
(cd "$STAGE" && zip -qrX "$OUT/$NAME.zip" "$NAME" -x '*.DS_Store')
git archive --format=zip --prefix="$NAME-源码/" -o "$OUT/$NAME-源码.zip" HEAD
rm -rf "$STAGE"
ls -l "$OUT/$NAME.zip" "$OUT/$NAME-源码.zip"
