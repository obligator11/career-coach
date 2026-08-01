Write-Host "Starting Docker containers..." -ForegroundColor Cyan
docker compose up -d
Start-Sleep -Seconds 2
docker ps
Write-Host "`nStarting uvicorn..." -ForegroundColor Cyan
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000