param(
  [string]$OutputDirectory = (Join-Path $PSScriptRoot "dist")
)

$ErrorActionPreference = "Stop"
$projectRoot = (Resolve-Path -LiteralPath $PSScriptRoot).Path

if (-not (Test-Path -LiteralPath $OutputDirectory)) {
  New-Item -ItemType Directory -Path $OutputDirectory | Out-Null
}
$outputRoot = (Resolve-Path -LiteralPath $OutputDirectory).Path

$stagingRoot = Join-Path $env:TEMP ("wx-shot-build-" + [guid]::NewGuid().ToString("N"))
$universalRoot = Join-Path $stagingRoot "universal"

try {
  New-Item -ItemType Directory -Path $universalRoot | Out-Null
  Copy-Item -LiteralPath (Join-Path $projectRoot "src") -Destination $universalRoot -Recurse
  Copy-Item -LiteralPath (Join-Path $projectRoot "assets") -Destination $universalRoot -Recurse
  Copy-Item -LiteralPath (Join-Path $projectRoot "tools") -Destination $universalRoot -Recurse
  Copy-Item -LiteralPath (Join-Path $projectRoot "manifest.json") -Destination $universalRoot
  Copy-Item -LiteralPath (Join-Path $projectRoot "README.md") -Destination $universalRoot
  Copy-Item -LiteralPath (Join-Path $projectRoot "KURULUM.md") -Destination $universalRoot
  Copy-Item -LiteralPath (Join-Path $projectRoot "LICENSE") -Destination $universalRoot
  Copy-Item -LiteralPath (Join-Path $projectRoot "build.ps1") -Destination $universalRoot

  $archives = @{
    "WX-Shot-Universal-v1.2.0.zip" = $universalRoot
  }

  foreach ($archive in $archives.GetEnumerator()) {
    $target = Join-Path $outputRoot $archive.Key
    if (Test-Path -LiteralPath $target) {
      Remove-Item -LiteralPath $target -Force
    }
    Compress-Archive -Path (Join-Path $archive.Value "*") -DestinationPath $target -CompressionLevel Optimal
    Write-Host "Created $target"
  }
}
finally {
  if (Test-Path -LiteralPath $stagingRoot) {
    Remove-Item -LiteralPath $stagingRoot -Recurse -Force
  }
}
