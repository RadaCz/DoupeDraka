# Sprint 28 — pytest runners (Windows PowerShell).
# Usage:
#   .\scripts\run_tests.ps1 fast       # default diagnostic layer (no slow sims)
#   .\scripts\run_tests.ps1 diagnose  # fail-fast after first failure
#   .\scripts\run_tests.ps1 regress   # sprint gameplay contract files
#   .\scripts\run_tests.ps1 full      # entire suite incl. slow
#   .\scripts\run_tests.ps1 slow      # only slow layer
param(
    [Parameter(Position = 0)]
    [ValidateSet("fast", "diagnose", "regress", "full", "slow")]
    [string]$Mode = "fast"
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

$python = if (Test-Path ".\.venv\Scripts\python.exe") { ".\.venv\Scripts\python.exe" } else { "python" }

New-Item -ItemType Directory -Force -Path ".\reports" | Out-Null
$junit = "reports\junit-$Mode.xml"
$env:DOUPE_JUNIT = $junit

$common = @("-m", "pytest", "-q", "--junitxml=$junit")

switch ($Mode) {
    "fast" {
        & $python @common -m "not slow"
    }
    "diagnose" {
        & $python @common -m "not slow" -x --maxfail=1
    }
    "regress" {
        & $python @common -m "regress"
    }
    "slow" {
        & $python @common -m "slow"
    }
    "full" {
        & $python @common
    }
}

$code = $LASTEXITCODE
Write-Host "JUnit: $junit (exit $code)"
exit $code
