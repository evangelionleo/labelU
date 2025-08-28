param(
  [Parameter(Mandatory=$true)]
  [string]$CondaEnvName,
  [string]$ProjectDir = (Get-Location).Path,
  [string]$WinVenvPath = ".venv-windows",
  [string]$WslVenvPath = ".venv-linux",
  [string]$WslDistro = "",
  [switch]$UseExistingRequirements
)

function Write-Info($msg) { Write-Host "[INFO] $msg" -ForegroundColor Cyan }
function Write-Warn($msg) { Write-Host "[WARN] $msg" -ForegroundColor Yellow }
function Write-Err($msg)  { Write-Host "[ERR ] $msg" -ForegroundColor Red }

# 0) Relax execution policy for current user (best effort)
try {
  Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser -Force -ErrorAction Stop
  Write-Info "ExecutionPolicy set to RemoteSigned for CurrentUser"
} catch {
  Write-Warn ("Set-ExecutionPolicy failed: " + $_.Exception.Message)
}

function Convert-ToWslPath([string]$winPath) {
  $full = (Resolve-Path $winPath).Path
  $drive = $full.Substring(0,1).ToLower()
  $rest  = $full.Substring(2) -replace '\\','/'
  if ($rest.StartsWith('/')) { $rest = $rest.Substring(1) }
  return "/mnt/$drive/$rest"
}

# 1) Paths
$ProjectDir = (Resolve-Path $ProjectDir).Path
$ReqFileWin = Join-Path $ProjectDir "requirements.txt"
$WslProject = Convert-ToWslPath $ProjectDir
$WinVenvAbs = Join-Path $ProjectDir $WinVenvPath
${ReqSanWin} = Join-Path $ProjectDir "requirements.sanitized.txt"
${ReqSanWsl} = Join-Path $ProjectDir "requirements.sanitized.wsl.txt"

Write-Info "ProjectDir: $ProjectDir"
Write-Info "WSL Project: $WslProject"

# 2) requirements.txt
if ($UseExistingRequirements) {
  if (-not (Test-Path $ReqFileWin)) {
    Write-Err "requirements.txt not found and -UseExistingRequirements specified"
    exit 1
  }
  Write-Info "Using existing requirements.txt"
} else {
  Write-Info "Exporting pip dependencies from conda env: $CondaEnvName"
  $conda = (Get-Command conda -ErrorAction SilentlyContinue)
  if (-not $conda) {
    Write-Err "conda command not found. Run in Anaconda Prompt or add conda to PATH."
    exit 1
  }
  $freeze = conda run -n $CondaEnvName python -m pip freeze --all 2>&1
  if ($LASTEXITCODE -ne 0) {
    Write-Err ("conda run failed:\n" + ($freeze | Out-String))
    exit 1
  }
  # sanitize: drop pip/setuptools/wheel and local file URLs from conda build cache
  $clean = $freeze | Where-Object {
    ($_ -notmatch '^(pip|setuptools|wheel)==') -and
    ($_ -notmatch '\s@\s+file://') -and
    ($_ -notmatch '^\s*$')
  }
  $clean | Out-File -Encoding ASCII $ReqFileWin
  Write-Info "Wrote sanitized requirements to $ReqFileWin"
}

# 2.5) Create a sanitized requirements file for venv installation
try {
  $lines = Get-Content -Path $ReqFileWin -Encoding UTF8
} catch {
  Write-Err ("Failed to read {0}: {1}" -f $ReqFileWin, $_.Exception.Message)
  exit 1
}

$filtered = $lines | Where-Object {
  $line = ($_ | Out-String).Trim()
  if ($line -eq "") { return $false }
  if ($line -like "#*") { return $false }
  if ($line -match '^(pip|setuptools|wheel)(\s|==|>=|<=|~=|!=|<|>|$)') { return $false }
  if ($line -match '\\s@\\s*file://') { return $false }
  if ($line -match '^[A-Za-z]:\\\\') { return $false }
  if ($line -match '\\bcroot\\b') { return $false }
  return $true
}

$filtered | Out-File -Encoding ASCII $ReqSanWin
Write-Info "Prepared sanitized requirements for install: $ReqSanWin"

# Detect WSL python version to adjust platform-specific pins if needed
$WslPyVer = ""
try {
  $WslPyVer = Invoke-WSL 'python3 -V 2>&1 | awk "{print $2}"'
} catch {
  $WslPyVer = ""
}
if ($null -ne $WslPyVer) { $WslPyVer = ($WslPyVer | Out-String).Trim() } else { $WslPyVer = "" }
if ($WslPyVer -eq "") { Write-Info "WSL python version detected: unknown" } else { Write-Info ("WSL python version detected: {0}" -f $WslPyVer) }

# Prepare WSL-specific sanitized requirements file
Copy-Item -Path $ReqSanWin -Destination $ReqSanWsl -Force
if ($WslPyVer -ne "") {
  $parts = $WslPyVer.Split('.')
  if ($parts.Length -ge 2) {
    $major = 0; $minor = 0
    [void][int]::TryParse($parts[0], [ref]$major)
    [void][int]::TryParse($parts[1], [ref]$minor)
    if ($major -eq 3 -and $minor -lt 11) {
      # numpy>=2.3 requires Python>=3.11; downgrade to a compatible version for py310
      (Get-Content $ReqSanWsl) |
        ForEach-Object { $_ -replace '^numpy==.*$', 'numpy==2.2.6' } |
        Out-File -Encoding ASCII $ReqSanWsl
      Write-Warn "Adjusted numpy pin to 2.2.6 for WSL (Python < 3.11)"
    }
  }
}

# 3) Windows venv
Write-Info "Creating Windows venv: $WinVenvPath"
$pythonWin = (Get-Command py -ErrorAction SilentlyContinue)
if ($pythonWin) { $pyCmd = "py -3" } else { $pyCmd = "python" }

& cmd /c "$pyCmd -m venv `"$WinVenvAbs`""
if ($LASTEXITCODE -ne 0) { Write-Err "Failed to create Windows venv"; exit 1 }

$WinPy = Join-Path $WinVenvAbs "Scripts\python.exe"
if (-not (Test-Path $WinPy)) { Write-Err "Windows python not found: $WinPy"; exit 1 }

& $WinPy -m pip install -U pip setuptools wheel
if ($LASTEXITCODE -ne 0) { Write-Err "Failed to upgrade pip on Windows venv"; exit 1 }
& $WinPy -m pip install -r $ReqSanWin
if ($LASTEXITCODE -ne 0) { Write-Warn "Some deps failed to install on Windows venv; check for conda-only packages" }

# 4) WSL venv
Write-Info "Creating WSL/Linux venv: $WslVenvPath"
$WslVenvAbs = if ($WslVenvPath.StartsWith("/")) { $WslVenvPath } else { "$WslProject/$WslVenvPath" }
$WslReq = (Convert-ToWslPath $ReqSanWsl)

function Invoke-WSL($cmd) {
  if ($WslDistro -and $WslDistro.Trim() -ne "") {
    wsl.exe -d $WslDistro bash -lc "$cmd"
  } else {
    wsl.exe bash -lc "$cmd"
  }
}

# Ensure python3-venv exists on Debian/Ubuntu-like distros, then create venv
Invoke-WSL "set -e; if ! command -v python3 >/dev/null 2>&1; then echo 'python3 not found in WSL'; exit 1; fi; if ! python3 -m venv -h >/dev/null 2>&1; then if command -v apt-get >/dev/null 2>&1; then (sudo -n apt-get update || true) && (sudo -n apt-get install -y python3-venv || true); fi; fi"
if ($LASTEXITCODE -ne 0) { Write-Err "Failed to prepare python3-venv in WSL"; exit 1 }

# Use simple one-line commands to avoid here-string parsing issues
Invoke-WSL "cd '$WslProject' && python3 -m venv --clear '$WslVenvAbs'"
if ($LASTEXITCODE -ne 0) { Write-Err "Failed to create WSL venv"; exit 1 }

Invoke-WSL "'$WslVenvAbs/bin/python' -m pip install -U pip setuptools wheel"
if ($LASTEXITCODE -ne 0) { Write-Warn "Failed to upgrade pip in WSL venv" }

Invoke-WSL "'$WslVenvAbs/bin/python' -m pip install -r '$WslReq'"
if ($LASTEXITCODE -ne 0) { Write-Warn "Some deps failed to install in WSL venv; check for conda-only packages" }

Write-Host ""
Write-Info "Done. Activate with:"
Write-Host ("Windows: `"{0}\Scripts\Activate.ps1`"" -f $WinVenvAbs)
Write-Host ("WSL:     source '{0}/bin/activate'" -f $WslVenvAbs)
Write-Host ""
Write-Warn "If dependencies are conda-only or need system libs, consider conda-pack or PyPI equivalents."


