<#
.SYNOPSIS
  Ejecuta toda la suite: pytest (backend) y Playwright E2E (frontend).

.DESCRIPTION
  Debe lanzarse desde la raíz del repositorio (o cualquier cwd: el script cambia a la raíz).
  Requiere POSTGRES_TEST_URL (o en .env) para pytest.
  Los E2E necesitan la API en marcha (p. ej. 127.0.0.1:8000) y Playwright levantará Vite si hace falta.

.PARAMETER Quiet
  Pasa -Quiet a pytest (salida reducida).

.PARAMETER SkipE2E
  Solo ejecuta pytest.

.PARAMETER SkipBackend
  Solo ejecuta npm run test:e2e en frontend (no valida POSTGRES_TEST_URL aquí).
#>
param(
  [switch]$Quiet,
  [switch]$SkipE2E,
  [switch]$SkipBackend
)

$ErrorActionPreference = "Stop"

if ($SkipE2E -and $SkipBackend) {
  Write-Host "Nada que ejecutar: no uses -SkipE2E y -SkipBackend a la vez." -ForegroundColor Yellow
  exit 1
}

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $RepoRoot

if (-not $SkipBackend) {
  $testScript = Join-Path $PSScriptRoot "test.ps1"
  if ($Quiet) {
    & $testScript -Quiet
  } else {
    & $testScript
  }
  if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
  }
  Write-Host "`n--- Backend (pytest) OK ---`n" -ForegroundColor Green
}

if (-not $SkipE2E) {
  if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Host "No se encontró npm; no se pueden ejecutar los E2E de Playwright." -ForegroundColor Yellow
    exit 1
  }

  Write-Host "E2E Playwright: asegúrate de que la API responde (p. ej. uvicorn en :8000).`n" -ForegroundColor Cyan

  $frontend = Join-Path $RepoRoot "frontend"
  if (-not (Test-Path $frontend)) {
    Write-Host "No existe la carpeta frontend/" -ForegroundColor Red
    exit 1
  }

  Push-Location $frontend
  try {
    npm run test:e2e
    if ($LASTEXITCODE -ne 0) {
      exit $LASTEXITCODE
    }
  } finally {
    Pop-Location
  }

  Write-Host "`n--- Frontend E2E (Playwright) OK ---`n" -ForegroundColor Green
}

Write-Host "Todas las suites solicitadas terminaron correctamente." -ForegroundColor Green
