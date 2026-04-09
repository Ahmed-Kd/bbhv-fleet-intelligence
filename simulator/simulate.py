import os
import time
import json
import random
import socket
import paho.mqtt.client as mqtt
import logging

# Configuration du logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Configuration
BROKER = os.getenv("MQTT_BROKER", "mosquitto")
PORT = int(os.getenv("MQTT_PORT", 1883))
VEHICLE_ID = os.getenv("VEHICLE_ID", "VH-1234")

# Position de base (personnalisée par véhicule)
BASE_LAT = float(os.getenv("BASE_LAT", "48.8566"))
BASE_LON = float(os.getenv("BASE_LON", "2.3522"))

def get_mqtt_client():
    try:
        client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
    except AttributeError:
        client = mqtt.Client()

    while True:
        try:
            logger.info(f"🔄 [{VEHICLE_ID}] Connexion au broker {BROKER}:{PORT}...")
            client.connect(BROKER, PORT, 60)
            logger.info(f"✅ [{VEHICLE_ID}] Connecté avec succès!")
            return client
        except (socket.gaierror, ConnectionRefusedError, OSError) as e:
            logger.error(f"❌ [{VEHICLE_ID}] Échec: {e}")
            logger.info(f"⏳ [{VEHICLE_ID}] Nouvelle tentative dans 5s...")
            time.sleep(5)

client = get_mqtt_client()

def gen_payload():
    """Génère des données de télémétrie avec position relative à la base"""
    payload = {
        "vehicle_id": VEHICLE_ID,
        "pressure": random.randint(700, 950),
        "temperature": random.randint(20, 95),
        "hydrogen": random.randint(15, 100),
        "lat": BASE_LAT + random.uniform(-0.02, 0.02),  # Mouvement dans un rayon de ~2km
        "lon": BASE_LON + random.uniform(-0.02, 0.02),
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    }
    
    # Simulation d'anomalies (plus rare)
    rand = random.random()
    if rand < 0.03:  # 3% de chance de surchauffe
        payload["temperature"] = random.randint(100, 150)
    elif rand < 0.05:  # 2% de chance de surpression
        payload["pressure"] = random.randint(1000, 1200)
    elif rand < 0.06:  # 1% de chance de niveau H2 bas
        payload["hydrogen"] = random.randint(0, 5)
        
    return payload

logger.info(f"🚀 [{VEHICLE_ID}] Démarrage de la simulation...")
logger.info(f"📍 [{VEHICLE_ID}] Position de base: {BASE_LAT}, {BASE_LON}")
message_count = 0

while True:
    try:
        p = gen_payload()
        topic = f"vehicle/telemetry/{p['vehicle_id']}"
        
        client.publish(topic, json.dumps(p))
        message_count += 1
        
        if message_count % 20 == 0:  # Log tous les 20 messages
            logger.info(f"📤 [{VEHICLE_ID}] Message #{message_count}")
        
        time.sleep(1)  # 1 message par seconde (moins rapide)
        
    except Exception as e:
        logger.error(f"❌ [{VEHICLE_ID}] Erreur: {e}")
        try:
            client.reconnect()
        except:
            time.sleep(5)