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
BACKUP_BASE="${DSH_SKIN_BACKUP_DIR:-$DSH_HOME_DIR/academy-skin-backup}/$(date +%Y%m%d-%H%M%S)-安装前"
# 同一秒里运行两次也不共用备份目录：重名时加 -1、-2…
BACKUP="$BACKUP_BASE"; n=1; while [ -e "$BACKUP" ]; do BACKUP="$BACKUP_BASE-$n"; n=$((n+1)); done

fail() { echo; echo "❌ $1"; echo; read -r -p "按回车键关闭窗口…" _; exit 1; }
# 加载项：ID 是 local-dsh-logo 且路径是本皮肤的，才算「本皮肤的那一条」（兼容 \r\n）
has_our_row() { [ -f "$PATCH" ] && perl -0ne 'exit(/^[ \t]*- id: local-dsh-logo[ \t]*\r?\n[ \t]+name: \.\/node_modules\/\@local\/dsh-logo\/index\.js[ \t]*\r?$/m ? 0 : 1)' "$PATCH"; }
has_any_row() { [ -f "$PATCH" ] && perl -0ne 'exit(/^[ \t]*- id: local-dsh-logo[ \t]*\r?$/m ? 0 : 1)' "$PATCH"; }

echo "== 星海书院皮肤 · 安装 =="
[ -f "$SRC/dist/client.js" ] && [ -f "$SRC/index.js" ] && [ -f "$SRC/package.json" ] \
  || fail "找不到插件文件（$SRC）。请先把压缩包完整解压，再在解压出的文件夹里运行。"
[ -d "$PROFILE" ] \
  || fail "没有找到 DeepSeek Harness 的配置目录（$PROFILE）。请先安装并打开一次 DeepSeek Harness 桌面版。"
if has_any_row && ! has_our_row; then
  fail "$PATCH 里已经有一条 id 为 local-dsh-logo、但指向别的路径的加载项，为安全起见没有做任何改动。请先手动检查那一条。"
fi

# 安装记录（插件目录里的 .academy-install）：卸载时据此还原到安装前的状态。
#   added_row=1        加载项是本皮肤安装时加的（卸载时删掉）；0 = 安装前就有（卸载时保留）
#   previous_plugin=…  安装前那里另有一个插件，它的备份位置（卸载时放回去）；空 = 没有
# 升级安装（插件目录已经是本皮肤）时沿用旧记录，不能把旧版皮肤当成「安装前的插件」。
ROW_EXISTED=0; has_our_row && ROW_EXISTED=1
TARGET_EXISTED=0; [ -d "$TARGET" ] && TARGET_EXISTED=1
TARGET_IS_OURS=0; OLD_ADDED=""; OLD_PREV=""
if [ -d "$TARGET" ] && grep -q "anime-academy skin" "$TARGET/package.json" 2>/dev/null; then
  TARGET_IS_OURS=1
  if [ -f "$TARGET/.academy-install" ]; then
    OLD_ADDED="$(sed -n 's/^added_row=//p' "$TARGET/.academy-install")"
    OLD_PREV="$(sed -n 's/^previous_plugin=//p' "$TARGET/.academy-install")"
  fi
fi

# 备份必须成功才继续：任何一步复制失败（磁盘满、没权限）都停下，不动原文件
mkdir -p "$BACKUP" || fail "无法创建备份目录 $BACKUP"
if [ -f "$PATCH" ]; then
  cp "$PATCH" "$BACKUP/cordis.patch.yml" && [ -f "$BACKUP/cordis.patch.yml" ] || fail "备份 cordis.patch.yml 失败，没有做任何改动。"
fi
if [ -d "$TARGET" ]; then
  cp -R "$TARGET" "$BACKUP/dsh-logo" && [ -d "$BACKUP/dsh-logo" ] || fail "备份原插件目录失败，没有做任何改动。"
fi
echo "已备份原来的设置到：$BACKUP"

rm -rf "$TARGET" && mkdir -p "$TARGET" \
  && cp "$SRC/package.json" "$SRC/index.js" "$TARGET/" \
  && cp -R "$SRC/dist" "$TARGET/" \
  || fail "复制插件文件失败。"

if [ "$ROW_EXISTED" = 1 ]; then
  echo "插件加载项已存在，不重复添加。"
  # 本皮肤升级：沿用记录（老版本没有记录时，加载项也是当时加的）；否则是安装前就有的
  if [ "$TARGET_IS_OURS" = 1 ]; then ADDED="${OLD_ADDED:-1}"; else ADDED=0; fi
else
  printf '\n# Local logo override. Added by dsh-logo/tools/install.mjs; remove with --revert.\n- insert:\n    - id: local-dsh-logo\n      name: ./node_modules/@local/dsh-logo/index.js\n' >> "$PATCH" \
    || fail "写入 $PATCH 失败。"
  echo "已添加插件加载项。"
  ADDED=1
fi
# 安装前那里另有插件（存在、且不是本皮肤）才记下它的备份
if [ "$TARGET_IS_OURS" = 1 ]; then PREV="$OLD_PREV"; elif [ "$TARGET_EXISTED" = 1 ]; then PREV="$BACKUP/dsh-logo"; else PREV=""; fi
printf 'added_row=%s\nprevious_plugin=%s\n' "$ADDED" "$PREV" > "$TARGET/.academy-install" || fail "写入安装记录失败。"
[ -n "$PREV" ] && echo "安装前这里有另一个插件，已备份到 $PREV，卸载时会放回去。"

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
