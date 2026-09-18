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
if (-not (Get-Command npx -ErrorAction SilentlyContinue)) { throw 'npx is required.' }
if (-not (Test-Path $claspRc)) {
  Out-Kv 'AUTH_REQUIRED' '1'
  Out-Kv 'AUTH_REASON' 'clasp user OAuth credentials not found for the VPS service profile'
  Out-Kv 'AUTH_COMMAND' 'npx --yes @google/clasp login --no-localhost'
  Out-Kv 'APPS_SCRIPT_API_SETTING' 'https://script.google.com/home/usersettings'
  exit 20
}
if (-not (Test-Path (Join-Path $sourceDir 'Code.gs'))) { throw 'Approved Code.gs source is missing.' }
if (-not (Test-Path (Join-Path $sourceDir 'appsscript.json'))) { throw 'Approved appsscript.json source is missing.' }

New-Item -ItemType Directory -Force -Path $stateDir | Out-Null
New-Item -ItemType Directory -Force -Path $deployDir | Out-Null

Push-Location $deployDir
try {
  $claspVersion = (& npx --yes @google/clasp --version) 2>&1 | Out-String
  Out-Kv 'CLASP_VERSION' $claspVersion.Trim()

  $authCheck = (& npx --yes @google/clasp list-scripts) 2>&1 | Out-String
  if ($LASTEXITCODE -ne 0) {
    Out-Kv 'AUTH_REQUIRED' '1'
    Out-Kv 'AUTH_REASON' 'stored clasp OAuth session is not usable'
    Out-Kv 'AUTH_COMMAND' 'npx --yes @google/clasp login --no-localhost'
    exit 20
  }

  if (Test-Path $claspState) {
    Copy-Item $claspState (Join-Path $deployDir '.clasp.json') -Force
  } else {
    $createOutput = (& npx --yes @google/clasp create-script --title $ProjectTitle --type webapp --parentId $SheetId) 2>&1 | Out-String
    if ($LASTEXITCODE -ne 0) { throw "clasp create-script failed: $createOutput" }
    if (-not (Test-Path (Join-Path $deployDir '.clasp.json'))) { throw 'clasp create-script did not produce .clasp.json.' }
    Copy-Item (Join-Path $deployDir '.clasp.json') $claspState -Force
  }

  Copy-Item (Join-Path $sourceDir 'Code.gs') (Join-Path $deployDir 'Code.gs') -Force
  Copy-Item (Join-Path $sourceDir 'appsscript.json') (Join-Path $deployDir 'appsscript.json') -Force

  $pushOutput = (& npx --yes @google/clasp push --force) 2>&1 | Out-String
  if ($LASTEXITCODE -ne 0) { throw "clasp push failed: $pushOutput" }

  $versionOutput = (& npx --yes @google/clasp create-version 'ESF CrossDock production') 2>&1 | Out-String
  if ($LASTEXITCODE -ne 0) { throw "clasp create-version failed: $versionOutput" }
  $versionMatch = [regex]::Match($versionOutput, '(?i)version\D+(\d+)')
  if (-not $versionMatch.Success) { throw "Could not determine Apps Script version from: $versionOutput" }
  $version = $versionMatch.Groups[1].Value

  $deployOutput = (& npx --yes @google/clasp create-deployment --versionNumber $version --description 'ESF CrossDock production web app') 2>&1 | Out-String
  if ($LASTEXITCODE -ne 0) { throw "clasp create-deployment failed: $deployOutput" }
  $deploymentMatch = [regex]::Match($deployOutput, '(AKfy[a-zA-Z0-9_-]+)')
  if (-not $deploymentMatch.Success) { throw "Could not determine deployment ID from: $deployOutput" }

  $deploymentId = $deploymentMatch.Groups[1].Value
  $webAppUrl = "https://script.google.com/macros/s/{0}/exec" -f $deploymentId
  $scriptConfig = Get-Content (Join-Path $deployDir '.clasp.json') -Raw | ConvertFrom-Json

  Out-Kv 'AUTH_REQUIRED' '0'
  Out-Kv 'SCRIPT_ID' ([string]$scriptConfig.scriptId)
  Out-Kv 'VERSION' $version
  Out-Kv 'DEPLOYMENT_ID' $deploymentId
  Out-Kv 'WEB_APP_URL' $webAppUrl

  $healthOk = $false
  $healthDetail = ''
  foreach ($attempt in 1..5) {
    try {
      $response = Invoke-WebRequest -Uri $webAppUrl -UseBasicParsing -MaximumRedirection 5 -TimeoutSec 20
      $healthDetail = [string]$response.Content
      if ($response.StatusCode -eq 200 -and $healthDetail -match 'ESF-CrossDock-Receiver' -and $healthDetail -match '"status":"ready"') {
        $healthOk = $true
        break
      }
    } catch {
      $healthDetail = $_.Exception.Message
    }
    Start-Sleep -Seconds 2
  }

  if (-not $healthOk) {
    Out-Kv 'HEALTH_OK' '0'
    Out-Kv 'HEALTH_DETAIL' ($healthDetail -replace '[\r\n]+',' ')
    throw 'Deployment created but anonymous web-app health check did not pass.'
  }
  Out-Kv 'HEALTH_OK' '1'

  # Prove the receiving dock end-to-end with one clearly identified internal QA manifest.
  $qaDate = Get-Date -Format 'yyyyMMdd'
  $qaSuffix = 'QA' + (([guid]::NewGuid().ToString('N')).Substring(0,6).ToUpperInvariant())
  $qaManifestId = "ESF-$qaDate-$qaSuffix"
  $qaForm = @{
    manifest_id = $qaManifestId
    customer_name = 'ESF CrossDock QA'
    company = 'Highest Degree Priorities'
    email = 'highestdegreepriorities@gmail.com'
    phone = ''
    preferred_path = 'build'
    system_type = 'CrossDock receiver deployment QA'
    current_state = 'deployment smoke test'
    operating_outcome = 'Verify end-to-end Apps Script to ESF-CrossDock-Intake manifest receipt'
    additional_context = 'Automated internal deployment smoke test. Safe QA record; not a customer lead.'
    website = ''
  }

  $smokeOk = $false
  $smokeDetail = ''
  foreach ($attempt in 1..5) {
    try {
      $smoke = Invoke-WebRequest -Uri $webAppUrl -Method Post -Body $qaForm -ContentType 'application/x-www-form-urlencoded' -UseBasicParsing -MaximumRedirection 5 -TimeoutSec 30
      $smokeDetail = [string]$smoke.Content
      if ($smoke.StatusCode -eq 200 -and $smokeDetail -match '"ok":true' -and $smokeDetail -match [regex]::Escape($qaManifestId)) {
        $smokeOk = $true
        break
      }
    } catch {
      $smokeDetail = $_.Exception.Message
    }
    Start-Sleep -Seconds 2
  }

  Out-Kv 'SMOKE_MANIFEST_ID' $qaManifestId
  if (-not $smokeOk) {
    Out-Kv 'SMOKE_OK' '0'
    Out-Kv 'SMOKE_DETAIL' ($smokeDetail -replace '[\r\n]+',' ')
    throw 'Web app deployed but end-to-end intake POST smoke test did not pass.'
  }

  Out-Kv 'SMOKE_OK' '1'
  Out-Kv 'RESULT' 'DEPLOYED_AND_INTAKE_VERIFIED'
} finally {
  Pop-Location
}
