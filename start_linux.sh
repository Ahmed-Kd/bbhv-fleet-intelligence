#!/bin/bash

echo "========================================================"
echo "  Lancement du PROJET BBHV - Master 2 BDIA"
echo "========================================================"

# Vérification de Docker
if ! docker info > /dev/null 2>&1; then
  echo "[ERREUR] Docker n'est pas lancé."
  read -p "Appuyez sur Entrée pour quitter..."
  exit 1
fi

echo "[1/2] Nettoyage de l'ancien environnement..."
docker compose down

echo "[2/2] Construction et Démarrage..."
docker compose up --build