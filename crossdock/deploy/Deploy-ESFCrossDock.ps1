param(
  [string]$SheetId = '1_AyMgLDm7VkaxYxYBn4hRObx7nTqQmpLrPY1CyO_FOM',
  [string]$ProjectTitle = 'ESF-CrossDock-Receiver',
  [string]$RepoRoot = 'C:\HDP\EnterpriseSystemsFactory'
)

$ErrorActionPreference = 'Stop'
$sourceDir = Join-Path $RepoRoot 'crossdock\apps-script'
$stateDir = Join-Path $RepoRoot 'crossdock\state'
$deployDir = Join-Path $RepoRoot 'crossdock\deploy-work'
$claspState = Join-Path $stateDir '.clasp.json'
$claspRc = Join-Path $HOME '.clasprc.json'

function Out-Kv([string]$Key, [string]$Value) { Write-Output ("{0}={1}" -f $Key, $Value) }

Out-Kv 'SERVICE' 'ESF-CrossDock-Receiver'
Out-Kv 'SHEET_ID' $SheetId
Out-Kv 'EXTERNAL_CUSTOMER_ACTIONS' '0'

if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Node.js is required.' }
$nodeMajor = [int]((node --version).TrimStart('v').Split('.')[0])
if ($nodeMajor -lt 20) { throw 'Node.js 20 or newer is required.' }
if (-not (Test-Path $claspRc)) {
  Out-Kv 'AUTH_REQUIRED' '1'
  Out-Kv 'AUTH_REASON' 'clasp user OAuth credentials not found for the VPS service account/profile'
  exit 20
}
if (-not (Test-Path (Join-Path $sourceDir 'Code.gs'))) { throw 'Approved Code.gs source is missing.' }
if (-not (Test-Path (Join-Path $sourceDir 'appsscript.json'))) { throw 'Approved appsscript.json source is missing.' }

New-Item -ItemType Directory -Force -Path $stateDir | Out-Null
New-Item -ItemType Directory -Force -Path $deployDir | Out-Null

Push-Location $deployDir
try {
  $authCheck = (& npx --yes @google/clasp list) 2>&1 | Out-String
  if ($LASTEXITCODE -ne 0) {
    Out-Kv 'AUTH_REQUIRED' '1'
    Out-Kv 'AUTH_REASON' 'stored clasp OAuth session is not usable'
    exit 20
  }

  if (Test-Path $claspState) {
    Copy-Item $claspState (Join-Path $deployDir '.clasp.json') -Force
  } else {
    & npx --yes @google/clasp create $ProjectTitle --type webapp --parentId $SheetId
    if ($LASTEXITCODE -ne 0) { throw 'clasp create failed; verify Apps Script API access.' }
    Copy-Item (Join-Path $deployDir '.clasp.json') $claspState -Force
  }

  Copy-Item (Join-Path $sourceDir 'Code.gs') (Join-Path $deployDir 'Code.gs') -Force
  Copy-Item (Join-Path $sourceDir 'appsscript.json') (Join-Path $deployDir 'appsscript.json') -Force

  & npx --yes @google/clasp push --force
  if ($LASTEXITCODE -ne 0) { throw 'clasp push failed.' }

  $versionOutput = (& npx --yes @google/clasp version 'ESF CrossDock production') 2>&1 | Out-String
  $versionMatch = [regex]::Match($versionOutput, '(?i)version\s+(\d+)')
  if (-not $versionMatch.Success) { throw 'Could not determine Apps Script version.' }
  $version = $versionMatch.Groups[1].Value

  $deployOutput = (& npx --yes @google/clasp deploy $version 'ESF CrossDock production web app') 2>&1 | Out-String
  if ($LASTEXITCODE -ne 0) { throw 'clasp deploy failed.' }
  $deploymentMatch = [regex]::Match($deployOutput, '(AKfy[a-zA-Z0-9_-]+)')
  if (-not $deploymentMatch.Success) { throw 'Could not determine deployment ID.' }

  $deploymentId = $deploymentMatch.Groups[1].Value
  $scriptConfig = Get-Content (Join-Path $deployDir '.clasp.json') -Raw | ConvertFrom-Json
  Out-Kv 'AUTH_REQUIRED' '0'
  Out-Kv 'SCRIPT_ID' ([string]$scriptConfig.scriptId)
  Out-Kv 'VERSION' $version
  Out-Kv 'DEPLOYMENT_ID' $deploymentId
  Out-Kv 'WEB_APP_URL' ("https://script.google.com/macros/s/{0}/exec" -f $deploymentId)
  Out-Kv 'RESULT' 'DEPLOYED'
} finally {
  Pop-Location
}
