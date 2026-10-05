# 「星海书院」皮肤一键卸载（Windows）。由「卸载-Windows.bat」调用。
# 删除插件文件，并只去掉 cordis.patch.yml 里安装时追加的那几行；改动前同样先备份。

$ErrorActionPreference = 'Stop'
$DshHome = if ($env:DSH_HOME) { $env:DSH_HOME } else { Join-Path $env:USERPROFILE '.dsh' }
$ProfileDir = if ($env:DSH_PROFILE_DIR) { $env:DSH_PROFILE_DIR } else { Join-Path $DshHome 'profiles\desktop' }
$Patch = Join-Path $ProfileDir 'cordis.patch.yml'
$Target = Join-Path $ProfileDir 'node_modules\@local\dsh-logo'
$BackupRoot = if ($env:DSH_SKIN_BACKUP_DIR) { $env:DSH_SKIN_BACKUP_DIR } else { Join-Path $DshHome 'academy-skin-backup' }
$Backup = Join-Path $BackupRoot ((Get-Date -Format 'yyyyMMdd-HHmmss') + '-卸载前')
$Utf8 = New-Object System.Text.UTF8Encoding($false)

function Fail($msg) { Write-Host ''; Write-Host "[错误] $msg" -ForegroundColor Red; Write-Host ''; exit 1 }

Write-Host '== 星海书院皮肤 · 卸载 =='
$text = if (Test-Path $Patch) { [System.IO.File]::ReadAllText($Patch, $Utf8) } else { '' }
if (-not (Test-Path $Target) -and ($text -notmatch '(?m)^[ \t]*- id: local-dsh-logo[ \t]*\r?$')) {
  Write-Host '没有发现已安装的皮肤，不需要卸载。'
  exit 0
}

# 同一个路径 @local/dsh-logo 以前也被别的本地 logo 插件用过：不是本皮肤就不删
if (Test-Path $Target) {
  $pkgJson = Join-Path $Target 'package.json'
  $isOurs = (Test-Path $pkgJson) -and ([System.IO.File]::ReadAllText($pkgJson, $Utf8) -match 'anime-academy skin')
  if (-not $isOurs) { Fail "$Target 不是星海书院皮肤（package.json 里没有 anime-academy skin），为安全起见没有删除。如确定要删，请手动处理。" }
}
try {
  New-Item -ItemType Directory -Force -Path $Backup | Out-Null
  if (Test-Path $Patch) { Copy-Item $Patch (Join-Path $Backup 'cordis.patch.yml') }
  if (Test-Path $Target) { Copy-Item $Target (Join-Path $Backup 'dsh-logo') -Recurse }
} catch { Fail "备份失败：$($_.Exception.Message)" }
Write-Host "已备份当前设置到：$Backup"

try { if (Test-Path $Target) { Remove-Item $Target -Recurse -Force } } catch { Fail "删除插件文件失败：$($_.Exception.Message)" }
if (Test-Path $Patch) {
  # 只去掉安装时追加的：前面一个换行 + 注释行（可能没有）+ - insert: / id / name 三行；兼容 \r\n
  $pattern = '\r?\n?(?:# Local logo override[^\r\n]*\r?\n)?- insert:\r?\n[ \t]+- id: local-dsh-logo\r?\n[ \t]+name: [^\r\n]*(?:\r?\n|$)'
  $new = [regex]::Replace($text, $pattern, '')
  try { [System.IO.File]::WriteAllText($Patch, $new, $Utf8) } catch { Fail "修改 $Patch 失败：$($_.Exception.Message)" }
}

Write-Host ''
Write-Host '[完成] 已卸载。完全退出 DeepSeek Harness 再打开，就回到原版界面。' -ForegroundColor Green
