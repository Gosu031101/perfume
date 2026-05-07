param(
    [int]$Port = 8014,
    [string]$Root = (Get-Location).Path
)

$Root = [System.IO.Path]::GetFullPath($Root)
$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Parse("127.0.0.1"), $Port)
$listener.Start()
$DataDir = [System.IO.Path]::Combine($Root, "data")
$UsersFile = [System.IO.Path]::Combine($DataDir, "users.json")

if (-not [System.IO.Directory]::Exists($DataDir)) {
    [System.IO.Directory]::CreateDirectory($DataDir) | Out-Null
}

if (-not [System.IO.File]::Exists($UsersFile)) {
    "[]" | Set-Content -LiteralPath $UsersFile -Encoding UTF8
}

$contentTypes = @{
    ".html" = "text/html; charset=utf-8"
    ".css" = "text/css; charset=utf-8"
    ".js" = "application/javascript; charset=utf-8"
    ".jpg" = "image/jpeg"
    ".jpeg" = "image/jpeg"
    ".png" = "image/png"
    ".gif" = "image/gif"
    ".svg" = "image/svg+xml"
    ".ico" = "image/x-icon"
}

function Get-Users {
    $raw = Get-Content -Raw -LiteralPath $UsersFile -ErrorAction SilentlyContinue
    if ([string]::IsNullOrWhiteSpace($raw)) {
        return @()
    }

    $users = @($raw | ConvertFrom-Json)
    return @($users | Where-Object { $_.email })
}

function Save-Users($users) {
    ConvertTo-Json -InputObject @($users) -Depth 6 | Set-Content -LiteralPath $UsersFile -Encoding UTF8
}

function Get-PasswordHash([string]$password) {
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($password)
    $hash = [System.Security.Cryptography.SHA256]::Create().ComputeHash($bytes)
    return [Convert]::ToBase64String($hash)
}

function Send-Json($stream, [int]$statusCode, [string]$statusText, $payload) {
    $body = [System.Text.Encoding]::UTF8.GetBytes(($payload | ConvertTo-Json -Depth 6))
    $header = "HTTP/1.1 $statusCode $statusText`r`nContent-Type: application/json; charset=utf-8`r`nContent-Length: $($body.Length)`r`nConnection: close`r`n`r`n"
    $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($header)
    $stream.Write($headerBytes, 0, $headerBytes.Length)
    $stream.Write($body, 0, $body.Length)
}

function Get-PublicUser($user) {
    return @{
        name = $user.name
        email = $user.email
        points = [int]$user.points
        verified = if ($user.verified -ne $null) { [bool]$user.verified } else { $false }
    }
}

while ($true) {
    $client = $listener.AcceptTcpClient()

    try {
        $status = $null
        $stream = $client.GetStream()
        $reader = [System.IO.StreamReader]::new($stream, [System.Text.Encoding]::ASCII, $false, 1024, $true)
        $line = $reader.ReadLine()
        $headers = @{}

        while ($reader.Peek() -ge 0) {
            $headerLine = $reader.ReadLine()
            if ([string]::IsNullOrEmpty($headerLine)) {
                break
            }

            $parts = $headerLine.Split(":", 2)
            if ($parts.Count -eq 2) {
                $headers[$parts[0].Trim().ToLowerInvariant()] = $parts[1].Trim()
            }
        }

        if ($line -notmatch "^(GET|POST)\s+([^\s]+)") {
            $client.Close()
            continue
        }

        $method = $matches[1]
        $requestPath = [Uri]::UnescapeDataString($matches[2].Split("?")[0].TrimStart("/"))
        if ([string]::IsNullOrWhiteSpace($requestPath)) {
            $requestPath = "index.html"
        }

        if ($requestPath -like "api/*") {
            if ($method -ne "POST") {
                Send-Json $stream 405 "Method Not Allowed" @{ message = "Method not allowed" }
                continue
            }

            $contentLength = 0
            if ($headers.ContainsKey("content-length")) {
                [int]::TryParse($headers["content-length"], [ref]$contentLength) | Out-Null
            }

            $bodyText = ""
            if ($contentLength -gt 0) {
                $buffer = New-Object char[] $contentLength
                $read = $reader.Read($buffer, 0, $contentLength)
                $bodyText = -join $buffer[0..($read - 1)]
            }

            $payload = if ([string]::IsNullOrWhiteSpace($bodyText)) { @{} } else { $bodyText | ConvertFrom-Json }
            $users = @(Get-Users)
            $email = ([string]$payload.email).Trim().ToLowerInvariant()

            if ($requestPath -eq "api/register") {
                $name = ([string]$payload.name).Trim()
                $password = [string]$payload.password

                if ([string]::IsNullOrWhiteSpace($name) -or [string]::IsNullOrWhiteSpace($email) -or [string]::IsNullOrWhiteSpace($password)) {
                    Send-Json $stream 400 "Bad Request" @{ message = "Please enter name, email and password." }
                    continue
                }

                $existing = @($users | Where-Object { $_.email -eq $email })
                if ($existing.Count -gt 0) {
                    Send-Json $stream 409 "Conflict" @{ message = "Email already registered." }
                    continue
                }

                $user = [pscustomobject]@{
                    name = $name
                    email = $email
                    passwordHash = Get-PasswordHash $password
                    points = 0
                    verified = $false
                    createdAt = (Get-Date).ToString("o")
                }
                $users = @($users + $user)
                Save-Users $users
                Send-Json $stream 200 "OK" @{ user = Get-PublicUser $user }
                continue
            }

            if ($requestPath -eq "api/login") {
                $passwordHash = Get-PasswordHash ([string]$payload.password)
                $user = @($users | Where-Object { $_.email -eq $email -and $_.passwordHash -eq $passwordHash } | Select-Object -First 1)

                if ($user.Count -eq 0) {
                    Send-Json $stream 401 "Unauthorized" @{ message = "Email or password is incorrect." }
                    continue
                }

                Send-Json $stream 200 "OK" @{ user = Get-PublicUser $user[0] }
                continue
            }

            if ($requestPath -eq "api/member/update") {
                $updatedUser = $null
                $users = @($users | ForEach-Object {
                    if ($_.email -eq $email) {
                                $updatedUser = [pscustomobject]@{
                                    name = if ($payload.name) { [string]$payload.name } else { [string]$_.name }
                                    email = [string]$_.email
                                    passwordHash = [string]$_.passwordHash
                                    points = if ($payload.points -ne $null) { [int]$payload.points } else { [int]$_.points }
                                    verified = if ($payload.verified -ne $null) { [bool]$payload.verified } else { if ($_.PSObject.Properties.Name -contains 'verified') { [bool]$_.verified } else { $false } }
                                    createdAt = [string]$_.createdAt
                                }
                        $updatedUser
                    } else {
                        $_
                    }
                })

                if (-not $updatedUser) {
                    Send-Json $stream 404 "Not Found" @{ message = "Account not found." }
                    continue
                }

                Save-Users $users
                Send-Json $stream 200 "OK" @{ user = Get-PublicUser $updatedUser }
                continue
            }

            Send-Json $stream 404 "Not Found" @{ message = "API not found." }
            continue
        }

        $localPath = [System.IO.Path]::GetFullPath(
            [System.IO.Path]::Combine($Root, $requestPath.Replace("/", [System.IO.Path]::DirectorySeparatorChar))
        )

        if (-not $localPath.StartsWith($Root, [System.StringComparison]::OrdinalIgnoreCase)) {
            $status = "403 Forbidden"
            $body = [System.Text.Encoding]::UTF8.GetBytes("Forbidden")
            $type = "text/plain; charset=utf-8"
        } elseif ([System.IO.Directory]::Exists($localPath)) {
            $localPath = [System.IO.Path]::Combine($localPath, "index.html")
        }

        if ($status -ne "403 Forbidden") {
            if ([System.IO.File]::Exists($localPath)) {
                $status = "200 OK"
                $body = [System.IO.File]::ReadAllBytes($localPath)
                $ext = [System.IO.Path]::GetExtension($localPath).ToLowerInvariant()
                $type = if ($contentTypes.ContainsKey($ext)) { $contentTypes[$ext] } else { "application/octet-stream" }
            } else {
                $status = "404 Not Found"
                $body = [System.Text.Encoding]::UTF8.GetBytes("Not Found")
                $type = "text/plain; charset=utf-8"
            }
        }

        $header = "HTTP/1.1 $status`r`nContent-Type: $type`r`nContent-Length: $($body.Length)`r`nConnection: close`r`n`r`n"
        $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($header)
        $stream.Write($headerBytes, 0, $headerBytes.Length)
        $stream.Write($body, 0, $body.Length)
    } catch {
        Write-Error $_
    } finally {
        $client.Close()
    }
}
