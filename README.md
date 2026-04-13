# BBHV Fleet Intelligence — Real-Time Hydrogen Vehicle Telemetry Platform

> **Event-Driven Architecture · IoT · Microservices · Real-Time Analytics**

[![Python](https://img.shields.io/badge/Python-3.10-3776AB?style=flat&logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.104-009688?style=flat&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Apache Kafka](https://img.shields.io/badge/Apache_Kafka-3.x-231F20?style=flat&logo=apachekafka&logoColor=white)](https://kafka.apache.org)
[![MQTT](https://img.shields.io/badge/MQTT-Eclipse_Mosquitto-660066?style=flat&logo=eclipsemosquitto&logoColor=white)](https://mosquitto.org)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=flat&logo=docker&logoColor=white)](https://docker.com)
[![WebSocket](https://img.shields.io/badge/WebSocket-Real--Time-4A90D9?style=flat)](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
[![License](https://img.shields.io/badge/License-Academic-orange?style=flat)](./LICENSE)

---
**Ahmed El Aziz KAIDI**

Ce projet est une **Preuve de Concept (PoC)** répondant à la problématique de l'entreprise fictive **BBHV** (*Bourgogne Blue Hydrogen Vehicles*) : comment collecter, acheminer et visualiser en temps réel la télémétrie d'une flotte de véhicules à hydrogène, tout en détectant automatiquement les anomalies critiques ?

La solution implémente une chaîne événementielle complète de bout en bout, depuis la simulation des capteurs embarqués jusqu'au tableau de bord interactif, en s'appuyant sur les standards industriels **MQTT**, **Apache Kafka** et **WebSocket**.

---

## Architecture Générale

```
┌─────────────────────────────────────────────────────────────────────┐
│                         BBHV Fleet Intelligence                      │
│                                                                       │
│  ┌──────────────┐     MQTT      ┌─────────────┐    Kafka Topic      │
│  │  Simulateur  │ ────────────► │   Mosquitto │ ──────────────────► │
│  │  (5 véhicules│  vehicle/     │  MQTT Broker│   vehicle-telemetry │
│  │  VH-1001 ─   │  telemetry/# │  (port 1883)│                     │
│  │  VH-1005)    │               └─────────────┘                     │
│  └──────────────┘                      │                             │
│                                        │ Bridge (MQTT → Kafka)       │
│                                        ▼                             │
│                               ┌─────────────────┐                   │
│                               │  Apache Kafka   │                   │
│                               │  + Zookeeper    │                   │
│                               └────────┬────────┘                   │
│                                        │                             │
│                                        ▼ Consume                    │
│                               ┌─────────────────┐                   │
│                               │   Processor     │ ── Détection      │
│                               │  Microservice   │    anomalies      │
│                               │  (async/await)  │    métier         │
│                               └────────┬────────┘                   │
│                                        │ HTTP POST /data             │
│                                        ▼                             │
│                               ┌─────────────────┐  WebSocket        │
│                               │  FastAPI        │ ──────────────►   │
│                               │  Dashboard API  │   Push temps réel │
│                               └─────────────────┘                   │
│                                        │                             │
│                                        ▼                             │
│                          ┌─────────────────────────┐                │
│                          │   Tableau de Bord Web   │                │
│                          │  (Leaflet + Chart.js)   │                │
│                          │  Carte · Alertes · KPIs │                │
│                          └─────────────────────────┘                │
└─────────────────────────────────────────────────────────────────────┘
```

**Flux de données :**
`Capteur → MQTT → Bridge → Kafka → Processor → FastAPI → WebSocket → UI`

---

## Fonctionnalités Clés

### Simulation de flotte multi-véhicules
- **5 véhicules simultanés** (VH-1001 à VH-1005), chacun dans son propre conteneur Docker
- Génération réaliste de télémétrie toutes les secondes :
  - Pression réservoir (700–950 bar)
  - Température (20–95 °C)
  - Niveau hydrogène (15–100 %)
  - Position GPS (mobilité simulée autour de Paris)
- Injection d'anomalies probabilistes : surchauffe (3%), surpression (2%), niveau H2 critique (1%)

### Détection d'anomalies métier
Le microservice Processor implémente les règles métier BBHV :

| Condition | Seuil | Alerte |
|-----------|-------|--------|
| Température | > 100 °C | `SURCHAUFFE` |
| Pression | > 1000 bar | `PRESSION CRITIQUE` |
| Hydrogène | < 10 % | `NIVEAU H2 BAS` |

### Tableau de bord temps réel
- **Vue flotte** : statut de chaque véhicule (OK / En alerte) mis à jour en temps réel
- **Carte interactive** (Leaflet) : positions GPS avec marqueurs colorés (vert/rouge selon état)
- **Graphiques historiques** (Chart.js) : évolution des capteurs sur les dernières mesures
- **Centre d'alertes** : agrégation et horodatage des événements critiques
- **Inspecteur véhicule** : métriques détaillées au clic sur la carte

### Infrastructure containerisée
- Déploiement **one-click** via `docker-compose up`
- Aucune installation locale requise hormis Docker Desktop
- Isolation complète de chaque service ; réseau bridge dédié

---

## Stack Technologique

| Couche | Technologie | Rôle |
|--------|-------------|------|
| **IoT / Edge** | MQTT · Paho | Publication télémétrie capteurs |
| **Broker MQTT** | Eclipse Mosquitto 2 | Bus de messages léger IoT |
| **Streaming** | Apache Kafka · Zookeeper | Distribution événements scalable |
| **Bridge** | Python 3.10 · kafka-python | Passerelle MQTT → Kafka |
| **Processing** | Python · AIOKafka (async) | Consommation et enrichissement |
| **API Backend** | FastAPI · Uvicorn | REST + WebSocket push |
| **Frontend** | Vanilla JS · Leaflet · Chart.js | Visualisation temps réel |
| **Infra** | Docker · Docker Compose | Orchestration multi-services |

---

## Structure du Projet

```
BBHV-PoC/
├── simulator/          # Générateur de télémétrie véhicule (MQTT publisher)
│   ├── simulate.py
│   ├── Dockerfile
│   └── requirements.txt
├── bridge/             # Passerelle MQTT → Kafka
│   ├── bridge.py
│   ├── Dockerfile
│   └── requirements.txt
├── microservice/       # Consommateur Kafka + détection anomalies
│   ├── processor.py
│   ├── Dockerfile
│   └── requirements.txt
├── dashboard/          # Interface web (FastAPI + WebSocket + UI)
│   ├── server.py
│   ├── static/
│   │   ├── index.html
│   │   ├── app.js      # ~500 lignes, logique temps réel
│   │   └── style.css
│   ├── Dockerfile
│   └── requirements.txt
├── mosquitto/
│   └── config/mosquitto.conf
├── docker-compose.yml  # Orchestration complète (8 services)
├── start_windows.bat   # Lanceur Windows 1-click
└── start_linux.sh      # Lanceur Linux/macOS 1-click
```

---

## Démarrage Rapide

### Prérequis

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installé et en cours d'exécution
- 4 Go de RAM disponibles recommandés (Kafka + Zookeeper)

### Lancement

**Windows** — double-cliquez sur :
```
start_windows.bat
```

**Linux / macOS** :
```bash
chmod +x start_linux.sh
./start_linux.sh
```

**Manuel** :
```bash
docker compose down --remove-orphans
docker compose up --build
```

### Accès au tableau de bord

Une fois tous les services démarrés (environ 30–60 secondes) :

```
http://localhost:8000
```

L'interface se connecte automatiquement via WebSocket et commence à recevoir les données en temps réel.

---

## Points Techniques Notables

### Découplage par protocoles
L'architecture sépare volontairement les préoccupations via trois protocoles distincts :
- **MQTT** pour la couche IoT (léger, pub/sub, faible bande passante)
- **Kafka** pour la distribution fiable et scalable des événements
- **WebSocket** pour la réactivité de l'interface utilisateur

### Traitement asynchrone
Le microservice Processor utilise `AIOKafka` avec `async/await`, permettant un traitement non-bloquant à fort débit sans multiplier les threads.

### Résilience au démarrage
Chaque service implémente une boucle de retry avec backoff (5 secondes) pour tolérer les délais de démarrage de Kafka et Mosquitto, reproduisant les patterns de production.

### Gestion d'état en mémoire
Le serveur FastAPI maintient un état de flotte via `defaultdict` + `deque` (100 messages max par véhicule), garantissant une empreinte mémoire constante sans base de données.

### Scalabilité horizontale
L'architecture supporte nativement le passage à l'échelle :
- **N simulateurs** → ajout de services dans `docker-compose.yml`
- **N processors** → Kafka consumer groups, partition automatique
- **N dashboards** → load-balancing WebSocket

---

## Compétences Démontrées

- Architecture orientée événements (EDA) et microservices
- Intégration de brokers hétérogènes (MQTT ↔ Kafka)
- Développement Python asynchrone (asyncio, AIOKafka, FastAPI)
- Communication temps réel client-serveur (WebSocket)
- Containerisation et orchestration Docker multi-services
- Visualisation de données géospatiales et temporelles
- Conception de règles métier dans une couche de traitement dédiée

---

## Rapport

Le rapport complet détaillant les choix d'architecture, l'analyse des middlewares et les perspectives d'évolution est disponible : `KAIDI_Ahmed_Rapport.pdf`

---

## Auteur

**Ahmed El Aziz KAIDI**
Master 2 BDIA — Université de Bourgogne
Décembre 2025

---

*Projet académique réalisé dans un cadre pédagogique — architecture conçue pour démontrer les principes d'intégration middleware en environnement distribué.*
