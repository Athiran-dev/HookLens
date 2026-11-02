# Cross-compile the CLI into dist\.  Usage: scripts\build-cli.ps1 -Server https://your-host -Version 0.1.0
param([string]$Server = "http://localhost:8080", [string]$Version = "dev")
$ErrorActionPreference = "Stop"
New-Item -ItemType Directory -Force dist | Out-Null
foreach ($t in "linux/amd64","linux/arm64","darwin/amd64","darwin/arm64","windows/amd64") {
  $os,$arch = $t.Split("/"); $ext = if ($os -eq "windows") { ".exe" } else { "" }
  $env:CGO_ENABLED = "0"; $env:GOOS = $os; $env:GOARCH = $arch
  go build -trimpath -ldflags "-s -w -X main.version=$Version -X main.defaultServer=$Server" -o "dist\hooklens-$os-$arch$ext" ./cmd/hooklens
  Write-Host "built dist\hooklens-$os-$arch$ext"
}
Remove-Item Env:GOOS, Env:GOARCH, Env:CGO_ENABLED
