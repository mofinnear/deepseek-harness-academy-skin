# 「星海书院」皮肤一键安装（DeepSeek Harness 桌面版，Windows）。由「安装-Windows.bat」调用。
# 只写用户目录里的两处，不修改应用本体：
#   %USERPROFILE%\.dsh\profiles\desktop\node_modules\@local\dsh-logo\   插件文件（含安装记录 .academy-install）
#   %USERPROFILE%\.dsh\profiles\desktop\cordis.patch.yml                追加一条插件加载项
# 改动前把这两处原来的内容备份到 %USERPROFILE%\.dsh\academy-skin-backup\<时间>-安装前\。
# 环境变量 DSH_PROFILE_DIR / DSH_HOME 可指向别的目录（测试用；DSH_HOME 和应用本身的含义相同）。
# 逻辑和 Mac 版「安装.command」、tools/install.mjs 相同。

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
function IsOurPlugin($dir) {
  $pkgJson = Join-Path $dir 'package.json'
  return (Test-Path $pkgJson) -and ([System.IO.File]::ReadAllText($pkgJson, $Utf8) -match 'anime-academy skin')
}
function RecordValue($text, $key) {
  if ($text -match "(?m)^$key=(.*?)\r?$") { return $Matches[1] } else { return '' }
}

Write-Host '== 星海书院皮肤 · 安装 =='
foreach ($f in 'package.json', 'index.js', 'dist\client.js') {
  if (-not (Test-Path (Join-Path $Src $f))) { Fail "找不到插件文件（$Src）。请先把压缩包完整解压，再在解压出的文件夹里运行。" }
}
if (-not (Test-Path $ProfileDir)) { Fail "没有找到 DeepSeek Harness 的配置目录（$ProfileDir）。请先安装并打开一次 DeepSeek Harness 桌面版。" }
$PatchExisted = Test-Path $Patch
$text = if ($PatchExisted) { [System.IO.File]::ReadAllText($Patch, $Utf8) } else { '' }
if (($text -match $AnyRowPattern) -and ($text -notmatch $OurRowPattern)) {
  Fail "$Patch 里已经有一条 id 为 local-dsh-logo、但指向别的路径的加载项，为安全起见没有做任何改动。请先手动检查那一条。"
}

# 安装记录（插件目录里的 .academy-install）：卸载时据此还原到安装前的状态。
#   added_row=1        加载项是本皮肤安装时加的（卸载时删掉）；0 = 安装前就有（卸载时保留）
#   previous_plugin=…  安装前那里另有一个插件，它的备份位置（卸载时放回去）；空 = 没有
#   created_patch=1    cordis.patch.yml 是本皮肤安装时新建的（卸载后变空就删掉）
# 升级安装（插件目录已经是本皮肤）时沿用旧记录，不能把旧版皮肤当成「安装前的插件」。
$RowExisted = $text -match $OurRowPattern
$TargetExisted = Test-Path $Target
$TargetIsOurs = $TargetExisted -and (IsOurPlugin $Target)
$RecordFile = Join-Path $Target '.academy-install'
if ($TargetIsOurs -and (Test-Path $RecordFile)) {
  $recText = [System.IO.File]::ReadAllText($RecordFile, $Utf8)
  $Added = RecordValue $recText 'added_row'; if (-not $Added) { $Added = '1' }
  $Prev = RecordValue $recText 'previous_plugin'
  $Created = RecordValue $recText 'created_patch'; if (-not $Created) { $Created = '0' }
} elseif ($TargetIsOurs) {
  # 旧版（没有安装记录）升级：从旧的「安装前」备份里找装皮肤之前的原状——从新到旧，
  # 跳过里面是本皮肤的（那是以前升级时留的），第一份就是这次这一串安装开始前的样子
  $Orig = $null
  if (Test-Path $BackupRoot) {
    foreach ($d in (Get-ChildItem $BackupRoot -Directory | Where-Object { $_.Name -like '*-安装前*' } | Sort-Object Name -Descending)) {
      if ($d.FullName -eq $Backup) { continue }
      $old = Join-Path $d.FullName 'dsh-logo'
      if ((Test-Path $old) -and (IsOurPlugin $old)) { continue }
      $Orig = $d.FullName; break
    }
  }
  if ($Orig) {
    Write-Host "旧版没有安装记录，按装皮肤之前的备份推断：$Orig"
    $Prev = if (Test-Path (Join-Path $Orig 'dsh-logo')) { Join-Path $Orig 'dsh-logo' } else { '' }
    $origPatch = Join-Path $Orig 'cordis.patch.yml'
    if (Test-Path $origPatch) {
      $Created = '0'
      $Added = if ([System.IO.File]::ReadAllText($origPatch, $Utf8) -match $OurRowPattern) { '0' } else { '1' }
    } else { $Created = '1'; $Added = '1' }
  } else {
    $Added = '1'; $Prev = ''; $Created = '0'   # 找不到备份：按老版本的做法（加载项是当时加的），配置文件不删
  }
} else {
  $Added = '0'
  $Prev = if ($TargetExisted) { Join-Path $Backup 'dsh-logo' } else { '' }
  $Created = if ($PatchExisted) { '0' } else { '1' }
}
if (-not $RowExisted) { $Added = '1' }   # 这次要新加加载项

# 备份必须成功才继续：任何一步复制失败（磁盘满、没权限）都停下，不动原文件
try {
  New-Item -ItemType Directory -Force -Path $Backup | Out-Null
  if ($PatchExisted) { Copy-Item $Patch (Join-Path $Backup 'cordis.patch.yml') }
  if ($TargetExisted) { Copy-Item $Target (Join-Path $Backup 'dsh-logo') -Recurse }
} catch { Fail "备份失败，没有做任何改动：$($_.Exception.Message)" }
Write-Host "已备份原来的设置到：$Backup"

# 新插件连同安装记录先放进临时目录，全部成功后再一步换上去；中途失败什么都不改
$Stage = Join-Path (Split-Path $Target -Parent) ".dsh-logo-staging-$PID"
try {
  if (Test-Path $Stage) { Remove-Item $Stage -Recurse -Force }
  New-Item -ItemType Directory -Force -Path $Stage | Out-Null
  Copy-Item (Join-Path $Src 'package.json'), (Join-Path $Src 'index.js') $Stage
  Copy-Item (Join-Path $Src 'dist') $Stage -Recurse
  [System.IO.File]::WriteAllText((Join-Path $Stage '.academy-install'), "added_row=$Added`nprevious_plugin=$Prev`ncreated_patch=$Created`n", $Utf8)
} catch {
  if (Test-Path $Stage) { Remove-Item $Stage -Recurse -Force -ErrorAction SilentlyContinue }
  Fail "准备插件文件失败，没有做任何改动：$($_.Exception.Message)"
}
# 换上新插件；改配置失败时把插件撤回到安装前的样子
function RestoreOldPlugin {
  if (Test-Path $Target) { Remove-Item $Target -Recurse -Force -ErrorAction SilentlyContinue }
  $old = Join-Path $Backup 'dsh-logo'
  if (Test-Path $old) { Copy-Item $old $Target -Recurse }
}
try {
  if (Test-Path $Target) { Remove-Item $Target -Recurse -Force }
  Move-Item $Stage $Target
} catch {
  if (Test-Path $Stage) { Remove-Item $Stage -Recurse -Force -ErrorAction SilentlyContinue }
  RestoreOldPlugin
  Fail "替换插件文件失败，已恢复原来的插件：$($_.Exception.Message)"
}

if ($RowExisted) {
  Write-Host '插件加载项已存在，不重复添加。'
} else {
  # 和 Mac 版脚本、tools/install.mjs 写的是同样的四行（换行用 \n）
  $block = "`n# Local logo override. Added by dsh-logo/tools/install.mjs; remove with --revert.`n- insert:`n    - id: local-dsh-logo`n      name: ./node_modules/@local/dsh-logo/index.js`n"
  try { [System.IO.File]::AppendAllText($Patch, $block, $Utf8) } catch {
    RestoreOldPlugin
    Fail "写入 $Patch 失败，已把插件恢复成安装前的样子：$($_.Exception.Message)"
  }
  Write-Host '已添加插件加载项。'
}
if ($Prev) { Write-Host "安装前这里有另一个插件，已备份到 $Prev，卸载时会放回去。" }

Write-Host ''
Write-Host '[完成] 安装完成。DeepSeek Harness 只在启动时加载插件：请完全退出它（关闭所有窗口；如果任务栏右下角托盘里还有图标，右键退出），再重新打开。' -ForegroundColor Green
