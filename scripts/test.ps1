param(
  [switch]$Quiet
)

$ErrorActionPreference = "Stop"

function Import-DotEnvIfNeeded {
  param([string]$Path = ".env")

  if ($env:POSTGRES_TEST_URL) { return }
  if (-not (Test-Path $Path)) { return }

  Get-Content $Path | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith("#")) { return }
    $idx = $line.IndexOf("=")
    if ($idx -lt 1) { return }
    $key = $line.Substring(0, $idx).Trim()
    $val = $line.Substring($idx + 1).Trim()
    # Quitar comillas simples/dobles si existen
    if (($val.StartsWith("'") -and $val.EndsWith("'")) -or ($val.StartsWith('"') -and $val.EndsWith('"'))) {
      $val = $val.Substring(1, $val.Length - 2)
    }
    if ($key -eq "POSTGRES_TEST_URL" -and -not $env:POSTGRES_TEST_URL) {
      $env:POSTGRES_TEST_URL = $val
    }
  }
}

Import-DotEnvIfNeeded

if (-not $env:POSTGRES_TEST_URL) {
  Write-Host "Falta POSTGRES_TEST_URL. Ejemplo:" -ForegroundColor Yellow
  Write-Host "  `$env:POSTGRES_TEST_URL='postgresql+psycopg://user:pass@host:5432/db_test'" -ForegroundColor Yellow
  exit 1
}

if (-not (Test-Path ".venv\Scripts\python.exe")) {
  Write-Host "No encuentro .venv. Crea el venv e instala requirements-dev.txt" -ForegroundColor Yellow
  exit 1
}

# Preflight: validar conexión a la BD de tests (y que exista)
& .\.venv\Scripts\python.exe -c "import os; from sqlalchemy import create_engine, text; url=os.getenv('POSTGRES_TEST_URL'); eng=create_engine(url, connect_args={'connect_timeout':5}, pool_pre_ping=True); 
try:
  with eng.connect() as c: c.execute(text('select 1')).scalar()
  print('OK: POSTGRES_TEST_URL accesible')
except Exception as e:
  print('ERROR: no se pudo conectar a POSTGRES_TEST_URL'); print(e); raise SystemExit(2)
"
if ($LASTEXITCODE -ne 0) {
  Write-Host "`nAsegúrate de que existe la BD de tests y no es la de producción/dev." -ForegroundColor Yellow
  Write-Host "Ejemplo (en Postgres): CREATE DATABASE tfg_test OWNER tfg;" -ForegroundColor Yellow
  exit $LASTEXITCODE
}

$argsPytest = @("-m", "pytest")
if ($Quiet) {
  $argsPytest += @("-q")
}

& .\.venv\Scripts\python.exe @argsPytest
