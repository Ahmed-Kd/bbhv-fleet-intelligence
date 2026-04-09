import os, json, asyncio
from collections import defaultdict, deque
from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
import uvicorn
import logging

# Configuration du logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI()
app.mount("/static", StaticFiles(directory="static"), name="static")

# État de la flotte
fleet_state = defaultdict(lambda: {
    "last": {},
    "history": deque(maxlen=100),
    "alerts": []
})

clients = set()

@app.on_event("startup")
async def startup_event():
    logger.info("🚀 Dashboard backend démarré!")
    logger.info(f"📡 En attente de données du processor sur /push")

@app.post("/push")
async def push(request: Request):
    """Reçoit les données du processor"""
    try:
        body = await request.json()
        logger.info(f"📥 Données reçues du processor")
        
        vehicle_data = body.get("vehicle", {})
        alerts = body.get("alerts", [])
        
        vehicle_id = vehicle_data.get("vehicle_id")
        if not vehicle_id:
            logger.error("❌ vehicle_id manquant dans le payload")
            return {"status": "error", "message": "vehicle_id manquant"}
        
        # Mise à jour de l'état
        fleet_state[vehicle_id]["last"] = vehicle_data
        fleet_state[vehicle_id]["history"].append(vehicle_data)
        fleet_state[vehicle_id]["alerts"] = alerts
        
        logger.info(f"✅ État mis à jour pour {vehicle_id} - Flotte: {len(fleet_state)} véhicule(s)")
        
        # Broadcast WebSocket
        broadcast_payload = {
            "fleet": {
                vid: {
                    "last": state["last"],
                    "history": list(state["history"]),
                    "alerts": state["alerts"]
                }
                for vid, state in fleet_state.items()
            }
        }
        
        msg = json.dumps(broadcast_payload)
        
        disconnected = []
        for ws in clients:
            try:
                await ws.send_text(msg)
                logger.info(f"📤 Envoyé à un client WebSocket")
            except Exception as e:
                logger.warning(f"⚠️ Client WebSocket déconnecté: {e}")
                disconnected.append(ws)
        
        for ws in disconnected:
            clients.discard(ws)
        
        logger.info(f"👥 {len(clients)} client(s) WebSocket actif(s)")
        
        return {"status": "ok", "vehicle_id": vehicle_id}
        
    except Exception as e:
        logger.error(f"❌ Erreur dans /push: {e}", exc_info=True)
        return {"status": "error", "message": str(e)}

@app.get("/api/fleet")
async def get_fleet():
    """Endpoint REST pour debug"""
    fleet_data = {
        "fleet": {
            vid: {
                "last": state["last"],
                "history": list(state["history"]),
                "alerts": state["alerts"]
            }
            for vid, state in fleet_state.items()
        }
    }
    logger.info(f"📊 GET /api/fleet: {len(fleet_state)} véhicule(s)")
    return fleet_data

@app.get("/")
async def index():
    return FileResponse("static/index.html")

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    clients.add(websocket)
    logger.info(f"🔌 Nouveau client WebSocket connecté (Total: {len(clients)})")
    
    # Envoi de l'état initial
    try:
        initial_state = {
            "fleet": {
                vid: {
                    "last": state["last"],
                    "history": list(state["history"]),
                    "alerts": state["alerts"]
                }
                for vid, state in fleet_state.items()
            }
        }
        await websocket.send_text(json.dumps(initial_state))
        logger.info(f"📤 État initial envoyé au client ({len(fleet_state)} véhicules)")
    except Exception as e:
        logger.error(f"❌ Erreur envoi état initial: {e}")
    
    try:
        while True:
            # Heartbeat
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        clients.discard(websocket)
        logger.info(f"🔌 Client WebSocket déconnecté (Restant: {len(clients)})")
    except Exception as e:
        clients.discard(websocket)
        logger.error(f"❌ Erreur WebSocket: {e}")

if __name__ == "__main__":
    logger.info("=" * 50)
    logger.info("🚀 Démarrage du serveur Dashboard")
    logger.info("=" * 50)
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")