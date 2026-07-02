"""Windows Server Manager – FastAPI application."""

from __future__ import annotations

import asyncio
import json
import logging
import os
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from services.reset_service import reset_server
from services.winrm_session import WinRMSession
from services.yaml_parser import find_server_by_hostname, load_servers

logger = logging.getLogger("winserver-manager")

APP_ROOT = Path(__file__).resolve().parent
PROJECT_ROOT = APP_ROOT.parent
DIST_DIR = PROJECT_ROOT / "frontend" / "dist"
DEFAULT_PORT = int(os.getenv("PORT", "8000"))

# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Windows Server Manager",
    description="Monitor and manage Windows servers from prometheus.yml",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------


class PasswordRequest(BaseModel):
    password: str = Field(..., min_length=1)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _winrm_defaults() -> tuple[str, str]:
    """Return the (scheme, port) pair for WinRM metadata."""
    port = os.getenv("WINRM_PORT", "5985")
    ssl = os.getenv("WINRM_USE_SSL", "").lower() in ("1", "true", "yes")
    scheme = "https" if ssl else "http"
    return scheme, port


def _enrich_server(server: dict[str, str]) -> dict[str, str]:
    """Add WinRM metadata fields to a server dict."""
    scheme, port = _winrm_defaults()
    enriched = dict(server)
    enriched["exporter_target"] = (
        f"{server['ip']}:{server['port']}" if server.get("port") else server["ip"]
    )
    enriched["winrm_host"] = server["ip"]
    enriched["winrm_port"] = port
    enriched["winrm_endpoint"] = f"{scheme}://{server['ip']}:{port}/wsman"
    return enriched


# ---------------------------------------------------------------------------
# API routes
# ---------------------------------------------------------------------------


@app.get("/api/all-servers")
def get_all_servers() -> list[dict[str, str]]:
    """Return every server from the prometheus.yml inventory."""
    try:
        return [_enrich_server(s) for s in load_servers()]
    except FileNotFoundError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500, detail=f"Failed to parse YAML: {exc}"
        ) from exc


@app.get("/api/servers/{hostname}")
def get_server(hostname: str) -> dict[str, str]:
    """Return a single server by hostname."""
    server = find_server_by_hostname(hostname)
    if not server:
        raise HTTPException(status_code=404, detail=f"Server '{hostname}' not found")
    return _enrich_server(server)


@app.post("/api/reset/{hostname}")
def reset_server_endpoint(hostname: str, body: PasswordRequest) -> dict[str, Any]:
    """Remotely reboot a server via net use + shutdown."""
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


# ---------------------------------------------------------------------------
# WebSocket console
# ---------------------------------------------------------------------------


@app.websocket("/api/ws/console/{hostname}")
async def console_websocket(websocket: WebSocket, hostname: str) -> None:
    """Interactive console over WinRM using command-at-a-time model.

    Protocol:
    1. Client connects.
    2. Client sends: ``{"password": "..."}``
    3. Server authenticates, sends: ``{"type": "connected", ...}``
    4. Client sends: ``{"type": "input", "data": "some command"}``
    5. Server replies: ``{"type": "output", "data": "stdout\\nstderr"}``
    6. Client sends: ``{"type": "close"}`` to disconnect.
    7. ``{"type": "ping"}`` → ``{"type": "pong"}``
    """
    await websocket.accept()

    # --- Resolve server ---------------------------------------------------
    server = find_server_by_hostname(hostname)
    if not server or not server["ip"]:
        await websocket.send_json(
            {"type": "error", "message": f"Server '{hostname}' not found"}
        )
        await websocket.close()
        return

    # --- Authenticate -----------------------------------------------------
    try:
        auth_raw = await websocket.receive_text()
        auth = json.loads(auth_raw)
        password = auth.get("password", "")
        if not password:
            await websocket.send_json(
                {"type": "error", "message": "Password is required"}
            )
            await websocket.close()
            return
    except (json.JSONDecodeError, WebSocketDisconnect):
        await websocket.close()
        return

    # --- Create WinRM session & test connection ---------------------------
    session: WinRMSession | None = None
    try:
        session = WinRMSession(server["ip"], password)

        # Test connectivity with a lightweight command.
        test = await asyncio.get_running_loop().run_in_executor(
            None, session.test_connection
        )

        if test["exit_code"] != 0:
            await websocket.send_json(
                {
                    "type": "error",
                    "message": f"WinRM connection test failed: {test['stderr']}",
                }
            )
            await websocket.close()
            return

        await websocket.send_json(
            {
                "type": "connected",
                "message": (
                    f"Connected to {server['hostname']} ({server['ip']}) — "
                    f"remote hostname: {test['stdout']}"
                ),
            }
        )
    except Exception as exc:
        logger.exception("WinRM connection failed for %s", hostname)
        await websocket.send_json(
            {"type": "error", "message": f"WinRM connection failed: {exc}"}
        )
        await websocket.close()
        return

    # --- Command loop -----------------------------------------------------
    try:
        while True:
            try:
                raw = await websocket.receive_text()
                message = json.loads(raw)
            except WebSocketDisconnect:
                break
            except json.JSONDecodeError:
                await websocket.send_json(
                    {"type": "error", "message": "Invalid JSON"}
                )
                continue

            msg_type = message.get("type", "")

            if msg_type == "input":
                cmd = message.get("data") or message.get("command", "")
                if not isinstance(cmd, str) or not cmd.strip():
                    await websocket.send_json(
                        {"type": "error", "message": "Empty or invalid command"}
                    )
                    continue

                try:
                    result = await asyncio.get_running_loop().run_in_executor(
                        None, session.run_command, cmd.strip()
                    )
                    # Build combined output
                    parts: list[str] = []
                    if result["stdout"]:
                        parts.append(result["stdout"])
                    if result["stderr"]:
                        parts.append(result["stderr"])
                    output = "\n".join(parts) if parts else "(no output)"

                    await websocket.send_json(
                        {"type": "output", "data": output}
                    )
                except Exception as exc:
                    logger.exception(
                        "Command execution failed on %s", hostname
                    )
                    await websocket.send_json(
                        {
                            "type": "error",
                            "message": f"Command execution failed: {exc}",
                        }
                    )

            elif msg_type == "ping":
                await websocket.send_json({"type": "pong"})

            elif msg_type == "close":
                break

    except WebSocketDisconnect:
        pass
    except Exception as exc:
        logger.exception("WebSocket error for %s", hostname)
        try:
            await websocket.send_json(
                {"type": "error", "message": f"Unexpected error: {exc}"}
            )
        except Exception:
            pass
    finally:
        try:
            await websocket.close()
        except Exception:
            pass


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------


@app.get("/api/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# Static frontend + SPA fallback
# ---------------------------------------------------------------------------

if DIST_DIR.is_dir():
    assets_dir = DIST_DIR / "assets"
    if assets_dir.is_dir():
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str) -> FileResponse:
        """Serve the SPA; fall back to index.html for client-side routes."""
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
