<#
.SYNOPSIS
  Package the WordPress plugin into public/downloads/ so the in-app updater can serve it.

.DESCRIPTION
  Zips wordpress-plugin/ into public/downloads/surfer-plugin.zip with a top-level
  "surferseo/" folder (matching the installed plugin slug), and rewrites
  public/downloads/wp-plugin.json. When -Version is given it also bumps the
  plugin's Version: header and the SURFER_VERSION constant, so WordPress sites
  see the new version on their next update check.

.EXAMPLE
  ./scripts/release-wp-plugin.ps1
  # Repackage the current version (no bump).

.EXAMPLE
  ./scripts/release-wp-plugin.ps1 -Version 1.7.1.0 -Changelog "<h4>1.7.1.0</h4><ul><li>Fix sync.</li></ul>"
  # Bump to 1.7.1.0 and ship it.
#>
param(
  [string]$Version,
  [string]$Changelog
)

$ErrorActionPreference = 'Stop'

$root      = Split-Path -Parent $PSScriptRoot
$pluginDir = Join-Path $root 'wordpress-plugin'
$mainFile  = Join-Path $pluginDir 'surferseo.php'
$outDir    = Join-Path $root 'public\downloads'
$manifest  = Join-Path $outDir 'wp-plugin.json'
$zipPath   = Join-Path $outDir 'surfer-plugin.zip'
$slug      = 'surferseo'

if (-not (Test-Path $pluginDir)) { throw "Plugin dir not found: $pluginDir" }
if (-not (Test-Path $outDir))    { New-Item -ItemType Directory -Force -Path $outDir | Out-Null }

# Optional version bump: rewrite the header + constant in the main plugin file.
if ($Version) {
  $php = Get-Content -Raw -Encoding UTF8 $mainFile
  $php = $php -replace '(\*\s*Version:\s*)[\d.]+', "`${1}$Version"
  $php = $php -replace "(define\(\s*'SURFER_VERSION',\s*')[\d.]+(')", "`${1}$Version`${2}"
  Set-Content -Encoding UTF8 -NoNewline $mainFile $php
  Write-Host "Bumped plugin version to $Version"
}

# Read the version we're shipping straight from the source of truth.
$php = Get-Content -Raw -Encoding UTF8 $mainFile
if ($php -match "define\(\s*'SURFER_VERSION',\s*'([\d.]+)'") { $shipVersion = $Matches[1] }
else { throw "Could not read SURFER_VERSION from $mainFile" }

# Build the zip manually so entry paths use forward slashes and a "surferseo/" root.
# PowerShell's Compress-Archive writes backslash separators, which WordPress' unzip
# on Linux mis-reads as literal filenames ("surferseo\templates"), breaking install.
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
if (Test-Path $zipPath) { Remove-Item -Force $zipPath }

$files = Get-ChildItem -Recurse -File -Path $pluginDir
$zip = [System.IO.Compression.ZipFile]::Open($zipPath, [System.IO.Compression.ZipArchiveMode]::Create)
try {
  foreach ($f in $files) {
    $rel = $f.FullName.Substring($pluginDir.Length).TrimStart('\', '/').Replace('\', '/')
    $entryName = "$slug/$rel"
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $f.FullName, $entryName) | Out-Null
  }
} finally {
  $zip.Dispose()
}

# Refresh the manifest the updater polls.
$info = Get-Content -Raw -Encoding UTF8 $manifest | ConvertFrom-Json
$info.version = $shipVersion
if ($Changelog) { $info.changelog = $Changelog }
$info | ConvertTo-Json -Depth 5 | Set-Content -Encoding UTF8 $manifest

Write-Host "Packaged $slug $shipVersion -> $zipPath"
Write-Host "Manifest updated: $manifest"
