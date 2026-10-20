$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$secretDirectory = Join-Path $projectRoot '.secrets'
[void](New-Item -ItemType Directory -Path $secretDirectory -Force)
$random = [System.Security.Cryptography.RandomNumberGenerator]::Create()
try {
    foreach ($name in @('mysql_owner_password', 'mysql_root_password')) {
        $target = Join-Path $secretDirectory "$name.txt"
        if (-not (Test-Path -LiteralPath $target)) {
            $bytes = New-Object byte[] 32
            $random.GetBytes($bytes)
            $password = [Convert]::ToBase64String($bytes)
            [System.IO.File]::WriteAllText($target, $password, [System.Text.UTF8Encoding]::new($false))
            Write-Output "Created .secrets/$name.txt"
        }
    }
} finally {
    $random.Dispose()
}
$envPath = Join-Path $projectRoot '.env'
if (-not (Test-Path -LiteralPath $envPath)) {
    Copy-Item -LiteralPath (Join-Path $projectRoot '.env.example') -Destination $envPath
    Write-Output 'Created .env'
}
Write-Output 'Local configuration is ready; existing secrets were preserved.'
