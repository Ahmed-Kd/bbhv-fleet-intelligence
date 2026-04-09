import os
import asyncio
import json
import logging
import requests
from aiokafka import AIOKafkaConsumer

# --- CONFIGURATION ---
KAFKA_BOOTSTRAP = os.getenv("KAFKA_BOOTSTRAP", "kafka:9092")
KAFKA_TOPIC = "vehicle_telemetry"
# Le processor parle au dashboard via le réseau Docker interne (port 8000)
DASHBOARD_URL = "http://dashboard:8000/push"

async def process():
    print(f"Démarrage du Processor. Connexion à {KAFKA_BOOTSTRAP}...", flush=True)
    
    # Configuration du consommateur Kafka
    consumer = AIOKafkaConsumer(
        KAFKA_TOPIC,
        bootstrap_servers=KAFKA_BOOTSTRAP,
        group_id="dashboard-group",
        auto_offset_reset='latest', # On veut le temps réel
        value_deserializer=lambda m: json.loads(m.decode('utf-8'))
    )

    # Boucle de connexion robuste (Retry)
    while True:
        try:
            await consumer.start()
            print("Processor connecté à Kafka !", flush=True)
            break
        except Exception as e:
            print(f"Kafka pas prêt ({e}). Nouvelle tentative dans 5s...", flush=True)
            await asyncio.sleep(5)

    try:
        print("En attente de messages...", flush=True)
        async for msg in consumer:
            vehicle_data = msg.value
            
            # --- 1. Logique Métier (Détection d'alertes) ---
            # On analyse les données brutes pour créer des alertes intelligentes
            alerts = []
            
            temp = vehicle_data.get('temperature', 0)
            pressure = vehicle_data.get('pressure', 0)
            hydrogen = vehicle_data.get('hydrogen', 0)

            if temp > 100:
                alerts.append({"type": "SURCHAUFFE", "value": temp})
            
            if pressure > 1000:
                alerts.append({"type": "PRESSION CRITIQUE", "value": pressure})
                
            if hydrogen < 10:
                alerts.append({"type": "NIVEAU H2 BAS", "value": hydrogen})

            # --- 2. Préparation du Payload pour le Dashboard ---
            # Le frontend (app.js) attend cette structure exacte :
            dashboard_payload = {
                "vehicle": vehicle_data,
                "alerts": alerts
            }

            # --- 3. Envoi HTTP au Dashboard ---
            try:
                # Envoi POST vers le serveur FastAPI
                response = requests.post(DASHBOARD_URL, json=dashboard_payload, timeout=2)
                if response.status_code == 200:
                    print(f"Donnée transmise au Dashboard: {vehicle_data['timestamp']}", flush=True)
                else:
                    print(f"Erreur Dashboard (Code {response.status_code})", flush=True)
            except Exception as req_err:
                print(f"Dashboard injoignable : {req_err}", flush=True)

    except Exception as e:
        print(f"Erreur critique de consommation : {e}", flush=True)
    finally:
        await consumer.stop()

if __name__ == "__main__":
    try:
        asyncio.run(process())
    except KeyboardInterrupt:
        pass