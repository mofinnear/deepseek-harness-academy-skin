#!/bin/bash
# 「星海书院」皮肤一键卸载：恢复到安装前的状态（去掉插件文件、pnpm 登记和那条加载项）。
# 具体步骤都在旁边的 installer.mjs 里，用应用自带的 node 运行；改动前同样会备份到 ~/.dsh/academy-skin-backup/<时间>-卸载前/。

cd "$(dirname "$0")" || exit 1
DSH_HOME_DIR="${DSH_HOME:-$HOME/.dsh}"   # 和应用本身一样：设了 DSH_HOME 就用它
RUNTIME="${DSH_PRIMARY_RUNTIME:-$DSH_HOME_DIR/dsh-runtimes/dsh-primary-runtime}"
NODE="$RUNTIME/dependencies/node/bin/node"   # DeepSeek Harness 自带的 node，不需要另外安装

fail() { echo; echo "❌ $1"; echo; read -r -p "按回车键关闭窗口…" _; exit 1; }
[ -f "$PWD/installer.mjs" ] || fail "找不到 installer.mjs。请先把压缩包完整解压，再在解压出的文件夹里运行。"
[ -x "$NODE" ] || fail "找不到 DeepSeek Harness 自带的运行环境（$NODE）。请先安装并打开一次新版 DeepSeek Harness 桌面版，再运行。"

"$NODE" "$PWD/installer.mjs" uninstall || { echo; read -r -p "卸载没有完成（原因见上面）。按回车键关闭窗口…" _; exit 1; }

echo
echo "✅ 完全退出（Cmd+Q）DeepSeek Harness 再打开即可。"
if pgrep -xq "DeepSeek Harness"; then
  read -r -p "现在重启 DeepSeek Harness 吗？[y/N] " answer
  if [ "$answer" = "y" ] || [ "$answer" = "Y" ]; then
    osascript -e 'quit app "DeepSeek Harness"' && sleep 3 && open -a "DeepSeek Harness"
  fi
else
  read -r -p "按回车键关闭窗口…" _
fi
