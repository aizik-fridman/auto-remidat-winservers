# Windows Server Manager

A unified full-stack web application for managing Windows servers on a **single port**. Server inventory is read from a local `prometheus.yml` file (the `windows_exporter` scrape job). Operators can remotely reboot servers or open an interactive web-based terminal over WinRM.

## Features

- **Single-port architecture** — FastAPI serves the React SPA and all API/WebSocket routes together
- **Dark, minimalist UI** — server table with hostname, IP, system, and team
- **YAML-driven inventory** — parses `scrape_configs` for job `windows_exporter`
- **Reset page** (`/reset/<hostname>`) — remote reboot with detailed operation summary, timing, and command logs
- **Web console** (`/console/<hostname>`) — interactive xterm.js terminal streamed over WebSockets via WinRM
- **Emergency commands sidebar** — pre-fills the terminal prompt (does not auto-execute)

## Project Structure

```
auto-remidat-winservers/
├── prometheus.yml          # Server inventory (sample included)
├── backend/
│   ├── main.py             # FastAPI app (API + static SPA)
│   ├── requirements.txt
│   └── services/
│       ├── yaml_parser.py
│       ├── reset_service.py
│       └── winrm_session.py
└── frontend/
    ├── dist/               # Built SPA (generated)
    └── src/
        ├── pages/
        │   ├── AllServersPage.jsx
        │   ├── ResetPage.jsx
        │   └── ConsolePage.jsx
        └── components/
```

## UI Routes

| Route | Description |
|-------|-------------|
| `/all-servers` | Home — grid of all servers from prometheus.yml |
| `/reset/<hostname>` | Reset page with password prompt and operation analysis |
| `/console/<hostname>` | Interactive web terminal with emergency commands sidebar |

## Prerequisites

- **Python 3.10+**
- **Node.js 18+**
- **Windows** (required for remote reset via `net use` / `shutdown`)
- Target servers with **WinRM enabled** (port 5985 HTTP or 5986 HTTPS)
- A valid `prometheus.yml` with a `windows_exporter` job

### prometheus.yml format

```yaml
scrape_configs:
  - job_name: windows_exporter
    static_configs:
      - targets:
          - 192.168.1.10:9182
        labels:
          system: Production
          team: Infrastructure
          srv_name: WEB-SRV-01
```

## Setup & Run (Single Port)

### 1. Configure prometheus.yml

Replace the sample `prometheus.yml` in the project root, or set:

```powershell
$env:PROMETHEUS_YML_PATH = "C:\path\to\prometheus.yml"
```

### 2. Install dependencies

```powershell
# Backend
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt

# Frontend
cd ..\frontend
npm install
npm run build
```

### 3. Start the application

```powershell
cd backend
uvicorn main:app --host 0.0.0.0 --port 8000
```

Open **http://localhost:8000/all-servers**

Everything — UI, REST API, and WebSocket console — runs on port **8000**.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/all-servers` | JSON array of servers from YAML |
| GET | `/api/servers/{hostname}` | Single server metadata |
| POST | `/api/reset/{hostname}` | Body: `{ "password": "..." }` — remote reboot with detailed result |
| WS | `/api/ws/console/{hostname}` | Interactive WinRM terminal (send `{ "password": "..." }` first) |
| GET | `/api/health` | Health check |

### WebSocket protocol

1. Connect to `/api/ws/console/{hostname}`
2. Send: `{ "password": "..." }`
3. Receive: `{ "type": "connected", "message": "..." }` or `{ "type": "error", ... }`
4. Send input: `{ "type": "input", "data": "dir\r\n" }`
5. Receive output: `{ "type": "output", "data": "..." }`

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PROMETHEUS_YML_PATH` | `../prometheus.yml` | Path to prometheus config |
| `PORT` | `8000` | Server port |
| `WINRM_PORT` | `5985` | WinRM port on target servers |
| `WINRM_USE_SSL` | `false` | Use HTTPS WinRM (port 5986) |
| `WINRM_TRANSPORT` | `ntlm` | WinRM auth transport |

## Development

After changing frontend code, rebuild and restart:

```powershell
cd frontend
npm run build
cd ..\backend
uvicorn main:app --reload --port 8000
```

API docs (Swagger): http://localhost:8000/docs

## Security Notes

- Use HTTPS in production — passwords travel over the wire for reset and console sessions.
- Reset requires network access to target IPC$ and Administrator credentials.
- WinRM must be enabled and reachable on target servers.
- Restrict network access to this application — it performs privileged remote operations.

## License

MIT
