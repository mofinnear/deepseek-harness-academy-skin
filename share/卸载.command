#!/bin/bash
# 「星海书院」皮肤一键卸载：删掉插件文件和 cordis.patch.yml 里那条加载项，恢复原版界面。
# 改动前同样会备份到 ~/.dsh/academy-skin-backup/<时间>/。

DSH_HOME_DIR="${DSH_HOME:-$HOME/.dsh}"   # 和应用本身一样：设了 DSH_HOME 就用它
PROFILE="${DSH_PROFILE_DIR:-$DSH_HOME_DIR/profiles/desktop}"
PATCH="$PROFILE/cordis.patch.yml"
TARGET="$PROFILE/node_modules/@local/dsh-logo"
BACKUP="${DSH_SKIN_BACKUP_DIR:-$DSH_HOME_DIR/academy-skin-backup}/$(date +%Y%m%d-%H%M%S)-卸载前"

fail() { echo; echo "❌ $1"; echo; read -r -p "按回车键关闭窗口…" _; exit 1; }

echo "== 星海书院皮肤 · 卸载 =="
if [ ! -d "$TARGET" ] && ! { [ -f "$PATCH" ] && grep -qE '^[[:space:]]*- id: local-dsh-logo[[:space:]]*$' "$PATCH"; }; then
  echo "没有发现已安装的皮肤，不需要卸载。"
  read -r -p "按回车键关闭窗口…" _
  exit 0
fi

# 备份必须成功才继续：任何一步复制失败（磁盘满、没权限）都停下，不动原文件
# 同一个路径 @local/dsh-logo 以前也被别的本地 logo 插件用过：不是本皮肤就不删
if [ -d "$TARGET" ] && ! grep -q "anime-academy skin" "$TARGET/package.json" 2>/dev/null; then
  fail "$TARGET 不是星海书院皮肤（package.json 里没有 anime-academy skin），为安全起见没有删除。如确定要删，请手动处理。"
fi

mkdir -p "$BACKUP" || fail "无法创建备份目录 $BACKUP"
if [ -f "$PATCH" ]; then
  cp "$PATCH" "$BACKUP/cordis.patch.yml" && [ -f "$BACKUP/cordis.patch.yml" ] || fail "备份 cordis.patch.yml 失败，没有做任何改动。"
fi
if [ -d "$TARGET" ]; then
  cp -R "$TARGET" "$BACKUP/dsh-logo" && [ -d "$BACKUP/dsh-logo" ] || fail "备份原插件目录失败，没有做任何改动。"
fi
echo "已备份当前设置到：$BACKUP"

rm -rf "$TARGET" || fail "删除插件文件失败。"
if [ -f "$PATCH" ]; then
  # 只去掉安装时追加的东西：前面那个换行 + 注释行（可能没有）+ - insert: / id / name 三行；文件其余部分一个字节都不动
  perl -0pi -e 's/\n?(?:# Local logo override[^\n]*\n)?- insert:\n[ \t]+- id: local-dsh-logo\n[ \t]+name: [^\n]*(?:\n|\z)//g' "$PATCH" \
    || fail "修改 $PATCH 失败。"
fi

echo
echo "✅ 已卸载。完全退出（Cmd+Q）DeepSeek Harness 再打开，就回到原版界面。"
if pgrep -xq "DeepSeek Harness"; then
  read -r -p "现在重启 DeepSeek Harness 吗？[y/N] " answer
  if [ "$answer" = "y" ] || [ "$answer" = "Y" ]; then
    osascript -e 'quit app "DeepSeek Harness"' && sleep 3 && open -a "DeepSeek Harness"
  fi
else
  read -r -p "按回车键关闭窗口…" _
fi
