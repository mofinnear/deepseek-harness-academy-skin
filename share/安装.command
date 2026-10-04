#!/bin/bash
# 「星海书院」皮肤一键安装（DeepSeek Harness 桌面版，macOS）。
# 只写用户目录里的两处，不修改应用本体和签名：
#   ~/.dsh/profiles/desktop/node_modules/@local/dsh-logo/   插件文件
#   ~/.dsh/profiles/desktop/cordis.patch.yml                追加一条插件加载项
# 改动前会把这两处原来的内容备份到 ~/.dsh/academy-skin-backup/<时间>/。

cd "$(dirname "$0")" || exit 1
SRC="$PWD/plugin/dsh-logo"
DSH_HOME_DIR="${DSH_HOME:-$HOME/.dsh}"   # 和应用本身一样：设了 DSH_HOME 就用它
PROFILE="${DSH_PROFILE_DIR:-$DSH_HOME_DIR/profiles/desktop}"
PATCH="$PROFILE/cordis.patch.yml"
TARGET="$PROFILE/node_modules/@local/dsh-logo"
BACKUP="${DSH_SKIN_BACKUP_DIR:-$DSH_HOME_DIR/academy-skin-backup}/$(date +%Y%m%d-%H%M%S)-安装前"

fail() { echo; echo "❌ $1"; echo; read -r -p "按回车键关闭窗口…" _; exit 1; }

echo "== 星海书院皮肤 · 安装 =="
[ -f "$SRC/dist/client.js" ] && [ -f "$SRC/index.js" ] && [ -f "$SRC/package.json" ] \
  || fail "找不到插件文件（$SRC）。请先把压缩包完整解压，再在解压出的文件夹里运行。"
[ -d "$PROFILE" ] \
  || fail "没有找到 DeepSeek Harness 的配置目录（$PROFILE）。请先安装并打开一次 DeepSeek Harness 桌面版。"

mkdir -p "$BACKUP" || fail "无法创建备份目录 $BACKUP"
[ -f "$PATCH" ] && cp "$PATCH" "$BACKUP/cordis.patch.yml"
[ -d "$TARGET" ] && cp -R "$TARGET" "$BACKUP/dsh-logo"
echo "已备份原来的设置到：$BACKUP"

rm -rf "$TARGET" && mkdir -p "$TARGET" \
  && cp "$SRC/package.json" "$SRC/index.js" "$TARGET/" \
  && cp -R "$SRC/dist" "$TARGET/" \
  || fail "复制插件文件失败。"

if [ -f "$PATCH" ] && grep -q "id: local-dsh-logo" "$PATCH"; then
  echo "插件加载项已存在，不重复添加。"
else
  printf '\n# Local logo override. Added by dsh-logo/tools/install.mjs; remove with --revert.\n- insert:\n    - id: local-dsh-logo\n      name: ./node_modules/@local/dsh-logo/index.js\n' >> "$PATCH" \
    || fail "写入 $PATCH 失败。"
  echo "已添加插件加载项。"
fi

echo
echo "✅ 安装完成。DeepSeek Harness 只在启动时加载插件，需要完全退出（Cmd+Q）再打开。"
if pgrep -xq "DeepSeek Harness"; then
  read -r -p "现在重启 DeepSeek Harness 吗？[y/N] " answer
  if [ "$answer" = "y" ] || [ "$answer" = "Y" ]; then
    osascript -e 'quit app "DeepSeek Harness"' && sleep 3 && open -a "DeepSeek Harness"
  fi
else
  read -r -p "按回车键关闭窗口…" _
fi
