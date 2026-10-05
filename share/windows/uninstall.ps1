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
# 加载项：ID 是 local-dsh-logo 且路径是本皮肤的，才算「本皮肤的那一条」（兼容 \r\n）
$OurRowPattern = '(?m)^[ \t]*- id: local-dsh-logo[ \t]*\r?\n[ \t]+name: \./node_modules/@local/dsh-logo/index\.js[ \t]*\r?$'
$AnyRowPattern = '(?m)^[ \t]*- id: local-dsh-logo[ \t]*\r?$'

Write-Host '== 星海书院皮肤 · 卸载 =='
$text = if (Test-Path $Patch) { [System.IO.File]::ReadAllText($Patch, $Utf8) } else { '' }
if (-not (Test-Path $Target) -and ($text -notmatch $OurRowPattern)) {
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

# 先改配置、确认成功再删插件：配置写不进去时插件还在，不会出现「加载项还在、插件没了」的半卸载状态
if (Test-Path $Patch) {
  # 只去掉安装时追加的：前面一个换行 + 注释行（可能没有）+ - insert: / id / name 三行，且 name 必须是本皮肤的路径；兼容 \r\n
  $pattern = '\r?\n?(?:# Local logo override[^\r\n]*\r?\n)?- insert:\r?\n[ \t]+- id: local-dsh-logo[ \t]*\r?\n[ \t]+name: \./node_modules/@local/dsh-logo/index\.js[ \t]*(?:\r?\n|$)'
  $new = [regex]::Replace($text, $pattern, '')
  # 原文件开头有 UTF-8 BOM 就照样写回带 BOM 的，没有就不带：文件其余部分保持原样
  $bytes = [System.IO.File]::ReadAllBytes($Patch)
  $hasBom = ($bytes.Length -ge 3) -and ($bytes[0] -eq 0xEF) -and ($bytes[1] -eq 0xBB) -and ($bytes[2] -eq 0xBF)
  $enc = New-Object System.Text.UTF8Encoding($hasBom)
  try { [System.IO.File]::WriteAllText($Patch, $new, $enc) } catch { Fail "修改 $Patch 失败，插件文件没有删除。备份在 $Backup" }
}
try { if (Test-Path $Target) { Remove-Item $Target -Recurse -Force } } catch { Fail "删除插件文件失败：$($_.Exception.Message)" }

Write-Host ''
Write-Host '[完成] 已卸载。完全退出 DeepSeek Harness 再打开，就回到原版界面。' -ForegroundColor Green
