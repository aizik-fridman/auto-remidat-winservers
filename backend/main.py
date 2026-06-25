"""Windows Server Management — unified single-port application."""

from __future__ import annotations

import asyncio
import json
import os
import threading
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from services.reset_service import reset_server
from services.winrm_session import WinRMSession, stream_session
from services.yaml_parser import find_server_by_hostname, load_servers

APP_ROOT = Path(__file__).resolve().parent
PROJECT_ROOT = APP_ROOT.parent
DIST_DIR = PROJECT_ROOT / "frontend" / "dist"
DEFAULT_PORT = int(os.getenv("PORT", "8000"))

app = FastAPI(
    title="Windows Server Manager",
    description="Manage Windows servers from prometheus.yml on a single port",
    version="2.0.0",
)


class PasswordRequest(BaseModel):
    password: str = Field(..., min_length=1)


# ---------------------------------------------------------------------------
# API routes (prefixed with /api to avoid clashing with UI routes)
# ---------------------------------------------------------------------------


@app.get("/api/all-servers")
def get_all_servers() -> list[dict[str, str]]:
    try:
        return load_servers()
    except FileNotFoundError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to parse YAML: {exc}") from exc


@app.get("/api/servers/{hostname}")
def get_server(hostname: str) -> dict[str, str]:
    server = find_server_by_hostname(hostname)
    if not server:
        raise HTTPException(status_code=404, detail=f"Server '{hostname}' not found")
    return server


@app.post("/api/reset/{hostname}")
def reset_server_endpoint(hostname: str, body: PasswordRequest) -> dict[str, Any]:
    server = find_server_by_hostname(hostname)
    if not server:
        raise HTTPException(status_code=404, detail=f"Server '{hostname}' not found")

    if not server["ip"]:
        raise HTTPException(status_code=400, detail="Server IP could not be resolved")

    result = reset_server(server["ip"], body.password)
    payload = result.to_dict()
    payload["hostname"] = server["hostname"]
    payload["ip"] = server["ip"]
    payload["system"] = server["system"]
    payload["team"] = server["team"]

    if result.status != "success":
        raise HTTPException(status_code=500, detail=payload)

    return payload


@app.websocket("/api/ws/console/{hostname}")
async def console_websocket(websocket: WebSocket, hostname: str) -> None:
    await websocket.accept()

    server = find_server_by_hostname(hostname)
    if not server or not server["ip"]:
        await websocket.send_json(
            {"type": "error", "message": f"Server '{hostname}' not found"}
        )
        await websocket.close()
        return

    try:
        auth_raw = await websocket.receive_text()
        auth = json.loads(auth_raw)
        password = auth.get("password", "")
        if not password:
            await websocket.send_json({"type": "error", "message": "Password is required"})
            await websocket.close()
            return
    except (json.JSONDecodeError, WebSocketDisconnect):
        await websocket.close()
        return

    session: WinRMSession | None = None
    stop_event = threading.Event()
    loop = asyncio.get_running_loop()

    try:
        session = WinRMSession(server["ip"], password)
        session.connect()
        await websocket.send_json(
            {
                "type": "connected",
                "message": f"Connected to {server['hostname']} ({server['ip']})",
            }
        )

        def on_output(data: str) -> None:
            asyncio.run_coroutine_threadsafe(
                websocket.send_json({"type": "output", "data": data}),
                loop,
            )

        reader = threading.Thread(
            target=stream_session,
            args=(session, on_output, stop_event),
            daemon=True,
        )
        reader.start()

        while True:
            try:
                message_raw = await websocket.receive_text()
                message = json.loads(message_raw)
            except WebSocketDisconnect:
                break
            except json.JSONDecodeError:
                await websocket.send_json({"type": "error", "message": "Invalid message format"})
                continue

            msg_type = message.get("type")
            if msg_type == "input":
                data = message.get("data", "")
                if data:
                    session.send_input(data)
            elif msg_type == "ping":
                await websocket.send_json({"type": "pong"})
            elif msg_type == "close":
                break

    except Exception as exc:
        try:
            await websocket.send_json({"type": "error", "message": str(exc)})
        except Exception:
            pass
    finally:
        stop_event.set()
        if session:
            session.close()
        try:
            await websocket.close()
        except Exception:
            pass


@app.get("/api/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# Static frontend + SPA fallback (single port)
# ---------------------------------------------------------------------------

if DIST_DIR.is_dir():
    assets_dir = DIST_DIR / "assets"
    if assets_dir.is_dir():
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str) -> FileResponse:
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="Not found")

        requested = DIST_DIR / full_path
        if full_path and requested.is_file():
            return FileResponse(requested)

        index = DIST_DIR / "index.html"
        if not index.is_file():
            raise HTTPException(
                status_code=503,
                detail="Frontend not built. Run: cd frontend && npm install && npm run build",
            )
        return FileResponse(index)
else:

    @app.get("/")
    async def frontend_missing() -> dict[str, str]:
        return {
            "message": "Windows Server Manager API is running.",
            "hint": "Build the frontend: cd frontend && npm install && npm run build",
            "docs": "/docs",
        }
