# Configurar Supabase Aura Tickets via API
$SUPABASE_URL = "https://rwaezeqyuhxrssntcxdv.supabase.co"
$SERVICE_ROLE = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ3YWV6ZXF5dWh4cnNzbnRjeGR2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Nzc1MzMyMiwiZXhwIjoyMDkzMzI5MzIyfQ.geaaWq2MCfrICr41FqTICyEqWsQQgYdrhAkYbTkBa5s"

$headers = @{
    "Authorization" = "Bearer $SERVICE_ROLE"
    "apikey" = $SERVICE_ROLE
    "Content-Type" = "application/json"
}

function Call-Api($method, $endpoint, $body, $extraHeaders) {
    $url = "$SUPABASE_URL$endpoint"
    $h = @{}
    $headers.GetEnumerator() | ForEach-Object { $h[$_.Key] = $_.Value }
    if ($extraHeaders) {
        $extraHeaders.GetEnumerator() | ForEach-Object { $h[$_.Key] = $_.Value }
    }
    $json = if ($body) { $body | ConvertTo-Json -Depth 10 } else { $null }
    try {
        $resp = Invoke-RestMethod -Uri $url -Method $method -Headers $h -Body $json -ContentType "application/json" -ErrorAction Stop
        return 200, $resp
    } catch {
        $status = $_.Exception.Response.StatusCode.value__
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $reader.BaseStream.Position = 0
        $reader.DiscardBufferedData()
        $text = $reader.ReadToEnd()
        try { $respObj = $text | ConvertFrom-Json } catch { $respObj = @{raw=$text} }
        return $status, $respObj
    }
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "1. VERIFICANDO AUTH SETTINGS" -ForegroundColor Cyan
Write-Host "========================================"
$status, $data = Call-Api "GET" "/auth/v1/settings" $null
Write-Host "Status: $status"
if ($status -eq 200) {
    Write-Host "Auth OK" -ForegroundColor Green
} else {
    Write-Host "Auth falhou: $($data | ConvertTo-Json)" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "2. VERIFICANDO USUARIOS EXISTENTES" -ForegroundColor Cyan
Write-Host "========================================"
$status, $data = Call-Api "GET" "/auth/v1/admin/users" $null
$users = $data.users
Write-Host "Usuarios encontrados: $($users.Count)"
$existing = $users | Where-Object { $_.email -eq "produtor@aura.teste" }
if ($existing) {
    $producer_id = $existing.id
    Write-Host "Usuario produtor ja existe. UUID: $producer_id" -ForegroundColor Green
} else {
    Write-Host "Criando usuario produtor..." -ForegroundColor Yellow
    $payload = @{
        email = "produtor@aura.teste"
        password = "senha123"
        email_confirm = $true
        user_metadata = @{
            full_name = "Joao Eventos"
            role = "producer"
        }
    }
    $status2, $data2 = Call-Api "POST" "/auth/v1/admin/users" $payload
    if ($status2 -in @(200,201)) {
        $producer_id = $data2.id
        Write-Host "Usuario criado. UUID: $producer_id" -ForegroundColor Green
    } else {
        Write-Host "Erro ao criar usuario: $($data2 | ConvertTo-Json)" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "3. INSERINDO/ATUALIZANDO PROFILE" -ForegroundColor Cyan
Write-Host "========================================"
$profilePayload = @{
    id = $producer_id
    email = "produtor@aura.teste"
    full_name = "Joao Eventos"
    role = "producer"
}
$status, $data = Call-Api "POST" "/rest/v1/profiles" $profilePayload @{ "Prefer" = "resolution=merge-duplicates,return=representation" }
Write-Host "Profile status: $status"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "4. VERIFICANDO EVENTOS EXISTENTES" -ForegroundColor Cyan
Write-Host "========================================"
$status, $data = Call-Api "GET" "/rest/v1/events?select=*" $null
Write-Host "Eventos existentes: $($data.Count)"
if ($data.Count -gt 0) {
    $data | ForEach-Object { Write-Host " - $($_.title) (ID: $($_.id))" }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "CONFIGURACAO CONCLUIDA" -ForegroundColor Cyan
Write-Host "========================================"
Write-Host "Produtor UUID: $producer_id"
Write-Host "Login: produtor@aura.teste / senha123"
