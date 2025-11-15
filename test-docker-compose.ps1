# Test dans Docker avec Docker Compose - Version Simple

Write-Host "🐳 Test dans Docker (Docker Compose)" -ForegroundColor Cyan
Write-Host ""

# 1. Vérifier Docker
Write-Host "1️⃣ Vérification Docker..." -ForegroundColor Yellow
docker ps | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Docker n'est pas lancé !" -ForegroundColor Red
    Write-Host "Lance Docker Desktop et réessaye." -ForegroundColor Yellow
    exit 1
}
Write-Host "✅ Docker fonctionne" -ForegroundColor Green

# 2. Vérifier .env.test
Write-Host ""
Write-Host "2️⃣ Vérification .env.test..." -ForegroundColor Yellow
if (-not (Test-Path ".env.test")) {
    Write-Host "❌ .env.test n'existe pas !" -ForegroundColor Red
    Write-Host "Crée .env.test avec tes variables de test." -ForegroundColor Yellow
    Write-Host "Voir test/README-TESTS.md pour plus d'informations." -ForegroundColor Yellow
    exit 1
} else {
    Write-Host "✅ .env.test existe" -ForegroundColor Green
    Write-Host "   (MONGODB_URI sera surchargée par docker-compose pour utiliser 'mongo')" -ForegroundColor Gray
}

# 3. Lancer les tests avec Docker Compose
Write-Host ""
Write-Host "3️⃣ Lancement des tests avec Docker Compose..." -ForegroundColor Yellow
Write-Host "   (Build de l'image + MongoDB + Tests)" -ForegroundColor Gray
Write-Host ""

docker-compose -f docker-compose.test.yml --profile test up --build --exit-code-from backend

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "❌ Tests échoués" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "🎉 Tous les tests passent dans Docker !" -ForegroundColor Green
Write-Host "Tu peux push en toute confiance 🚀" -ForegroundColor Cyan

# Nettoyer
Write-Host ""
Write-Host "🧹 Nettoyage..." -ForegroundColor Yellow
docker-compose -f docker-compose.test.yml down
Write-Host "✅ Nettoyé" -ForegroundColor Green

