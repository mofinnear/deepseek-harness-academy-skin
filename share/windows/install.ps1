# 「星海书院」皮肤一键安装（DeepSeek Harness 桌面版，Windows）。由「安装-Windows.bat」调用。
# 具体步骤都在安装包根目录的 installer.mjs 里（和 Mac 版「安装.command」、源码里的 tools/install.mjs 共用），用应用自带的 node 运行。
# 只改配置目录 %USERPROFILE%\.dsh\profiles\desktop 里的东西，不修改应用本体：
#   local-plugins\dsh-logo\         插件文件
#   package.json、pnpm-lock.yaml     用应用自带的 pnpm 登记插件（以后在插件页装别的插件，皮肤不会被挪走）
#   cordis.patch.yml                 追加一条插件加载项
# 改动前把原来的内容备份到 %USERPROFILE%\.dsh\academy-skin-backup\<时间>-安装前\。
# 环境变量 DSH_PROFILE_DIR / DSH_HOME 可指向别的目录（测试用；DSH_HOME 和应用本身的含义相同）。

$ErrorActionPreference = 'Stop'
# 让窗口按 UTF-8 显示 installer.mjs 输出的中文
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
$Pkg = Split-Path -Parent $PSScriptRoot
$DshHome = if ($env:DSH_HOME) { $env:DSH_HOME } else { Join-Path $env:USERPROFILE '.dsh' }
$Runtime = if ($env:DSH_PRIMARY_RUNTIME) { $env:DSH_PRIMARY_RUNTIME } else { Join-Path $DshHome 'dsh-runtimes\dsh-primary-runtime' }
# DeepSeek Harness 自带的 node，不需要另外安装
$Node = Join-Path $Runtime 'dependencies\node\bin\node.exe'
$Installer = Join-Path $Pkg 'installer.mjs'

function Fail($msg) { Write-Host ''; Write-Host "[错误] $msg" -ForegroundColor Red; Write-Host ''; exit 1 }
if (-not (Test-Path $Installer)) { Fail '找不到 installer.mjs。请先把压缩包完整解压，再在解压出的文件夹里运行。' }
if (-not (Test-Path $Node)) { Fail "找不到 DeepSeek Harness 自带的运行环境（$Node）。请先安装并打开一次新版 DeepSeek Harness 桌面版，再运行。" }
$Src = Join-Path $Pkg 'plugin\dsh-logo'
if (-not (Test-Path (Join-Path $Src 'dist\client.js'))) { Fail "找不到插件文件（$Src）。请先把压缩包完整解压，再在解压出的文件夹里运行。" }

& $Node $Installer install --plugin $Src
if ($LASTEXITCODE -ne 0) { Write-Host ''; Write-Host '[错误] 安装没有完成，原因见上面。' -ForegroundColor Red; exit 1 }

Write-Host ''
Write-Host '[完成] 安装完成。DeepSeek Harness 只在启动时加载插件：请完全退出它（关闭所有窗口；如果任务栏右下角托盘里还有图标，右键退出），再重新打开。' -ForegroundColor Green
