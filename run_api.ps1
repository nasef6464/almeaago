$envFile = Join-Path $PSScriptRoot ".env"
if (Test-Path $envFile) {
    Get-Content $envFile | Where-Object { $_ -match '^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$' } | ForEach-Object {
        $name = $matches[1]
        $val = $matches[2].Trim('"').Trim("'")
        [System.Environment]::SetEnvironmentVariable($name, $val, 'Process')
    }
}
& (Join-Path $PSScriptRoot "bin\api.exe")
