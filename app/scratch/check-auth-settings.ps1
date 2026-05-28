$SUPABASE_URL = "https://rwaezeqyuhxrssntcxdv.supabase.co"
$SERVICE_ROLE = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ3YWV6ZXF5dWh4cnNzbnRjeGR2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Nzc1MzMyMiwiZXhwIjoyMDkzMzI5MzIyfQ.geaaWq2MCfrICr41FqTICyEqWsQQgYdrhAkYbTkBa5s"

$headers = @{
    "Authorization" = "Bearer $SERVICE_ROLE"
    "apikey" = $SERVICE_ROLE
}

try {
    $url = "$SUPABASE_URL/auth/v1/settings"
    $resp = Invoke-RestMethod -Uri $url -Method "GET" -Headers $headers
    $resp | ConvertTo-Json -Depth 5
} catch {
    Write-Error $_.Exception.Message
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $text = $reader.ReadToEnd()
        Write-Error "Response content: $text"
    }
}
