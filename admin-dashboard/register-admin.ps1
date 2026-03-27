$body = @{
    email = "admin@test.com"
    password = "rhebaba1972"
    firstName = "Rands"
    lastName = "Admin"
    adminSecretKey = "rhebaba@1973"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Method POST -Uri "http://localhost:5050/api/auth/register/admin" -ContentType "application/json" -Body $body
    Write-Host "SUCCESS! Admin registered." -ForegroundColor Green
    Write-Host "Token: $($response.token)"
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    $errorBody = $_.ErrorDetails.Message
    Write-Host "Error ($statusCode): $errorBody" -ForegroundColor Red
    
    if ($statusCode -eq 409) {
        Write-Host "Admin already exists. Try logging in instead." -ForegroundColor Yellow
    }
}
