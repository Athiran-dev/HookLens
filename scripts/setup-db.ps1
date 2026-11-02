<#
  One-time local database setup for HookLens.
  Creates a dedicated `hooklens` role plus `hooklens` and `hooklens_test` databases, then writes .env.
  Your Postgres superuser password is typed into THIS terminal only; it is never stored.

  Usage (from the repo root):   powershell -ExecutionPolicy Bypass -File scripts\setup-db.ps1
  Options: -Port 5432   -PgUser postgres
#>
param([int]$Port = 5432, [string]$PgUser = "postgres")
$ErrorActionPreference = "Stop"

$psql = Get-ChildItem "C:\Program Files\PostgreSQL\*\bin\psql.exe" -ErrorAction SilentlyContinue |
        Sort-Object FullName -Descending | Select-Object -First 1
if (-not $psql) { throw "psql.exe not found under C:\Program Files\PostgreSQL" }

$secure = Read-Host "Password for Postgres user '$PgUser' (port $Port)" -AsSecureString
$env:PGPASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))

function Psql([string]$sql) {
    $out = & $psql.FullName -h localhost -p $Port -U $PgUser -d postgres -v ON_ERROR_STOP=1 -tA -c $sql 2>&1
    if ($LASTEXITCODE -ne 0) { throw "Postgres rejected the command (port $Port, user $PgUser): $out" }
    $out
}

Psql "select 1" | Out-Null   # fails fast on a wrong password

$chars = (48..57) + (65..90) + (97..122)
$appPw = -join ($chars | Get-Random -Count 28 | ForEach-Object { [char]$_ })

Psql "DO `$`$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='hooklens') THEN CREATE ROLE hooklens LOGIN; END IF; END `$`$;" | Out-Null
Psql "ALTER ROLE hooklens WITH LOGIN PASSWORD '$appPw'" | Out-Null
foreach ($db in "hooklens", "hooklens_test") {
    if (-not (Psql "SELECT 1 FROM pg_database WHERE datname='$db'")) { Psql "CREATE DATABASE $db OWNER hooklens" | Out-Null }
}

$root = Split-Path $PSScriptRoot -Parent
$envText = Get-Content (Join-Path $root ".env.example") -Raw
$envText = $envText -replace "DATABASE_URL=.*", "DATABASE_URL=postgres://hooklens:$appPw@localhost:$Port/hooklens?sslmode=disable"
$envText += "`nTEST_DATABASE_URL=postgres://hooklens:$appPw@localhost:$Port/hooklens_test?sslmode=disable`n"
Set-Content -Path (Join-Path $root ".env") -Value $envText -Encoding ascii
Remove-Item Env:PGPASSWORD

Write-Host "Done. Created databases hooklens and hooklens_test and wrote .env (git-ignored)." -ForegroundColor Green
