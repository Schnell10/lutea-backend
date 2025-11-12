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

# 2. Vérifier/Créer .env.docker
Write-Host ""
Write-Host "2️⃣ Vérification .env.docker..." -ForegroundColor Yellow
if (-not (Test-Path ".env.docker")) {
    Write-Host "⚠️ .env.docker n'existe pas. Création depuis .env.test..." -ForegroundColor Yellow
    if (Test-Path ".env.test") {
        Copy-Item ".env.test" ".env.docker"
        # MONGODB_URI sera surchargée par docker-compose
        Write-Host "✅ .env.docker créé" -ForegroundColor Green
    } else {
        Write-Host "❌ .env.test n'existe pas non plus !" -ForegroundColor Red
        Write-Host "Crée .env.docker manuellement." -ForegroundColor Yellow
        exit 1
    }
} else {
    Write-Host "✅ .env.docker existe" -ForegroundColor Green
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

