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
# 加载项：ID 是 local-dsh-logo 且路径是本皮肤的，才算「本皮肤的那一条」（兼容 \r\n）。
# 整个文件读进来再判断：perl -0ne 在空文件上一次都不执行、退出码是 0，会把空文件误判成「有这一行」
has_our_row() { [ -f "$PATCH" ] && perl -e 'local $/; my $t = <>; exit((defined $t && $t =~ /^[ \t]*- id: local-dsh-logo[ \t]*\r?\n[ \t]+name: \.\/node_modules\/\@local\/dsh-logo\/index\.js[ \t]*\r?$/m) ? 0 : 1)' "$PATCH"; }
has_any_row() { [ -f "$PATCH" ] && perl -e 'local $/; my $t = <>; exit((defined $t && $t =~ /^[ \t]*- id: local-dsh-logo[ \t]*\r?$/m) ? 0 : 1)' "$PATCH"; }

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
#   created_patch=1    cordis.patch.yml 是本皮肤安装时新建的（卸载后变空就删掉）
# 升级安装（插件目录已经是本皮肤）时沿用旧记录，不能把旧版皮肤当成「安装前的插件」。
BACKUP_ROOT="${DSH_SKIN_BACKUP_DIR:-$DSH_HOME_DIR/academy-skin-backup}"
ROW_EXISTED=0; has_our_row && ROW_EXISTED=1
PATCH_EXISTED=0; [ -f "$PATCH" ] && PATCH_EXISTED=1
TARGET_EXISTED=0; [ -d "$TARGET" ] && TARGET_EXISTED=1
TARGET_IS_OURS=0; HAD_RECORD=0; OLD_ADDED=""; OLD_PREV=""; OLD_CREATED=""
if [ -d "$TARGET" ] && grep -q "anime-academy skin" "$TARGET/package.json" 2>/dev/null; then
  TARGET_IS_OURS=1
  if [ -f "$TARGET/.academy-install" ]; then
    HAD_RECORD=1
    OLD_ADDED="$(sed -n 's/^added_row=//p' "$TARGET/.academy-install")"
    OLD_PREV="$(sed -n 's/^previous_plugin=//p' "$TARGET/.academy-install")"
    OLD_CREATED="$(sed -n 's/^created_patch=//p' "$TARGET/.academy-install")"
  fi
fi

# 旧版（没有安装记录）升级：从旧的「安装前」备份里找装皮肤之前的原状——从新到旧，
# 跳过里面是本皮肤的（那是以前升级时留的），第一份就是这次这一串安装开始前的样子
find_pre_skin_backup() {
  ls -1d "$BACKUP_ROOT"/*-安装前* 2>/dev/null | sort -r | while IFS= read -r d; do
    [ "$d" = "$BACKUP" ] && continue
    if [ -d "$d/dsh-logo" ] && grep -q "anime-academy skin" "$d/dsh-logo/package.json" 2>/dev/null; then continue; fi
    echo "$d"; break
  done
}

if [ "$TARGET_IS_OURS" = 1 ] && [ "$HAD_RECORD" = 1 ]; then
  ADDED="${OLD_ADDED:-1}"; PREV="$OLD_PREV"; CREATED="${OLD_CREATED:-0}"
elif [ "$TARGET_IS_OURS" = 1 ]; then
  ORIG="$(find_pre_skin_backup)"
  if [ -n "$ORIG" ]; then
    echo "旧版没有安装记录，按装皮肤之前的备份推断：$ORIG"
    PREV=""; [ -d "$ORIG/dsh-logo" ] && PREV="$ORIG/dsh-logo"
    if [ -f "$ORIG/cordis.patch.yml" ]; then
      CREATED=0
      if perl -e 'local $/; my $t = <>; exit((defined $t && $t =~ /^[ \t]*- id: local-dsh-logo[ \t]*\r?\n[ \t]+name: \.\/node_modules\/\@local\/dsh-logo\/index\.js[ \t]*\r?$/m) ? 0 : 1)' "$ORIG/cordis.patch.yml"; then ADDED=0; else ADDED=1; fi
    else
      CREATED=1; ADDED=1
    fi
  else
    ADDED=1; PREV=""; CREATED=0   # 找不到备份：按老版本的做法（加载项是当时加的），配置文件不删
  fi
else
  ADDED=0; PREV=""; CREATED=0
  [ "$TARGET_EXISTED" = 1 ] && PREV="$BACKUP/dsh-logo"
  [ "$PATCH_EXISTED" = 0 ] && CREATED=1
fi
[ "$ROW_EXISTED" = 0 ] && ADDED=1   # 这次要新加加载项

# 备份必须成功才继续：任何一步复制失败（磁盘满、没权限）都停下，不动原文件
mkdir -p "$BACKUP" || fail "无法创建备份目录 $BACKUP"
if [ -f "$PATCH" ]; then
  cp "$PATCH" "$BACKUP/cordis.patch.yml" && [ -f "$BACKUP/cordis.patch.yml" ] || fail "备份 cordis.patch.yml 失败，没有做任何改动。"
fi
if [ -d "$TARGET" ]; then
  cp -R "$TARGET" "$BACKUP/dsh-logo" && [ -d "$BACKUP/dsh-logo" ] || fail "备份原插件目录失败，没有做任何改动。"
fi
echo "已备份原来的设置到：$BACKUP"

# 新插件连同安装记录先放进临时目录，全部成功后再一步换上去；中途失败什么都不改
STAGE="$(dirname "$TARGET")/.dsh-logo-staging-$$"
mkdir -p "$STAGE" \
  && cp "$SRC/package.json" "$SRC/index.js" "$STAGE/" \
  && cp -R "$SRC/dist" "$STAGE/" \
  && printf 'added_row=%s\nprevious_plugin=%s\ncreated_patch=%s\n' "$ADDED" "$PREV" "$CREATED" > "$STAGE/.academy-install" \
  || { rm -rf "$STAGE"; fail "准备插件文件失败，没有做任何改动。"; }
# 换上新插件；改配置失败时把插件撤回到安装前的样子
restore_old_plugin() {
  rm -rf "$TARGET"
  if [ -d "$BACKUP/dsh-logo" ]; then cp -R "$BACKUP/dsh-logo" "$TARGET"; fi
}
rm -rf "$TARGET" && mv "$STAGE" "$TARGET" \
  || { rm -rf "$STAGE"; restore_old_plugin; fail "替换插件文件失败，已恢复原来的插件。"; }

if [ "$ROW_EXISTED" = 1 ]; then
  echo "插件加载项已存在，不重复添加。"
else
  if ! printf '\n# Local logo override. Added by dsh-logo/tools/install.mjs; remove with --revert.\n- insert:\n    - id: local-dsh-logo\n      name: ./node_modules/@local/dsh-logo/index.js\n' >> "$PATCH" 2>/dev/null || ! has_our_row; then
    restore_old_plugin
    fail "写入 $PATCH 失败，已把插件恢复成安装前的样子。"
  fi
  echo "已添加插件加载项。"
fi
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
