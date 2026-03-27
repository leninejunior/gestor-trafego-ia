param(
  [string]$SshHost = "edith.engrene.com",
  [string]$User = "root",
  [string]$AppDir = "/var/www/flying-fox-bob",
  [string]$Branch = "main",
  [ValidateSet("pm2", "systemd", "docker")]
  [string]$Runtime = "pm2",
  [string]$ServiceName = "edith-app"
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command ssh -ErrorAction SilentlyContinue)) {
  throw "ssh client not found. Install OpenSSH client and try again."
}

$runtimeCmd = switch ($Runtime) {
  "pm2" {
    @"
if pm2 describe "$ServiceName" >/dev/null 2>&1; then
  pm2 restart "$ServiceName" --update-env
else
  pm2 start npm --name "$ServiceName" -- start
fi
pm2 save
"@
  }
  "systemd" {
    @"
sudo systemctl restart "$ServiceName"
sudo systemctl status "$ServiceName" --no-pager -l | head -n 40
"@
  }
  "docker" {
    @"
docker compose pull
docker compose up -d --build
docker compose ps
"@
  }
}

$remoteScript = @"
set -euo pipefail

cd "$AppDir"
git fetch origin
git checkout "$Branch"
git pull --ff-only origin "$Branch"

npm ci
npm run build
$runtimeCmd

echo "DEPLOY_OK"
"@

$remoteScriptOneLine = $remoteScript -replace "`r?`n", "; "
$remoteEscaped = $remoteScriptOneLine.Replace('"', '\"')
$target = "$User@$SshHost"

Write-Host "Deploying to $target ($Runtime)..." -ForegroundColor Cyan
ssh -o BatchMode=yes -o ConnectTimeout=15 $target "bash -lc ""$remoteEscaped"""
if ($LASTEXITCODE -ne 0) {
  throw "SSH command failed with exit code $LASTEXITCODE. Check SSH credentials/access for $target."
}

Write-Host "Deploy finished." -ForegroundColor Green
