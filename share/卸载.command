#!/bin/bash
# 「星海书院」皮肤一键卸载：删掉插件文件和 cordis.patch.yml 里那条加载项，恢复原版界面。
# 改动前同样会备份到 ~/.dsh/academy-skin-backup/<时间>/。

DSH_HOME_DIR="${DSH_HOME:-$HOME/.dsh}"   # 和应用本身一样：设了 DSH_HOME 就用它
PROFILE="${DSH_PROFILE_DIR:-$DSH_HOME_DIR/profiles/desktop}"
PATCH="$PROFILE/cordis.patch.yml"
TARGET="$PROFILE/node_modules/@local/dsh-logo"
BACKUP_BASE="${DSH_SKIN_BACKUP_DIR:-$DSH_HOME_DIR/academy-skin-backup}/$(date +%Y%m%d-%H%M%S)-卸载前"
# 同一秒里运行两次也不共用备份目录：重名时加 -1、-2…
BACKUP="$BACKUP_BASE"; n=1; while [ -e "$BACKUP" ]; do BACKUP="$BACKUP_BASE-$n"; n=$((n+1)); done

fail() { echo; echo "❌ $1"; echo; read -r -p "按回车键关闭窗口…" _; exit 1; }
# 加载项：ID 是 local-dsh-logo 且路径是本皮肤的，才算「本皮肤的那一条」（兼容 \r\n）
has_our_row() { [ -f "$PATCH" ] && perl -0ne 'exit(/^[ \t]*- id: local-dsh-logo[ \t]*\r?\n[ \t]+name: \.\/node_modules\/\@local\/dsh-logo\/index\.js[ \t]*\r?$/m ? 0 : 1)' "$PATCH"; }
has_any_row() { [ -f "$PATCH" ] && perl -0ne 'exit(/^[ \t]*- id: local-dsh-logo[ \t]*\r?$/m ? 0 : 1)' "$PATCH"; }

echo "== 星海书院皮肤 · 卸载 =="
if [ ! -d "$TARGET" ] && ! has_our_row; then
  echo "没有发现已安装的皮肤，不需要卸载。"
  read -r -p "按回车键关闭窗口…" _
  exit 0
fi

# 备份必须成功才继续：任何一步复制失败（磁盘满、没权限）都停下，不动原文件
# 同一个路径 @local/dsh-logo 以前也被别的本地 logo 插件用过：不是本皮肤就不删
if [ -d "$TARGET" ] && ! grep -q "anime-academy skin" "$TARGET/package.json" 2>/dev/null; then
  fail "$TARGET 不是星海书院皮肤（package.json 里没有 anime-academy skin），为安全起见没有删除。如确定要删，请手动处理。"
fi

# 安装记录（安装脚本写在插件目录里）：没有记录的是老版本装的，当时加载项都是新加的
ADDED=1; PREV=""
if [ -f "$TARGET/.academy-install" ]; then
  ADDED="$(sed -n 's/^added_row=//p' "$TARGET/.academy-install")"; ADDED="${ADDED:-1}"
  PREV="$(sed -n 's/^previous_plugin=//p' "$TARGET/.academy-install")"
fi
if [ -n "$PREV" ] && [ ! -d "$PREV" ]; then
  fail "安装前那里另有一个插件，它的备份 $PREV 已经不在了，卸载后没法放回去。为安全起见没有做任何改动；如确定不需要它，请先删掉 $TARGET/.academy-install 再卸载。"
fi

mkdir -p "$BACKUP" || fail "无法创建备份目录 $BACKUP"
if [ -f "$PATCH" ]; then
  cp "$PATCH" "$BACKUP/cordis.patch.yml" && [ -f "$BACKUP/cordis.patch.yml" ] || fail "备份 cordis.patch.yml 失败，没有做任何改动。"
fi
if [ -d "$TARGET" ]; then
  cp -R "$TARGET" "$BACKUP/dsh-logo" && [ -d "$BACKUP/dsh-logo" ] || fail "备份原插件目录失败，没有做任何改动。"
fi
echo "已备份当前设置到：$BACKUP"

# 先改配置、确认成功再删插件：配置写不进去时插件还在，不会出现「加载项还在、插件没了」的半卸载状态
if [ "$ADDED" != 1 ]; then
  echo "加载项是安装前就有的，保留不动。"
elif [ -f "$PATCH" ]; then
  # 只去掉安装时追加的东西：前面那个换行 + 注释行（可能没有）+ - insert: / id / name 三行，且 name 必须是本皮肤的路径；
  # 文件其余部分一个字节都不动（兼容 \r\n）
  perl -0pi -e 's/\r?\n?(?:# Local logo override[^\r\n]*\r?\n)?- insert:\r?\n[ \t]+- id: local-dsh-logo[ \t]*\r?\n[ \t]+name: \.\/node_modules\/\@local\/dsh-logo\/index\.js[ \t]*(?:\r?\n|\z)//g' "$PATCH" \
    || fail "修改 $PATCH 失败，插件文件没有删除。备份在 $BACKUP"
  # perl -i 写不进去时（如目录只读）只打印警告、退出码仍是 0，所以再确认一次那一行真的没了
  if has_our_row; then fail "没能修改 $PATCH（可能没有写权限），插件文件没有删除。备份在 $BACKUP"; fi
fi
rm -rf "$TARGET" || fail "删除插件文件失败。"
if [ -n "$PREV" ]; then
  cp -R "$PREV" "$TARGET" && [ -d "$TARGET" ] || fail "放回安装前的插件失败，请手动把 $PREV 复制到 $TARGET。"
  echo "已把安装前的插件放回原处。"
fi
# 安装时可能新建了 node_modules/@local：变空了就删掉（rmdir 只删空目录，里面有别的东西就什么都不做）
rmdir "$PROFILE/node_modules/@local" "$PROFILE/node_modules" 2>/dev/null || true

echo
echo "✅ 已卸载，恢复到安装前的状态。完全退出（Cmd+Q）DeepSeek Harness 再打开即可。"
if pgrep -xq "DeepSeek Harness"; then
  read -r -p "现在重启 DeepSeek Harness 吗？[y/N] " answer
  if [ "$answer" = "y" ] || [ "$answer" = "Y" ]; then
    osascript -e 'quit app "DeepSeek Harness"' && sleep 3 && open -a "DeepSeek Harness"
  fi
else
  read -r -p "按回车键关闭窗口…" _
fi
