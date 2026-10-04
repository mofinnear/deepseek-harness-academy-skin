#!/bin/bash
# 「星海书院」皮肤一键卸载：删掉插件文件和 cordis.patch.yml 里那条加载项，恢复原版界面。
# 改动前同样会备份到 ~/.dsh/academy-skin-backup/<时间>/。

PROFILE="${DSH_PROFILE_DIR:-$HOME/.dsh/profiles/desktop}"
PATCH="$PROFILE/cordis.patch.yml"
TARGET="$PROFILE/node_modules/@local/dsh-logo"
BACKUP="${DSH_SKIN_BACKUP_DIR:-$HOME/.dsh/academy-skin-backup}/$(date +%Y%m%d-%H%M%S)-卸载前"

fail() { echo; echo "❌ $1"; echo; read -r -p "按回车键关闭窗口…" _; exit 1; }

echo "== 星海书院皮肤 · 卸载 =="
if [ ! -d "$TARGET" ] && ! { [ -f "$PATCH" ] && grep -q "id: local-dsh-logo" "$PATCH"; }; then
  echo "没有发现已安装的皮肤，不需要卸载。"
  read -r -p "按回车键关闭窗口…" _
  exit 0
fi

mkdir -p "$BACKUP" || fail "无法创建备份目录 $BACKUP"
[ -f "$PATCH" ] && cp "$PATCH" "$BACKUP/cordis.patch.yml"
[ -d "$TARGET" ] && cp -R "$TARGET" "$BACKUP/dsh-logo"
echo "已备份当前设置到：$BACKUP"

rm -rf "$TARGET" || fail "删除插件文件失败。"
if [ -f "$PATCH" ]; then
  # 去掉安装时追加的那一段（注释行、- insert:、id、name 四行），再把多余的空行合并
  perl -0pi -e 's/^# Local logo override[^\n]*\n(?=- insert:\n[ \t]+- id: local-dsh-logo\n)//mg; s/^- insert:\n[ \t]+- id: local-dsh-logo\n[ \t]+name: [^\n]*\n?//mg; s/\n{3,}/\n\n/g' "$PATCH" \
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
