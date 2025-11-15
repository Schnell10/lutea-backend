# Test dans Docker avec Docker Compose - Version Simple

Write-Host "Test dans Docker (Docker Compose)" -ForegroundColor Cyan
Write-Host ""

# 1. Vérifier Docker
Write-Host "1. Verification Docker..." -ForegroundColor Yellow
docker ps | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERREUR: Docker n'est pas lance !" -ForegroundColor Red
    Write-Host "Lance Docker Desktop et reessaye." -ForegroundColor Yellow
    exit 1
}
Write-Host "OK: Docker fonctionne" -ForegroundColor Green

# 2. Vérifier .env.test
Write-Host ""
Write-Host "2. Verification .env.test..." -ForegroundColor Yellow
if (-not (Test-Path ".env.test")) {
    Write-Host "ERREUR: .env.test n'existe pas !" -ForegroundColor Red
    Write-Host "Cree .env.test avec tes variables de test." -ForegroundColor Yellow
    Write-Host "Voir test/README-TESTS.md pour plus d'informations." -ForegroundColor Yellow
    exit 1
} else {
    Write-Host "OK: .env.test existe" -ForegroundColor Green
    Write-Host "   (MONGODB_URI sera surchargee par docker-compose pour utiliser 'mongo')" -ForegroundColor Gray
}

# 3. Lancer les tests avec Docker Compose
Write-Host ""
Write-Host "3. Lancement des tests avec Docker Compose..." -ForegroundColor Yellow
Write-Host "   (Build de l'image + MongoDB + Tests)" -ForegroundColor Gray
Write-Host ""

docker-compose -f docker-compose.test.yml --profile test up --build --exit-code-from backend

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "ERREUR: Tests echoues" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "SUCCES: Tous les tests passent dans Docker !" -ForegroundColor Green
Write-Host "Tu peux push en toute confiance" -ForegroundColor Cyan

# Nettoyer
Write-Host ""
Write-Host "Nettoyage..." -ForegroundColor Yellow
docker-compose -f docker-compose.test.yml down
Write-Host "OK: Nettoie" -ForegroundColor Green

