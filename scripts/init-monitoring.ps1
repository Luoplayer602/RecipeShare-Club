$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$secretDirectory = Join-Path $projectRoot '.secrets'
[void](New-Item -ItemType Directory -Path $secretDirectory -Force)
$appEnvPath = Join-Path $projectRoot 'app/.env.local'
$appText = if (Test-Path -LiteralPath $appEnvPath) { [IO.File]::ReadAllText($appEnvPath) } else { '' }
$match = [regex]::Match($appText, '(?m)^METRICS_BEARER_TOKEN=(.*?)\r?$')
$configuredToken = if ($match.Success) { $match.Groups[1].Value.Trim().Trim('"').Trim("'") } else { '' }
foreach ($name in @('metrics_bearer_token', 'grafana_admin_password', 'mysql_monitor_password')) {
    $target = Join-Path $secretDirectory "$name.txt"
    if (-not (Test-Path -LiteralPath $target)) {
        if ($name -eq 'metrics_bearer_token' -and $configuredToken.Length -ge 32) { $value = $configuredToken }
        else {
            $bytes = New-Object byte[] 32
            $random = [Security.Cryptography.RandomNumberGenerator]::Create()
            try { $random.GetBytes($bytes) } finally { $random.Dispose() }
            $value = -join ($bytes | ForEach-Object { $_.ToString('x2') })
        }
        [IO.File]::WriteAllText($target, $value, [Text.UTF8Encoding]::new($false))
        Write-Output "Created .secrets/$name.txt"
    }
}
$monitorPassword = [IO.File]::ReadAllText((Join-Path $secretDirectory 'mysql_monitor_password.txt')).Trim()
if ($monitorPassword -notmatch '^[a-f0-9]{64}$') { throw 'MySQL monitoring password must be a 64-character lowercase hex value.' }
$exporterConfig = "[client]`nuser=recipe_monitor`npassword=$monitorPassword`n"
$exporterPath = Join-Path $secretDirectory 'mysqld_exporter.cnf'
if (Test-Path -LiteralPath $exporterPath) {
    if ([IO.File]::ReadAllText($exporterPath).Replace("`r`n", "`n").Trim() -ne $exporterConfig.Trim()) {
        throw 'MySQL exporter config differs from the monitoring secret; synchronize them locally before starting the exporter.'
    }
} else {
    [IO.File]::WriteAllText($exporterPath, $exporterConfig, [Text.UTF8Encoding]::new($false))
    Write-Output 'Created .secrets/mysqld_exporter.cnf; Compose will initialize the dedicated monitoring account.'
}
$token = [IO.File]::ReadAllText((Join-Path $secretDirectory 'metrics_bearer_token.txt')).Trim()
if ($token.Length -lt 32) { throw 'Metrics token must contain at least 32 characters.' }
if ($match.Success) {
    if ($configuredToken -ne $token) { throw 'Metrics token differs between app/.env.local and .secrets/metrics_bearer_token.txt; synchronize them locally before starting monitoring.' }
} else {
    [IO.File]::AppendAllText($appEnvPath, "`nMETRICS_BEARER_TOKEN=$token`n", [Text.UTF8Encoding]::new($false))
    Write-Output 'Configured metrics token in app/.env.local; existing settings preserved.'
}
Write-Output 'Monitoring secrets are ready. No secret values were printed.'
$appText = [IO.File]::ReadAllText($appEnvPath)
if ($appText -notmatch '(?m)^LOG_SYSLOG_PORT=') {
    [IO.File]::AppendAllText($appEnvPath, "`nLOG_SYSLOG_PORT=1514`n", [Text.UTF8Encoding]::new($false))
    Write-Output 'Enabled local application syslog on UDP 1514; restart Next.js to apply.'
}
