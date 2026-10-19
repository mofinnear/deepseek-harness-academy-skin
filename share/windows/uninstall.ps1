# 「星海书院」皮肤一键卸载（Windows）。由「卸载-Windows.bat」调用。
# 恢复到安装前的状态（去掉插件文件、pnpm 登记和那条加载项）；具体步骤都在安装包根目录的 installer.mjs 里，
# 用应用自带的 node 运行；改动前同样先备份。

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

& $Node $Installer uninstall
if ($LASTEXITCODE -ne 0) { Write-Host ''; Write-Host '[错误] 卸载没有完成，原因见上面。' -ForegroundColor Red; exit 1 }

Write-Host ''
Write-Host '[完成] 完全退出 DeepSeek Harness（关闭所有窗口；托盘里有图标的话右键退出），再重新打开即可。' -ForegroundColor Green
