# 「星海书院」皮肤一键安装（DeepSeek Harness 桌面版，Windows）。由「安装-Windows.bat」调用。
# 只写用户目录里的两处，不修改应用本体：
#   %USERPROFILE%\.dsh\profiles\desktop\node_modules\@local\dsh-logo\   插件文件
#   %USERPROFILE%\.dsh\profiles\desktop\cordis.patch.yml                追加一条插件加载项
# 改动前把这两处原来的内容备份到 %USERPROFILE%\.dsh\academy-skin-backup\<时间>-安装前\。
# 环境变量 DSH_PROFILE_DIR / DSH_HOME 可指向别的目录（测试用；DSH_HOME 和应用本身的含义相同）。

$ErrorActionPreference = 'Stop'
$Pkg = Split-Path -Parent $PSScriptRoot
$Src = Join-Path $Pkg 'plugin\dsh-logo'
$DshHome = if ($env:DSH_HOME) { $env:DSH_HOME } else { Join-Path $env:USERPROFILE '.dsh' }
$ProfileDir = if ($env:DSH_PROFILE_DIR) { $env:DSH_PROFILE_DIR } else { Join-Path $DshHome 'profiles\desktop' }
$Patch = Join-Path $ProfileDir 'cordis.patch.yml'
$Target = Join-Path $ProfileDir 'node_modules\@local\dsh-logo'
$BackupRoot = if ($env:DSH_SKIN_BACKUP_DIR) { $env:DSH_SKIN_BACKUP_DIR } else { Join-Path $DshHome 'academy-skin-backup' }
$Backup = Join-Path $BackupRoot ((Get-Date -Format 'yyyyMMdd-HHmmss') + '-安装前')
$Utf8 = New-Object System.Text.UTF8Encoding($false)

function Fail($msg) { Write-Host ''; Write-Host "[错误] $msg" -ForegroundColor Red; Write-Host ''; exit 1 }

Write-Host '== 星海书院皮肤 · 安装 =='
foreach ($f in 'package.json', 'index.js', 'dist\client.js') {
  if (-not (Test-Path (Join-Path $Src $f))) { Fail "找不到插件文件（$Src）。请先把压缩包完整解压，再在解压出的文件夹里运行。" }
}
if (-not (Test-Path $ProfileDir)) { Fail "没有找到 DeepSeek Harness 的配置目录（$ProfileDir）。请先安装并打开一次 DeepSeek Harness 桌面版。" }

try {
  New-Item -ItemType Directory -Force -Path $Backup | Out-Null
  if (Test-Path $Patch) { Copy-Item $Patch (Join-Path $Backup 'cordis.patch.yml') }
  if (Test-Path $Target) { Copy-Item $Target (Join-Path $Backup 'dsh-logo') -Recurse }
} catch { Fail "备份失败：$($_.Exception.Message)" }
Write-Host "已备份原来的设置到：$Backup"

try {
  if (Test-Path $Target) { Remove-Item $Target -Recurse -Force }
  New-Item -ItemType Directory -Force -Path $Target | Out-Null
  Copy-Item (Join-Path $Src 'package.json'), (Join-Path $Src 'index.js') $Target
  Copy-Item (Join-Path $Src 'dist') $Target -Recurse
} catch { Fail "复制插件文件失败：$($_.Exception.Message)" }

$text = if (Test-Path $Patch) { [System.IO.File]::ReadAllText($Patch, $Utf8) } else { '' }
if ($text -match 'id: local-dsh-logo') {
  Write-Host '插件加载项已存在，不重复添加。'
} else {
  # 和 Mac 版脚本、tools/install.mjs 写的是同样的四行（换行用 \n）
  $block = "`n# Local logo override. Added by dsh-logo/tools/install.mjs; remove with --revert.`n- insert:`n    - id: local-dsh-logo`n      name: ./node_modules/@local/dsh-logo/index.js`n"
  try { [System.IO.File]::AppendAllText($Patch, $block, $Utf8) } catch { Fail "写入 $Patch 失败：$($_.Exception.Message)" }
  Write-Host '已添加插件加载项。'
}

Write-Host ''
Write-Host '[完成] 安装完成。DeepSeek Harness 只在启动时加载插件：请完全退出它（关闭所有窗口；如果任务栏右下角托盘里还有图标，右键退出），再重新打开。' -ForegroundColor Green
