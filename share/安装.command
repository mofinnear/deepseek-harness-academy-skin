#!/bin/bash
# 「星海书院」皮肤一键安装（DeepSeek Harness 桌面版，macOS）。
# 具体步骤都在旁边的 installer.mjs 里（和 Windows 脚本、源码里的 tools/install.mjs 共用），用应用自带的 node 运行。
# 只改配置目录 ~/.dsh/profiles/desktop 里的东西，不修改应用本体和签名：
#   local-plugins/dsh-logo/          插件文件
#   package.json、pnpm-lock.yaml     用应用自带的 pnpm 登记插件（以后在插件页装别的插件，皮肤不会被挪走）
#   cordis.patch.yml                 追加一条插件加载项
# 改动前会把原来的内容备份到 ~/.dsh/academy-skin-backup/<时间>-安装前/。

cd "$(dirname "$0")" || exit 1
DSH_HOME_DIR="${DSH_HOME:-$HOME/.dsh}"   # 和应用本身一样：设了 DSH_HOME 就用它
RUNTIME="${DSH_PRIMARY_RUNTIME:-$DSH_HOME_DIR/dsh-runtimes/dsh-primary-runtime}"
NODE="$RUNTIME/dependencies/node/bin/node"   # DeepSeek Harness 自带的 node，不需要另外安装

fail() { echo; echo "❌ $1"; echo; read -r -p "按回车键关闭窗口…" _; exit 1; }
[ -f "$PWD/installer.mjs" ] || fail "找不到 installer.mjs。请先把压缩包完整解压，再在解压出的文件夹里运行。"
[ -x "$NODE" ] || fail "找不到 DeepSeek Harness 自带的运行环境（$NODE）。请先安装并打开一次新版 DeepSeek Harness 桌面版，再运行。"
[ -f "$PWD/plugin/dsh-logo/dist/client.js" ] || fail "找不到插件文件（$PWD/plugin/dsh-logo）。请先把压缩包完整解压，再在解压出的文件夹里运行。"

"$NODE" "$PWD/installer.mjs" install --plugin "$PWD/plugin/dsh-logo" || { echo; read -r -p "安装没有完成（原因见上面）。按回车键关闭窗口…" _; exit 1; }

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
