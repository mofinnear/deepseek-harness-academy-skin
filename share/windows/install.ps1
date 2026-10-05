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
$BackupBase = Join-Path $BackupRoot ((Get-Date -Format 'yyyyMMdd-HHmmss') + '-安装前')
# 同一秒里运行两次也不共用备份目录：重名时加 -1、-2…
$Backup = $BackupBase; $n = 1; while (Test-Path $Backup) { $Backup = "$BackupBase-$n"; $n++ }
$Utf8 = New-Object System.Text.UTF8Encoding($false)

function Fail($msg) { Write-Host ''; Write-Host "[错误] $msg" -ForegroundColor Red; Write-Host ''; exit 1 }
# 加载项：ID 是 local-dsh-logo 且路径是本皮肤的，才算「本皮肤的那一条」（兼容 \r\n）
$OurRowPattern = '(?m)^[ \t]*- id: local-dsh-logo[ \t]*\r?\n[ \t]+name: \./node_modules/@local/dsh-logo/index\.js[ \t]*\r?$'
$AnyRowPattern = '(?m)^[ \t]*- id: local-dsh-logo[ \t]*\r?$'

Write-Host '== 星海书院皮肤 · 安装 =='
foreach ($f in 'package.json', 'index.js', 'dist\client.js') {
  if (-not (Test-Path (Join-Path $Src $f))) { Fail "找不到插件文件（$Src）。请先把压缩包完整解压，再在解压出的文件夹里运行。" }
}
if (-not (Test-Path $ProfileDir)) { Fail "没有找到 DeepSeek Harness 的配置目录（$ProfileDir）。请先安装并打开一次 DeepSeek Harness 桌面版。" }
$text = if (Test-Path $Patch) { [System.IO.File]::ReadAllText($Patch, $Utf8) } else { '' }
if (($text -match $AnyRowPattern) -and ($text -notmatch $OurRowPattern)) {
  Fail "$Patch 里已经有一条 id 为 local-dsh-logo、但指向别的路径的加载项，为安全起见没有做任何改动。请先手动检查那一条。"
}

# 安装记录（插件目录里的 .academy-install）：卸载时据此还原到安装前的状态。
#   added_row=1        加载项是本皮肤安装时加的（卸载时删掉）；0 = 安装前就有（卸载时保留）
#   previous_plugin=…  安装前那里另有一个插件，它的备份位置（卸载时放回去）；空 = 没有
# 升级安装（插件目录已经是本皮肤）时沿用旧记录，不能把旧版皮肤当成「安装前的插件」。
$RowExisted = $text -match $OurRowPattern
$TargetExisted = Test-Path $Target
$TargetIsOurs = $false; $OldAdded = ''; $OldPrev = ''
if ($TargetExisted) {
  $pkgJson = Join-Path $Target 'package.json'
  $TargetIsOurs = (Test-Path $pkgJson) -and ([System.IO.File]::ReadAllText($pkgJson, $Utf8) -match 'anime-academy skin')
  $rec = Join-Path $Target '.academy-install'
  if ($TargetIsOurs -and (Test-Path $rec)) {
    $recText = [System.IO.File]::ReadAllText($rec, $Utf8)
    if ($recText -match '(?m)^added_row=(.*?)\r?$') { $OldAdded = $Matches[1] }
    if ($recText -match '(?m)^previous_plugin=(.*?)\r?$') { $OldPrev = $Matches[1] }
  }
}
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

if ($RowExisted) {
  Write-Host '插件加载项已存在，不重复添加。'
  # 本皮肤升级：沿用记录（老版本没有记录时，加载项也是当时加的）；否则是安装前就有的
  $Added = if ($TargetIsOurs) { if ($OldAdded) { $OldAdded } else { '1' } } else { '0' }
} else {
  # 和 Mac 版脚本、tools/install.mjs 写的是同样的四行（换行用 \n）
  $block = "`n# Local logo override. Added by dsh-logo/tools/install.mjs; remove with --revert.`n- insert:`n    - id: local-dsh-logo`n      name: ./node_modules/@local/dsh-logo/index.js`n"
  try { [System.IO.File]::AppendAllText($Patch, $block, $Utf8) } catch { Fail "写入 $Patch 失败：$($_.Exception.Message)" }
  Write-Host '已添加插件加载项。'
  $Added = '1'
}
# 安装前那里另有插件（存在、且不是本皮肤）才记下它的备份
$Prev = if ($TargetIsOurs) { $OldPrev } elseif ($TargetExisted) { Join-Path $Backup 'dsh-logo' } else { '' }
try { [System.IO.File]::WriteAllText((Join-Path $Target '.academy-install'), "added_row=$Added`nprevious_plugin=$Prev`n", $Utf8) } catch { Fail "写入安装记录失败：$($_.Exception.Message)" }
if ($Prev) { Write-Host "安装前这里有另一个插件，已备份到 $Prev，卸载时会放回去。" }

Write-Host ''
Write-Host '[完成] 安装完成。DeepSeek Harness 只在启动时加载插件：请完全退出它（关闭所有窗口；如果任务栏右下角托盘里还有图标，右键退出），再重新打开。' -ForegroundColor Green
