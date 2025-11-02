# Script PowerShell pour lancer TOUS les tests Backend Lutea
# Usage : .\run-all-tests.ps1 [option]
#
# Options :
#   -Unit      : Lance uniquement les tests unitaires
#   -E2E       : Lance uniquement les tests E2E
#   -Coverage  : Lance avec coverage
#   (aucune)   : Lance tous les tests

param(
    [switch]$Unit,
    [switch]$E2E,
    [switch]$Coverage
)

Write-Host ""
Write-Host "==========================================" -ForegroundColor Blue
Write-Host "TESTS BACKEND LUTEA" -ForegroundColor Blue
Write-Host "==========================================" -ForegroundColor Blue
Write-Host ""

# Verifier que .env.test existe
if (-not (Test-Path ".env.test")) {
    Write-Host "ERREUR : Le fichier .env.test n'existe pas !" -ForegroundColor Red
    Write-Host ""
    Write-Host "Solutions :" -ForegroundColor Yellow
    Write-Host "1. Copiez env.test.example vers .env.test :"
    Write-Host "   Copy-Item env.test.example .env.test"
    Write-Host ""
    Write-Host "2. Remplissez vos cles Stripe TEST dans .env.test"
    Write-Host ""
    Write-Host "3. Lisez test/LANCER-LES-TESTS.md pour plus d'informations"
    Write-Host ""
    exit 1
}

function Print-Summary {
    param([int]$ExitCode)
    
    Write-Host ""
    Write-Host "==========================================" -ForegroundColor Blue
    Write-Host "RESUME DES TESTS" -ForegroundColor Blue
    Write-Host "==========================================" -ForegroundColor Blue
    Write-Host ""
    
    if ($ExitCode -eq 0) {
        Write-Host "TOUS LES TESTS SONT PASSES !" -ForegroundColor Green
        Write-Host ""
        Write-Host "Prochaines etapes :"
        Write-Host "  1. Committez vos changements"
        Write-Host "  2. Poussez sur GitHub"
        Write-Host "  3. GitHub Actions lancera les tests automatiquement"
    } else {
        Write-Host "CERTAINS TESTS ONT ECHOUE" -ForegroundColor Red
        Write-Host ""
        Write-Host "Actions recommandees :"
        Write-Host "  1. Lisez les erreurs ci-dessus"
        Write-Host "  2. Corrigez le code"
        Write-Host "  3. Relancez les tests"
    }
    Write-Host ""
    Write-Host "==========================================" -ForegroundColor Blue
}

# Detecter l'option
if ($Unit) {
    Write-Host "Lancement des tests UNITAIRES uniquement..." -ForegroundColor Yellow
    Write-Host ""
    npm test -- --coverage
    $ExitCode = $LASTEXITCODE
}
elseif ($E2E) {
    Write-Host "Lancement des tests E2E uniquement..." -ForegroundColor Yellow
    Write-Host ""
    npm run test:e2e
    $ExitCode = $LASTEXITCODE
}
elseif ($Coverage) {
    Write-Host "Lancement des tests avec coverage..." -ForegroundColor Yellow
    Write-Host ""
    npm test -- --coverage
    $ExitCode = $LASTEXITCODE
}
else {
    # Lancer TOUS les tests par defaut
    Write-Host "1/2 - Tests UNITAIRES..." -ForegroundColor Yellow
    Write-Host ""
    npm test
    $UnitExit = $LASTEXITCODE
    
    if ($UnitExit -ne 0) {
        Write-Host ""
        Write-Host "Les tests unitaires ont echoue" -ForegroundColor Red
        Print-Summary 1
        exit 1
    }
    
    Write-Host ""
    Write-Host "Tests unitaires reussis !" -ForegroundColor Green
    Write-Host ""
    Write-Host "==========================================" -ForegroundColor Blue
    Write-Host ""
    
    Write-Host "2/2 - Tests E2E..." -ForegroundColor Yellow
    Write-Host ""
    npm run test:e2e
    $E2EExit = $LASTEXITCODE
    
    if ($E2EExit -ne 0) {
        Write-Host ""
        Write-Host "Les tests E2E ont echoue" -ForegroundColor Red
        Print-Summary 1
        exit 1
    }
    
    Write-Host ""
    Write-Host "Tests E2E reussis !" -ForegroundColor Green
    $ExitCode = 0
}

Print-Summary $ExitCode
exit $ExitCode

