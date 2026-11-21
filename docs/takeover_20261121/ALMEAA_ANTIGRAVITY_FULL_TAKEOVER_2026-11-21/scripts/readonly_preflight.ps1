param(
  [Parameter(Mandatory=$true)]
  [string]$RepoPath
)
$ErrorActionPreference = 'Stop'
if (-not (Test-Path -LiteralPath $RepoPath -PathType Container)) {
  throw "Repository path not found: $RepoPath"
}
$root = & git -C $RepoPath rev-parse --show-toplevel
if ($LASTEXITCODE -ne 0) { throw 'Not a readable Git repository' }
Write-Host '=== Read-only ALMEAA Git preflight ==='
Write-Host "Repository: $root"
& git -C $RepoPath remote -v
& git -C $RepoPath status --short --branch
& git -C $RepoPath rev-parse HEAD
& git -C $RepoPath log -1 --format='%h %ci %s' HEAD
& git -C $RepoPath branch -vv
& git -C $RepoPath diff --stat
& git -C $RepoPath diff --check
if (Get-Command gh -ErrorAction SilentlyContinue) {
  Write-Host 'GitHub CLI is available; listing PR titles (no token output).'
  & gh pr list --repo nasef6464/almeaago --state open --limit 30
} else {
  Write-Host 'GitHub CLI not found; skip live PR list.'
}
Write-Host 'No checkout, fetch, clean, reset, commit, push, deploy, or data write performed.'
