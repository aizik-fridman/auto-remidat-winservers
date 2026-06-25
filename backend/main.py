"""Windows Server Management API."""

from __future__ import annotations

import io
import os
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from services.rdp_service import generate_rdp_content
from services.reset_service import reset_server
from services.yaml_parser import find_server_by_hostname, load_servers

app = FastAPI(
    title="Windows Server Manager",
    description="Manage and monitor Windows servers from prometheus.yml",
    version="1.0.0",
)

frontend_origin = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[frontend_origin, "http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class PasswordRequest(BaseModel):
    password: str = Field(..., min_length=1)


@app.get("/all-servers")
def get_all_servers() -> list[dict[str, str]]:
    try:
        return load_servers()
    except FileNotFoundError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to parse YAML: {exc}") from exc


@app.post("/reset/{hostname}")
def reset_server_endpoint(hostname: str, body: PasswordRequest) -> dict[str, Any]:
    server = find_server_by_hostname(hostname)
    if not server:
        raise HTTPException(status_code=404, detail=f"Server '{hostname}' not found")

    if not server["ip"]:
        raise HTTPException(status_code=400, detail="Server IP could not be resolved")

    success, message = reset_server(server["ip"], body.password)
    if not success:
        raise HTTPException(status_code=500, detail=message)

    return {
        "status": "success",
        "message": message,
        "hostname": server["hostname"],
        "ip": server["ip"],
    }


@app.post("/console/{hostname}")
def console_server_endpoint(hostname: str, body: PasswordRequest) -> StreamingResponse:
    server = find_server_by_hostname(hostname)
    if not server:
        raise HTTPException(status_code=404, detail=f"Server '{hostname}' not found")

    if not server["ip"]:
        raise HTTPException(status_code=400, detail="Server IP could not be resolved")

    rdp_content = generate_rdp_content(server["ip"], body.password)
    filename = f"{server['hostname'] or server['ip']}.rdp"

    return StreamingResponse(
        io.BytesIO(rdp_content.encode("utf-8")),
        media_type="application/rdp",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}
