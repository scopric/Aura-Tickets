$url = "https://rwaezeqyuhxrssntcxdv.supabase.co/auth/v1/config"
$headers = @{
    "Authorization" = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ3YWV6ZXF5dWh4cnNzbnRjeGR2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Nzc1MzMyMiwiZXhwIjoyMDkzMzI5MzIyfQ.geaaWq2MCfrICr41FqTICyEqWsQQgYdrhAkYbTkBa5s"
    "apikey" = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ3YWV6ZXF5dWh4cnNzbnRjeGR2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Nzc1MzMyMiwiZXhwIjoyMDkzMzI5MzIyfQ.geaaWq2MCfrICr41FqTICyEqWsQQgYdrhAkYbTkBa5s"
}
try {
    $resp = Invoke-RestMethod -Uri $url -Headers $headers
    Write-Host "Auth config OK:" -ForegroundColor Green
    $resp | ConvertTo-Json -Depth 5
} catch {
    Write-Host "Erro: $($_.Exception.Message)" -ForegroundColor Red
    $_.Exception.Response.StatusCode.value__
}
