param(
  [Parameter(Mandatory=$true)]
  [string]$CondaEnvName,
  [string]$ProjectDir = (Get-Location).Path,
  [string]$OutputDir = "offline",
  [switch]$UseExistingRequirements
)

function Write-Info($msg) { Write-Host "[INFO] $msg" -ForegroundColor Cyan }
function Write-Warn($msg) { Write-Host "[WARN] $msg" -ForegroundColor Yellow }
function Write-Err($msg)  { Write-Host "[ERR ] $msg" -ForegroundColor Red }

try { Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser -Force -ErrorAction Stop } catch { Write-Warn ("Set-ExecutionPolicy failed: " + $_.Exception.Message) }

function Convert-ToWslPath([string]$winPath) {
  $p = $winPath
  if (Test-Path $winPath) { $p = (Resolve-Path $winPath).Path }
  if ($p -match '^[A-Za-z]:') {
    $drive = $p.Substring(0,1).ToLower()
    $rest  = $p.Substring(2) -replace '\\','/'
    if ($rest.StartsWith('/')) { $rest = $rest.Substring(1) }
    return "/mnt/$drive/$rest"
  } else {
    return ($p -replace '\\','/')
  }
}

function Invoke-WSL($cmd) { wsl.exe bash -lc "$cmd" }

function Test-WheelTagsMatch {
  param(
    [string]$WheelsDir,
    [string]$PyVer,
    [string]$PlatformName
  )
  if (-not (Test-Path $WheelsDir)) { return $true }
  $parts = $PyVer.Split('.')
  $maj = 0; $min = 0
  [void][int]::TryParse($parts[0], [ref]$maj)
  [void][int]::TryParse($parts[1], [ref]$min)
  $cpTag = "cp{0}{1}" -f $maj, $min

  $bad = @()
  Get-ChildItem -Path $WheelsDir -Filter "*.whl" -File -ErrorAction SilentlyContinue | ForEach-Object {
    $name = $_.Name
    $lower = $name.ToLower()
    $isAny = $lower -match "-py3-none-any\.whl$"
    $hasCp = $lower -match ("-" + $cpTag)
    $isAbi3 = $lower -match "-abi3-"
    if (-not ($isAny -or $hasCp -or $isAbi3)) { $bad += $name }
  }
  if ($bad.Count -gt 0) {
    Write-Err ("Detected wheel tag/version mismatch for {0}:" -f $PlatformName)
    $bad | ForEach-Object { Write-Host ("  - " + $_) }
    Write-Host "Expected python tag: $cpTag (pure 'py3-none-any' also allowed, as well as '*-abi3-*')"
    Write-Host ""
    Write-Warn "Fix guidance:"
    if ($PlatformName -eq "Windows") {
      Write-Host ("  1) Install Python {0} on target/build machine: winget install Python.Python.{0}" -f $PyVer)
      Write-Host   "  2) Recreate venv (target): py -$PyVer -m venv .venv && .\\.venv\\Scripts\\Activate.ps1"
      Write-Host   "  3) Rebuild wheels with this script (it uses conda env's Python minor)"
    } else {
      Write-Host ("  1) In WSL, install python{0} and venv: sudo apt-get update && sudo apt-get install -y python{0} python{0}-venv" -f $PyVer)
      Write-Host   "  2) Rebuild wheels with this script"
      Write-Host ("  3) On target Linux, create venv with python{0}: python{0} -m venv .venv" -f $PyVer)
    }
    return $false
  }
  return $true
}

# Normalize paths
$ProjectDir = (Resolve-Path $ProjectDir).Path
$SafeEnvName = ($CondaEnvName -replace '[\/:*?"<>| ]','_')
$OutFolderName = "$SafeEnvName-$OutputDir"
$OutRoot    = Join-Path $ProjectDir $OutFolderName
$WinWheels  = Join-Path $OutRoot "wheels-win"
$LinWheels  = Join-Path $OutRoot "wheels-linux"
$DistDir    = Join-Path $OutRoot "dist"
$PyWinDir   = Join-Path $OutRoot "python-windows"
$PyLinDir   = Join-Path $OutRoot "python-linux"
New-Item -ItemType Directory -Force -Path $OutRoot, $WinWheels, $LinWheels, $DistDir, $PyWinDir, $PyLinDir | Out-Null

$ReqSrc     = Join-Path $ProjectDir "requirements.txt"
$ReqSanBase = Join-Path $OutRoot "requirements.sanitized.base.txt"
$ReqWin     = Join-Path $OutRoot "requirements.windows.txt"
$ReqLin     = Join-Path $OutRoot "requirements.linux.txt"

# Step 1: Produce base sanitized requirements
if ($UseExistingRequirements) {
  if (-not (Test-Path $ReqSrc)) { Write-Err "requirements.txt not found at $ReqSrc"; exit 1 }
  $raw = Get-Content -Path $ReqSrc -Encoding UTF8
  Write-Info "Using existing requirements.txt"
} else {
  $conda = (Get-Command conda -ErrorAction SilentlyContinue)
  if (-not $conda) { Write-Err "conda command not found in PATH"; exit 1 }
  Write-Info "Exporting pip deps from conda env: $CondaEnvName"
  $raw = conda run -n $CondaEnvName python -m pip freeze --all 2>&1
  if ($LASTEXITCODE -ne 0) { Write-Err ("conda run failed:`n" + ($raw | Out-String)); exit 1 }
}

$clean = $raw | Where-Object {
  ($_ -notmatch '^(pip|setuptools|wheel)(\s|==|>=|<=|~=|!=|<|>|$)') -and
  ($_ -notmatch '\s@\s*file://') -and
  ($_ -notmatch '^[A-Za-z]:\\\\') -and
  ($_ -notmatch '\\bcroot\\b') -and
  ($_ -notmatch '^\s*$') -and
  ($_ -notmatch '^#')
}
$clean | Out-File -Encoding ASCII $ReqSanBase
Copy-Item -Path $ReqSanBase -Destination $ReqWin -Force
Copy-Item -Path $ReqSanBase -Destination $ReqLin -Force

# Adjust known problematic pins (PyPI no wheel or version missing)
(Get-Content $ReqWin) | ForEach-Object { $_ -replace '^python-multipart==0\.0\.5$', 'python-multipart==0.0.9' } | Out-File -Encoding ASCII $ReqWin
(Get-Content $ReqLin) | ForEach-Object { $_ -replace '^python-multipart==0\.0\.5$', 'python-multipart==0.0.9' } | Out-File -Encoding ASCII $ReqLin

Write-Info "Sanitized requirements: $ReqSanBase"

# Step 2: Read Python minor version from conda env and pin Linux numpy if needed
Write-Info "Reading Python version from conda env: $CondaEnvName"
$PyVer = conda run -n $CondaEnvName python -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')" 2>&1
if ($LASTEXITCODE -ne 0) { Write-Err ("Failed to read Python version from conda env:`n" + ($PyVer | Out-String)); exit 1 }
$PyVer = ($PyVer | Out-String).Trim()
Write-Info "Detected Python version: $PyVer"
try {
  $parts = $PyVer.Split('.')
  $maj = 0; $min = 0
  [void][int]::TryParse($parts[0], [ref]$maj)
  [void][int]::TryParse($parts[1], [ref]$min)
  if ($maj -eq 3 -and $min -lt 11) {
    (Get-Content $ReqLin) | ForEach-Object { $_ -replace '^numpy==.*$', 'numpy==2.2.6' } | Out-File -Encoding ASCII $ReqLin
    Write-Warn "Pinned Linux numpy to 2.2.6 for Python $PyVer"
  }
} catch { Write-Warn "Failed to parse Python version; skip numpy pin" }

# Packages that can be built from sdist if wheels are not available
$NoBinaryPackages = "python-multipart,tfrecord,websockets"

# Step 3: Build Windows wheels with conda env Python
Write-Info "Building Windows wheels to $WinWheels with conda env Python $PyVer"
conda run -n $CondaEnvName python -m pip install -U pip wheel
if ($LASTEXITCODE -ne 0) { Write-Err "Failed to upgrade pip/wheel in conda env"; exit 1 }
conda run -n $CondaEnvName python -m pip wheel --only-binary=:all: --no-binary=$NoBinaryPackages -r $ReqWin -w $WinWheels
if ($LASTEXITCODE -ne 0) { Write-Warn "Windows wheels build had failures; check problematic packages" }
try { conda run -n $CondaEnvName python -m pip download --only-binary=:all: -d $WinWheels pip setuptools wheel } catch { Write-Warn "Failed to fetch toolchain wheels for Windows" }

# 校验 Windows wheels 标签
if (-not (Test-WheelTagsMatch -WheelsDir $WinWheels -PyVer $PyVer -PlatformName "Windows")) { exit 1 }

# Step 4: Build Linux wheels (WSL) with same minor version
Write-Info "Building Linux wheels to $LinWheels (via WSL) with Python $PyVer"
$WslReqLin  = Convert-ToWslPath $ReqLin
$WslLinWheels = Convert-ToWslPath $LinWheels
Invoke-WSL "set -e; if ! command -v python$PyVer >/dev/null 2>&1; then echo 'python$PyVer not found in WSL'; exit 1; fi"
Invoke-WSL "python$PyVer -m pip install -U pip wheel"
Invoke-WSL "mkdir -p '$WslLinWheels' && python$PyVer -m pip wheel --only-binary=:all: --no-binary=$NoBinaryPackages -r '$WslReqLin' -w '$WslLinWheels'"
if ($LASTEXITCODE -ne 0) { Write-Warn "Linux wheels build had failures; check problematic packages" }
try { Invoke-WSL "python$PyVer -m pip download --only-binary=:all: -d '$WslLinWheels' pip setuptools wheel" } catch { Write-Warn "Failed to fetch toolchain wheels for Linux" }

# 校验 Linux wheels 标签
if (-not (Test-WheelTagsMatch -WheelsDir $LinWheels -PyVer $PyVer -PlatformName "Linux")) { exit 1 }

# Step 5: Download Python installers (Windows exe, Linux debs)
Write-Info "Downloading Python installers"
try {
  $minor = $PyVer
  $index = Invoke-WebRequest -UseBasicParsing "https://www.python.org/ftp/python/" -Headers @{ "User-Agent" = "offline-builder" }
  $patches = ($index.Links | Where-Object { $_.href -match "^$minor\.\d+/" } | ForEach-Object { $_.href.TrimEnd('/') }) | Sort-Object { [version]$_ } -Descending
  if ($patches.Count -gt 0) {
    $latest = $patches[0]
    $exeUrl = "https://www.python.org/ftp/python/$latest/python-$latest-amd64.exe"
    $dest = Join-Path $PyWinDir ("python-$latest-amd64.exe")
    Write-Info "Downloading Windows installer: $exeUrl"
    Invoke-WebRequest -UseBasicParsing -Uri $exeUrl -OutFile $dest -Headers @{ "User-Agent" = "offline-builder" }
  } else {
    Write-Warn "No python $minor patch found on python.org index; skip Windows installer"
  }
} catch { Write-Warn ("Failed to download Windows installer: " + $_.Exception.Message) }

try {
  $WslPyDir = Convert-ToWslPath $PyLinDir
  Invoke-WSL "mkdir -p '$WslPyDir/debs'"
  Invoke-WSL "sudo apt-get update"
  Invoke-WSL "sudo apt-get -y -o Dir::Cache::archives='$WslPyDir/debs' install --download-only python$PyVer python$PyVer-venv || true"
  Write-Info "Downloaded Linux debs into $PyLinDir/debs"
} catch { Write-Warn "Failed to predownload Linux debs (requires Debian/Ubuntu and sudo)" }

# Step 6: Write HOWTO files
$HowtoWin = @"
Offline install (Windows)
=========================
0) If Python $PyVer is not installed, run the included installer (as Admin if needed):
   python-<latest>-$PyVer-amd64.exe /quiet InstallAllUsers=1 PrependPath=1 Include_pip=1 Include_test=0
1) Ensure Python version matches the wheels (same major.minor as build machine)
2) Create venv and activate:
   python -m venv .venv
   .\.venv\Scripts\Activate.ps1
3) Upgrade toolchain from local wheels:
   pip install --no-index --find-links=./wheels-win -U pip setuptools wheel
4) Install offline deps:
   pip install --no-index --find-links=./wheels-win -r requirements.windows.txt
5) Start backend:
   python -m uvicorn labelu.main:app --host 0.0.0.0 --port 8000
"@

$HowtoLin = @"
Offline install (Linux)
=======================
0) If python$PyVer is missing (Debian/Ubuntu):
   cd python-linux/debs
   sudo apt install ./*.deb
1) Ensure Python version matches the wheels (same major.minor as build machine)
2) Create venv and activate:
   python3 -m venv .venv
   source .venv/bin/activate
3) Upgrade toolchain from local wheels:
   pip install --no-index --find-links=./wheels-linux -U pip setuptools wheel
4) Install offline deps:
   pip install --no-index --find-links=./wheels-linux -r requirements.linux.txt
5) Start backend:
   python -m uvicorn labelu.main:app --host 0.0.0.0 --port 8000
"@

$HowtoWin | Out-File -Encoding ASCII (Join-Path $OutRoot "HOWTO-WINDOWS.txt")
$HowtoLin | Out-File -Encoding ASCII (Join-Path $OutRoot "HOWTO-LINUX.txt")

# Step 7: All-in-one zip (offline folder)
$ZipAll = Join-Path $DistDir ("{0}.zip" -f $OutFolderName)
if (Test-Path $ZipAll) { Remove-Item -Force $ZipAll }
$toZip = @()
$toZip += (Join-Path $OutRoot "wheels-win")
$toZip += (Join-Path $OutRoot "wheels-linux")
$toZip += (Join-Path $OutRoot "python-windows")
$toZip += (Join-Path $OutRoot "python-linux")
$toZip += $ReqWin
$toZip += $ReqLin
$toZip += (Join-Path $OutRoot "requirements.sanitized.base.txt")
$toZip += (Join-Path $OutRoot "HOWTO-WINDOWS.txt")
$toZip += (Join-Path $OutRoot "HOWTO-LINUX.txt")
Compress-Archive -Path $toZip -DestinationPath $ZipAll -Force

Write-Host ""
Write-Info "Done. Artifact:"
Write-Host "All-in-one zip: $ZipAll"


