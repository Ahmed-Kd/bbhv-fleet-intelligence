@echo off
echo ========================================================
echo   Lancement du PROJET BBHV - Master 2 BDIA
echo ========================================================

:: Vérification de Docker
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERREUR] Docker n'est pas lance. Veuillez lancer Docker Desktop.
    pause
    exit /b
)

echo [1/2] Nettoyage de l'environnement precedent...
:: Le down arrette et supprime les conteneurs et reseaux pour eviter les conflits
docker compose down

echo [2/2] Construction et Demarrage...
:: Lancement propre avec reconstruction
docker compose up --build

:: Si ça plante, on garde la fenetre ouverte
pause