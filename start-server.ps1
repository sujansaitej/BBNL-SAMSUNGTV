# BBNL Production Proxy Server
# Navigate to the correct directory and start the server

Push-Location "$PSScriptRoot\bbnl-proxy"
Write-Host "`n🚀 Starting BBNL Production Proxy Server...`n" -ForegroundColor Green

node server.js

Pop-Location
