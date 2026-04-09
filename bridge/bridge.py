import os
import json
import time
from paho.mqtt.client import Client
from kafka import KafkaProducer

# Configuration
MQTT_BROKER = os.getenv("MQTT_BROKER", "mosquitto")
MQTT_PORT = int(os.getenv("MQTT_PORT", 1883))
# Attention: Dans ton docker-compose, le service s'appelle 'kafka', pas 'redpanda'
KAFKA_BOOTSTRAP = os.getenv("KAFKA_BOOTSTRAP", "kafka:9092")
KAFKA_TOPIC = "vehicle_telemetry" # Doit correspondre au topic créé dans docker-compose

# Initialisation du producteur Kafka (Synchrone)
# On ajoute un retry car Kafka met parfois du temps à démarrer
producer = None
while producer is None:
    try:
        print(f"Connexion à Kafka ({KAFKA_BOOTSTRAP})...", flush=True)
        producer = KafkaProducer(
            bootstrap_servers=KAFKA_BOOTSTRAP,
            value_serializer=lambda v: json.dumps(v).encode('utf-8')
        )
        print("Connecté à Kafka !", flush=True)
    except Exception as e:
        print(f"Kafka pas encore prêt ({e}), nouvel essai dans 5s...", flush=True)
        time.sleep(5)

def on_connect(client, userdata, flags, rc):
    print(f"Connecté au Broker MQTT (Code: {rc})", flush=True)
    # CORRECTION DU TOPIC : Le simulateur publie sur 'vehicle/telemetry/...'
    # Le '#' est un wildcard pour tout récupérer
    client.subscribe("vehicle/telemetry/#")

def on_message(client, userdata, msg):
    try:
        # Décodage du payload
        payload_str = msg.payload.decode('utf-8')
        payload_json = json.loads(payload_str)
        
        print(f"Reçu MQTT: {msg.topic} -> Envoi Kafka...", flush=True)
        
        # Envoi synchrone vers Kafka
        # On utilise le JSON déjà parsé pour être sûr du format
        producer.send(KAFKA_TOPIC, payload_json)
        producer.flush() # On force l'envoi immédiat
        
    except Exception as e:
        print(f"Erreur de traitement : {e}", flush=True)

def main():
    client = Client()
    client.on_connect = on_connect
    client.on_message = on_message
    
    print(f"Connexion au Broker MQTT ({MQTT_BROKER}:{MQTT_PORT})...", flush=True)
    try:
        client.connect(MQTT_BROKER, MQTT_PORT, 60)
        client.loop_forever()
    except Exception as e:
        print(f"Impossible de se connecter à MQTT: {e}", flush=True)

if __name__ == "__main__":
    main()